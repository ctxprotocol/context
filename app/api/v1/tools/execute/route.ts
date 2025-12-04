import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { NextResponse } from "next/server";
import { createPublicClient, http, parseUnits } from "viem";
import { base } from "viem/chains";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { apiAuthErrorResponse, authenticateApiKey } from "@/lib/api/auth";
import { APP_URL } from "@/lib/constants";
import { getAIToolById, recordToolQuery } from "@/lib/db/queries";
import {
  type AutoPayToolPayment,
  executeAutoPayment,
} from "@/lib/tools/auto-pay-executor";

const LOG_PREFIX = "[api/v1/tools/execute]";
const MCP_TIMEOUT_MS = 30_000;

/**
 * POST /api/v1/tools/execute
 *
 * Authenticated API endpoint for executing marketplace tools.
 * This is the Context Protocol public API for tool execution.
 *
 * Authentication: Required (API key via Bearer token)
 *
 * Request Body:
 *   - toolId: UUID of the tool to execute
 *   - toolName: Name of the specific MCP tool to call (from mcpTools list)
 *   - args: Arguments to pass to the tool
 *
 * Flow:
 *   1. Authenticate API key → get user
 *   2. Look up tool → get price, developer wallet, endpoint
 *   3. Check user's USDC allowance for ContextRouter (Auto Pay must be enabled)
 *   4. Execute payment via operator wallet (executeAutoPayment)
 *   5. Call MCP tool on remote server
 *   6. Record query and return result
 */
