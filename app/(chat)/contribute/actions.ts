"use server";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { createAITool, getAIToolsByDeveloper } from "@/lib/db/queries";
import { type ContributeFormState, contributeFormSchema } from "./schema";

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

    // Close client - ignore AbortError which is expected for SSE transport
    try {
      await client.close();
    } catch (closeErr) {
      // AbortError is expected when closing SSE connections
      if (!(closeErr instanceof Error && closeErr.name === "AbortError")) {
        console.warn("[contribute] Error closing MCP client:", closeErr);
      }
    }

    if (!tools || tools.length === 0) {
      return {
        status: "error",
        message: "MCP server has no tools. Please expose at least one tool.",
        fieldErrors: { endpoint: "No tools found on this MCP server" },
        payload,
      };
    }

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

  // Return success message - client will handle redirect after showing message
  if (priceValue > 0) {
    const stakeRequired = priceValue * 100;
    return {
      status: "success",
      message: `Tool submitted! Discovered ${skillCount} ${skillWord}. Deposit $${stakeRequired.toFixed(2)} USDC stake to activate. Your tool will auto-activate once staked.`,
    };
  }

  return {
    status: "success",
    message: `Tool submitted and activated! Discovered ${skillCount} ${skillWord}. Your free tool is now live in the marketplace.`,
  };
}
