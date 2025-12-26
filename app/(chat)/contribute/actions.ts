"use server";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { calculateRequiredStake } from "@/lib/constants";
import { createAITool, getAIToolsByDeveloper } from "@/lib/db/queries";
import { validateToolOutput } from "@/lib/tools/schema-validator";
import { type ContributeFormState, contributeFormSchema } from "./schema";

/**
 * SMOKE TEST TIMEOUT
 * How long to wait for a tool to respond during smoke testing.
 * Set conservatively high since some tools need to warm up cold starts.
 */
const SMOKE_TEST_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Generate sample input values from a JSON Schema
 * Used to create test payloads for smoke testing tools
 */
function generateSampleFromSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  const s = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    items?: unknown;
    default?: unknown;
    enum?: unknown[];
    examples?: unknown[];
  };

  // If there's a default or example, use it
  if (s.default !== undefined) {
    return s.default;
  }
  if (s.examples && s.examples.length > 0) {
    return s.examples[0];
  }
  if (s.enum && s.enum.length > 0) {
    return s.enum[0];
  }

  // Generate based on type
  switch (s.type) {
    case "string":
      return "test";
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    case "array":
      return s.items ? [generateSampleFromSchema(s.items)] : [];
    case "object":
      if (s.properties) {
        const obj: Record<string, unknown> = {};
        // Only include required properties to minimize test payload
        const requiredProps = s.required || Object.keys(s.properties);
        for (const key of requiredProps) {
          if (s.properties[key]) {
            obj[key] = generateSampleFromSchema(s.properties[key]);
          }
        }
        return obj;
      }
      return {};
    default:
      return {};
  }
}

type SmokeTestResult = {
  success: boolean;
  toolName: string;
  error?: string;
  errorType?: "timeout" | "empty_response" | "schema_mismatch" | "execution_error";
  fix?: string; // Actionable fix suggestion for developers
  outputValid?: boolean;
  validationErrors?: string[];
};

/**
 * SMOKE TEST: Call each tool with sample inputs and validate outputs
 *
 * This is the "rite of passage" for tool submission. We actually call
 * the tool to verify it returns valid data, not just that it responds.
 *
 * Why this matters:
 * - Catches "AI slop" tools that respond but return garbage
 * - Validates outputSchema compliance BEFORE going live
 * - Developer pays nothing, but must prove their tool works
 */
async function smokeTestTools(
  client: Client,
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }>
): Promise<{ passed: boolean; results: SmokeTestResult[] }> {
  const results: SmokeTestResult[] = [];
  let allPassed = true;

  for (const tool of tools) {
    try {
      // Generate sample input from schema
      const sampleInput = tool.inputSchema
        ? generateSampleFromSchema(tool.inputSchema)
        : {};

      console.log(`[smoke-test] Testing ${tool.name} with:`, sampleInput);

      // Call the tool with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        SMOKE_TEST_TIMEOUT_MS
      );

      try {
        const response = await client.callTool({
          name: tool.name,
          arguments: sampleInput as Record<string, unknown>,
        });

        clearTimeout(timeoutId);

        // Check if we got a valid response
        if (!response || !response.content) {
          results.push({
            success: false,
            toolName: tool.name,
            error: "Tool returned empty response",
            errorType: "empty_response",
            fix: "Your tool must return content. Check that your tool handler returns a valid MCP response with content array.",
          });
          allPassed = false;
          continue;
        }

        // Extract the actual content (MCP tools return content array)
        const content = response.content;
        let outputData: unknown = content;

        // Try to parse text content as JSON if it looks like JSON
        if (Array.isArray(content) && content.length > 0) {
          const firstItem = content[0] as { type?: string; text?: string };
          if (firstItem.type === "text" && firstItem.text) {
            try {
              outputData = JSON.parse(firstItem.text);
            } catch {
              // Not JSON, use raw text
              outputData = firstItem.text;
            }
          }
        }

        // Validate against outputSchema if present
        if (tool.outputSchema) {
          const validation = validateToolOutput(outputData, tool.outputSchema);

          if (!validation.isValid) {
            results.push({
              success: false,
              toolName: tool.name,
              error: "Output does not match declared outputSchema",
              errorType: "schema_mismatch",
              fix: `Your tool's actual output doesn't match its declared outputSchema. Either update your outputSchema to match what your tool returns, or fix your tool to return the declared shape. If your tool can return errors, include an error response type in your outputSchema.`,
              outputValid: false,
              validationErrors: validation.errorMessages,
            });
            allPassed = false;
            continue;
          }
        }

        // Success!
        results.push({
          success: true,
          toolName: tool.name,
          outputValid: true,
        });

        console.log(`[smoke-test] ✓ ${tool.name} passed`);
      } catch (callError) {
        clearTimeout(timeoutId);

        // Check if it was a timeout
        if (callError instanceof Error && callError.name === "AbortError") {
          results.push({
            success: false,
            toolName: tool.name,
            error: `Tool timed out after ${SMOKE_TEST_TIMEOUT_MS / 1_000}s`,
            errorType: "timeout",
            fix: `Your tool took too long to respond. Ensure it can respond within ${SMOKE_TEST_TIMEOUT_MS / 1_000} seconds. Consider adding caching, optimizing API calls, or handling cold starts faster.`,
          });
        } else {
          // Execution error - could be bad input, server crash, etc.
          const errorMsg =
            callError instanceof Error
              ? callError.message
              : "Unknown error during tool call";

          // Provide specific fix based on common error patterns
          let fix =
            "Your tool threw an error during execution. Check your server logs for details.";

          if (
            errorMsg.includes("Invalid") ||
            errorMsg.includes("required") ||
            errorMsg.includes("missing")
          ) {
            fix = `Your tool rejected the test input. Add "default" or "examples" to your inputSchema so we can generate valid test data. Example: { type: "string", default: "0x1234..." }`;
          } else if (
            errorMsg.includes("ECONNREFUSED") ||
            errorMsg.includes("fetch failed")
          ) {
            fix =
              "Could not reach your server. Ensure it's publicly accessible and not behind a firewall.";
          }

          results.push({
            success: false,
            toolName: tool.name,
            error: errorMsg,
            errorType: "execution_error",
            fix,
          });
        }
        allPassed = false;
      }
    } catch (err) {
      results.push({
        success: false,
        toolName: tool.name,
        error: err instanceof Error ? err.message : "Unknown error",
        errorType: "execution_error",
        fix: "An unexpected error occurred. Check your server logs and ensure your MCP endpoint is correctly configured.",
      });
      allPassed = false;
    }
  }

  return { passed: allPassed, results };
}