export async function POST(request: Request) {
  const startTime = performance.now();

  // Step 1: Authenticate
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) {
    return apiAuthErrorResponse(authResult);
  }

  const { user, apiKey } = authResult;
  console.log(LOG_PREFIX, "Authenticated user:", {
    userId: user.id,
    keyId: apiKey.id,
  });

  // Parse request body
  let body: {
    toolId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { toolId, toolName, args = {} } = body;

  // Validate required fields
  if (!toolId) {
    return NextResponse.json({ error: "toolId is required" }, { status: 400 });
  }

  if (!toolName) {
    return NextResponse.json(
      {
        error:
          "toolName is required. Get available tools from /api/v1/tools/search",
      },
      { status: 400 }
    );
  }

  // Step 2: Look up tool
  const tool = await getAIToolById({ id: toolId });
  if (!tool) {
    return NextResponse.json(
      { error: `Tool with ID ${toolId} not found` },
      { status: 404 }
    );
  }

  if (!tool.isActive) {
    return NextResponse.json(
      { error: `Tool "${tool.name}" is currently inactive` },
      { status: 400 }
    );
  }

  // Validate tool is an MCP tool with endpoint
  const schema = tool.toolSchema as Record<string, unknown> | null;

  if (!schema || schema.kind !== "mcp" || typeof schema.endpoint !== "string") {
    return NextResponse.json(
      {
        error:
          "This tool is not a valid MCP tool and cannot be executed via API",
      },
      { status: 400 }
    );
  }

  const endpoint = schema.endpoint;
  const isFree = Number(tool.pricePerQuery ?? 0) === 0;

  console.log(LOG_PREFIX, "Executing tool:", {
    toolId,
    toolName,
    isFree,
    price: tool.pricePerQuery,
  });

  // Step 3: Check user's Auto Pay status (USDC allowance)
  // API users must have enabled Auto Pay in the web dashboard first
  if (!isFree) {
    // Check if user has a Privy DID (required for operator payments)
    if (!user.privyDid) {
      return NextResponse.json(
        {
          error:
            "Account not fully set up. Please sign in via the web dashboard first to set up your wallet.",
          code: "no_wallet",
        },
        { status: 400 }
      );
    }

    // Check USDC allowance
    const allowanceCheck = await checkUserAllowance(
      user.privyDid,
      tool.pricePerQuery ?? "0"
    );

    if (!allowanceCheck.sufficient) {
      return NextResponse.json(
        {
          error: allowanceCheck.error,
          code: "insufficient_allowance",
          helpUrl: `${APP_URL}/settings`, // Direct user to enable Auto Pay
        },
        { status: 400 }
      );
    }

    // Step 4: Execute payment via operator wallet
    const payment: AutoPayToolPayment = {
      toolId: tool.id,
      developerWallet: tool.developerWallet,
      priceUsd: tool.pricePerQuery ?? "0",
    };

    console.log(LOG_PREFIX, "Executing payment...");
    const paymentResult = await executeAutoPayment(user.privyDid, payment);

    if (!paymentResult.success) {
      console.error(LOG_PREFIX, "Payment failed:", paymentResult.error);
      return NextResponse.json(
        {
          error: paymentResult.error ?? "Payment failed",
          code: "payment_failed",
        },
        { status: 402 } // Payment Required
      );
    }

    console.log(
      LOG_PREFIX,
      "Payment successful:",
      paymentResult.transactionHash
    );
  }

  // Step 5: Call MCP tool
  try {
    const result = await callMcpTool(endpoint, toolName, args);

    // Step 6: Record query
    await recordToolQuery({
      toolId,
      userId: user.id,
      amountPaid: isFree ? "0" : (tool.pricePerQuery ?? "0"),
      transactionHash: isFree ? "api-free-tool" : "api-paid-tool",
      queryInput: { toolName, args },
      queryOutput: result as Record<string, unknown>,
      status: "completed",
    });

    const duration = Math.round(performance.now() - startTime);
    console.log(LOG_PREFIX, `Execution complete (${duration}ms)`);

    return NextResponse.json({
      success: true,
      result,
      tool: {
        id: tool.id,
        name: tool.name,
      },
      durationMs: duration,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(LOG_PREFIX, "Tool execution failed:", errorMessage);

    // Record failed query
    await recordToolQuery({
      toolId,
      userId: user.id,
      amountPaid: isFree ? "0" : (tool.pricePerQuery ?? "0"),
      transactionHash: isFree ? "api-free-tool" : "api-paid-tool",
      queryInput: { toolName, args },
      status: "failed",
    }).catch(() => {
      /* ignore recording errors */
    });

    return NextResponse.json(
      {
        error: `Tool execution failed: ${errorMessage}`,
        code: "execution_failed",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has sufficient USDC allowance for the ContextRouter
 */
async function checkUserAllowance(
  privyDid: string,
  priceUsd: string
): Promise<{ sufficient: boolean; error?: string }> {
  const routerAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;

  if (!routerAddress || !usdcAddress) {
    return {
      sufficient: false,
      error: "Contract addresses not configured",
    };
  }

  try {
    // Import Privy client to get user's wallet
    const { PrivyClient } = await import("@privy-io/server-auth");
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      return {
        sufficient: false,
        error: "Privy credentials not configured",
      };
    }

    const privy = new PrivyClient(appId, appSecret);
    const privyUser = await privy.getUser(privyDid);

    // Find embedded wallet
    const embeddedWallet = privyUser.linkedAccounts.find(
      (account) =>
        account.type === "wallet" && account.walletClientType === "privy"
    );

    if (!embeddedWallet || !("address" in embeddedWallet)) {
      return {
        sufficient: false,
        error:
          "No embedded wallet found. Please set up your wallet via the web dashboard.",
      };
    }

    const userAddress = embeddedWallet.address as `0x${string}`;

    // Check allowance on-chain
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const allowance = await publicClient.readContract({
      address: usdcAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [userAddress, routerAddress as `0x${string}`],
    });

    const requiredAmount = parseUnits(priceUsd, 6);

    if (allowance < requiredAmount) {
      return {
        sufficient: false,
        error: `Insufficient Auto Pay allowance. Please enable Auto Pay in the dashboard at ${APP_URL}/settings. Current allowance: $${Number(allowance) / 1e6}, Required: $${priceUsd}`,
      };
    }

    return { sufficient: true };
  } catch (error) {
    console.error(LOG_PREFIX, "Allowance check failed:", error);
    return {
      sufficient: false,
      error: "Failed to check allowance. Please try again.",
    };
  }
}

/**
 * Call an MCP tool directly
 */
async function callMcpTool(
  endpoint: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const url = new URL(endpoint);
  const isSSE = endpoint.toLowerCase().includes("/sse");

  // Create transport
  const transport = isSSE
    ? new SSEClientTransport(url)
    : new StreamableHTTPClientTransport(url);

  // Create client
  const client = new Client(
    { name: "context-protocol-api", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    // Call tool with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Tool execution timed out")),
        MCP_TIMEOUT_MS
      )
    );

    const resultPromise = client.callTool({
      name: toolName,
      arguments: args,
    });

    const result = (await Promise.race([resultPromise, timeoutPromise])) as {
      content: unknown[];
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
    };

    // Unwrap result
    if (result.isError) {
      const errorContent = unwrapMcpContent(result.content);
      throw new Error(
        typeof errorContent === "string"
          ? errorContent
          : JSON.stringify(errorContent)
      );
    }

    // Prefer structuredContent if available
    if (
      result.structuredContent &&
      Object.keys(result.structuredContent).length > 0
    ) {
      return result.structuredContent;
    }

    return unwrapMcpContent(result.content);
  } finally {
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
  }
}

/**
 * Unwrap MCP content array to clean data
 */
function unwrapMcpContent(content: unknown): unknown {
  if (!Array.isArray(content) || content.length === 0) {
    return content;
  }

  // Single text block - parse JSON if possible
  if (content.length === 1) {
    const block = content[0];
    if (block && typeof block === "object" && "type" in block) {
      if (
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        try {
          return JSON.parse(block.text);
        } catch {
          return block.text;
        }
      }
      return block;
    }
  }

  // Multiple blocks - combine text blocks
  const textBlocks = content.filter(
    (block): block is { type: "text"; text: string } =>
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block
  );

  if (textBlocks.length === content.length) {
    const combined = textBlocks.map((b) => b.text).join("\n");
    try {
      return JSON.parse(combined);
    } catch {
      return combined;
    }
  }

  // Mixed content
  return content.map((block) => {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block
    ) {
      try {
        return JSON.parse(block.text as string);
      } catch {
        return block.text;
      }
    }
    return block;
  });
}