/**
 * Determine the appropriate transport type based on endpoint URL pattern
 * - `/sse` suffix → SSE transport
 * - `/mcp` suffix → HTTP Streaming transport
 * - Other paths → HTTP Streaming (modern default)
 */
function detectTransportType(endpoint: string): "sse" | "http-streaming" {
  const url = new URL(endpoint);
  const pathname = url.pathname.toLowerCase();

  if (pathname.endsWith("/sse") || pathname.includes("sse")) {
    return "sse";
  }

  return "http-streaming";
}

/**
 * Connect to an MCP server and list available tools
 * Tries HTTP Streaming first, falls back to SSE if that fails
 */
async function connectAndListTools(endpoint: string): Promise<{
  client: Client;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }>;
  transportUsed: string;
}> {
  const url = new URL(endpoint);
  const transportType = detectTransportType(endpoint);

  // Try primary transport first
  const primaryTransport =
    transportType === "sse"
      ? new SSEClientTransport(url)
      : new StreamableHTTPClientTransport(url);

  const client = new Client(
    { name: "context-verification", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(primaryTransport);
    const result = await client.listTools();

    return {
      client,
      tools: result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      })),
      transportUsed: transportType,
    };
  } catch (primaryError) {
    // If primary fails and it was HTTP Streaming, try SSE fallback
    if (transportType === "http-streaming") {
      console.log(
        "[contribute] HTTP Streaming failed, trying SSE fallback for:",
        endpoint
      );

      const fallbackClient = new Client(
        { name: "context-verification", version: "1.0.0" },
        { capabilities: {} }
      );

      try {
        const sseTransport = new SSEClientTransport(url);
        await fallbackClient.connect(sseTransport);
        const result = await fallbackClient.listTools();

        return {
          client: fallbackClient,
          tools: result.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            outputSchema: t.outputSchema,
          })),
          transportUsed: "sse (fallback)",
        };
      } catch {
        // Both failed, throw original error
        throw primaryError;
      }
    }

    // SSE was primary and failed, no fallback
    throw primaryError;
  }
}

export async function submitTool(
  _prevState: ContributeFormState,
  formData: FormData
): Promise<ContributeFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    endpoint: formData.get("endpoint"),
    price: formData.get("price"),
    developerWallet: formData.get("developerWallet"),
  };

  // Cast raw to any for payload repopulation (string values work better for form)
  const payload = raw as unknown as ContributeFormState["payload"];

  const parsed = contributeFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors,
      payload,
    };
  }

  // Prevent duplicate tools for the same developer and endpoint
  const existingTools = await getAIToolsByDeveloper({
    developerId: session.user.id,
  });

  const normalizedEndpoint = parsed.data.endpoint.trim();

  const isDuplicate = existingTools.some((tool) => {
    const schema = tool.toolSchema as Record<string, unknown> | null;
    if (!schema || typeof schema !== "object") {
      return false;
    }

    if (schema.kind === "mcp") {
      return schema.endpoint === normalizedEndpoint;
    }

    return false;
  });

  if (isDuplicate) {
    return {
      status: "error",
      message: "You already have a tool registered with this endpoint.",
      fieldErrors: {
        endpoint: "This endpoint is already registered.",
      },
      payload,
    };
  }

  // Verify MCP server by connecting and listing tools
  let mcpTools: {
    name: string;
    description?: string;
    inputSchema?: unknown;
  }[] = [];

  try {
    // Auto-detect and use appropriate transport (HTTP Streaming or SSE)
    const { client, tools, transportUsed } = await connectAndListTools(
      parsed.data.endpoint
    );
    console.log(
      `[contribute] Connected via ${transportUsed} to:`,
      parsed.data.endpoint
    );

    if (!tools || tools.length === 0) {
      // Close client before returning error
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      return {
        status: "error",
        message: "MCP server has no tools. Please expose at least one tool.",
        fieldErrors: { endpoint: "No tools found on this MCP server" },
        payload,
      };
    }

    // =========================================================
    // SMOKE TEST: Rite of passage for tool submission
    // Actually call each tool to verify it works and returns valid data
    // =========================================================
    console.log(
      `[contribute] Running smoke tests on ${tools.length} tool(s)...`
    );

    const smokeTest = await smokeTestTools(client, tools);

    // Close client after smoke test
    try {
      await client.close();
    } catch (closeErr) {
      // AbortError is expected when closing SSE connections
      if (!(closeErr instanceof Error && closeErr.name === "AbortError")) {
        console.warn("[contribute] Error closing MCP client:", closeErr);
      }
    }

    if (!smokeTest.passed) {
      // Find the first failure and build an actionable error message
      const failedTool = smokeTest.results.find((r) => !r.success);

      let errorTitle = "Smoke test failed";
      let errorDetails = "";
      let fixSuggestion = "";

      if (failedTool) {
        errorTitle = `Smoke test failed for "${failedTool.toolName}"`;
        errorDetails = failedTool.error || "Unknown error";

        // Add schema validation errors if present (limit to 3 for readability)
        if (
          failedTool.validationErrors &&
          failedTool.validationErrors.length > 0
        ) {
          errorDetails += ` — Schema errors: ${failedTool.validationErrors.slice(0, 3).join("; ")}`;
        }

        // Add the actionable fix suggestion
        if (failedTool.fix) {
          fixSuggestion = failedTool.fix;
        }
      }

      // Build the full message with fix suggestion prominently displayed
      const fullMessage = fixSuggestion
        ? `${errorTitle}: ${errorDetails}\n\n💡 How to fix: ${fixSuggestion}`
        : `${errorTitle}: ${errorDetails}`;

      return {
        status: "error",
        message: fullMessage,
        fieldErrors: {
          endpoint:
            failedTool?.fix ||
            "Tool smoke test failed - verify your tool returns valid responses",
        },
        payload,
      };
    }

    console.log(`[contribute] ✓ All ${tools.length} tool(s) passed smoke test`);

    // Cache the discovered tools (including outputSchema for AI to understand response structure)
    mcpTools = tools;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "error",
      message: `Could not connect to MCP server: ${message}`,
      fieldErrors: { endpoint: "MCP connection failed" },
      payload,
    };
  }

  const toolSchema = {
    kind: "mcp",
    endpoint: parsed.data.endpoint,
    tools: mcpTools,
  };

  await createAITool({
    name: parsed.data.name,
    description: parsed.data.description,
    developerId: session.user.id,
    developerWallet: parsed.data.developerWallet,
    pricePerQuery: parsed.data.price,
    category: parsed.data.category,
    apiEndpoint: "/api/tools/execute",
    toolSchema,
  });

  revalidatePath("/chat");

  const skillCount = mcpTools.length;
  const skillWord = skillCount === 1 ? "skill" : "skills";
  const priceValue = Number.parseFloat(parsed.data.price) || 0;
  const stakeRequired = calculateRequiredStake(priceValue);

  // Return success message - ALL tools require stake now
  // Client will handle redirect after showing message
  return {
    status: "success",
    message: `Tool submitted! Discovered ${skillCount} ${skillWord}. Deposit $${stakeRequired.toFixed(2)} USDC stake to activate. Your tool will auto-activate once staked.`,
  };
}
