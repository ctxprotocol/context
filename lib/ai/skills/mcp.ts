import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildSearchText, generateEmbedding } from "@/lib/ai/embeddings";
import { getSkillRuntime } from "@/lib/ai/skills/runtime";
import {
  getAIToolById,
  recordToolQuery,
  updateAIToolEmbedding,
  updateAIToolSchema,
} from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";

/**
 * MCP Skill Module
 *
 * This module provides the skill functions to interact with MCP Tools.
 *
 * Terminology:
 * - **MCP Tool**: A paid marketplace listing (appears in sidebar, has a price)
 * - **MCP Skill**: This execution layer that calls the MCP server (can be called up to 100x per tool payment)
 *
 * The relationship:
 * - User pays for an "MCP Tool" once per chat turn
 * - Agent can call `callMcpSkill()` up to 100 times within that paid turn
 * - Each call invokes a specific tool on the remote MCP server
 *
 * Supported Transports:
 * - SSE (Server-Sent Events): Endpoints ending with `/sse`
 * - HTTP Streaming (Streamable HTTP): Endpoints ending with `/mcp` or other paths
 *
 * The transport is auto-detected based on the endpoint URL pattern.
 */

type CallMcpSkillParams = {
  /** The database ID of the MCP Tool (from marketplace listing) */
  toolId: string;
  /** The specific tool name on the MCP server (from listTools discovery) */
  toolName: string;
  /** Arguments to pass to the MCP tool */
  args: Record<string, unknown>;
};

type McpSkillResult = unknown;

const MCP_TIMEOUT_MS = 30_000;
const MAX_CALLS_PER_TURN = 100;

// Connection cache TTL - connections are reused within this window
// Set to 2 minutes to outlast the MCP SDK's 60-second internal timeout
const CONNECTION_CACHE_TTL_MS = 120_000; // 2 minutes

// Cache MCP clients per endpoint with TTL to avoid reconnecting on every call
type CachedClient = {
  client: Client;
  createdAt: number;
};
const clientCache = new Map<string, CachedClient>();

// Pending connection promises to prevent race conditions
// When multiple parallel calls try to connect to the same endpoint simultaneously,
// the first call creates the connection and all others wait for the same promise
const pendingConnections = new Map<string, Promise<Client>>();

/**
 * MCP Tool Result type (from MCP spec 2025-06-18)
 */
type McpCallToolResult = {
  content: unknown[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

/**
 * Unwrap MCP result to return clean, predictable data
 *
 * MCP spec (2025-06-18) defines two ways to return data:
 * 1. `structuredContent` - Preferred, typed JSON object matching outputSchema
 * 2. `content` - Array of content blocks (text, image, etc.)
 *
 * We prioritize `structuredContent` when available for consistent data access.
 */
function unwrapMcpResult(result: McpCallToolResult): unknown {
  // Prefer structuredContent if available (MCP 2025-06-18 standard)
  // This gives us clean, predictable data structure
  if (
    result.structuredContent &&
    Object.keys(result.structuredContent).length > 0
  ) {
    console.log("[mcp-skill] Using structuredContent (MCP standard)");
    return result.structuredContent;
  }

  // Fall back to parsing content array
  return unwrapMcpContent(result.content);
}

/**
 * Unwrap MCP content array format to return clean data
 * MCP returns: { content: [{ type: "text", text: "..." }, ...] }
 * We want to return the actual parsed data directly
 */
/**
 * Helper to strip Markdown code blocks from LLM output
 * Matches ```json ... ``` or just ``` ... ``` and returns the inner content
 */
function stripCodeBlocks(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : text;
}

/**
 * Heuristic to find the first valid JSON object in a string
 * Useful when the LLM wraps JSON in natural language
 * e.g. "Here is the data: { "price": 100 }" -> { "price": 100 }
 */
function extractFirstJson(text: string): unknown | null {
  const firstOpen = text.indexOf("{");
  const lastClose = text.lastIndexOf("}");

  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    const potentialJson = text.slice(firstOpen, lastClose + 1);
    try {
      return JSON.parse(potentialJson);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Unwrap MCP content array format to return clean data
 * MCP returns: { content: [{ type: "text", text: "..." }, ...] }
 * We want to return the actual parsed data directly
 */
function unwrapMcpContent(content: unknown): unknown {
  if (!Array.isArray(content) || content.length === 0) {
    return content;
  }

  // Helper to try parsing a string as JSON with multiple fallback strategies
  const tryParse = (text: string): unknown => {
    // Strategy 1: Clean Parse (Fast Path)
    try {
      return JSON.parse(text);
    } catch {
      // Continue to strategies
    }

    // Strategy 2: Strip Markdown Code Blocks
    const stripped = stripCodeBlocks(text);
    if (stripped !== text) {
      try {
        return JSON.parse(stripped);
      } catch {
        // Continue
      }
    }

    // Strategy 3: Heuristic Extraction (Find first {...})
    const extracted = extractFirstJson(text);
    if (extracted) {
      console.warn(
        "[mcp-skill] Heuristic JSON extraction used (Lazy Developer detected)"
      );
      return extracted;
    }

    // Fallback: Return original string
    return text;
  };

  // If there's only one content block and it's text, parse and return it
  if (content.length === 1) {
    const block = content[0];
    if (block && typeof block === "object" && "type" in block) {
      if (
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return tryParse(block.text);
      }
      // For other types (image, etc.), return as-is
      return block;
    }
  }

  // Multiple content blocks - try to combine text blocks
  const textBlocks = content.filter(
    (block): block is { type: "text"; text: string } =>
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block
  );

  if (textBlocks.length === content.length) {
    // All blocks are text - combine them
    const combined = textBlocks.map((b) => b.text).join("\n");
    return tryParse(combined);
  }

  // Mixed content - return as array
  return content.map((block) => {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block
    ) {
      return tryParse(block.text as string);
    }
    return block;
  });
}

/**
 * Determine the appropriate transport type based on endpoint URL pattern
 *
 * Transport selection rules:
 * - `/sse` suffix → SSE transport (legacy, widely supported)
 * - `/mcp` suffix → HTTP Streaming (modern, recommended)
 * - Other paths → Try HTTP Streaming first (newer default), fall back to SSE
 *
 * Examples:
 * - https://mcp.api.coingecko.com/sse → SSE
 * - https://mcp.api.coingecko.com/mcp → HTTP Streaming
 * - http://localhost:4001/sse → SSE
 */
type TransportType = "sse" | "http-streaming";

function detectTransportType(endpoint: string): TransportType {
  const url = new URL(endpoint);
  const pathname = url.pathname.toLowerCase();

  // Explicit SSE endpoint
  if (pathname.endsWith("/sse")) {
    return "sse";
  }

  // Explicit MCP HTTP streaming endpoint
  if (pathname.endsWith("/mcp")) {
    return "http-streaming";
  }

  // Default: prefer HTTP streaming for unknown paths (modern default)
  // But most community servers use /sse, so check for common patterns
  if (pathname.includes("sse")) {
    return "sse";
  }

  return "http-streaming";
}

/**
 * Create the appropriate MCP transport based on endpoint URL
 */
function createMcpTransport(
  endpoint: string
): SSEClientTransport | StreamableHTTPClientTransport {
  const url = new URL(endpoint);
  const transportType = detectTransportType(endpoint);

  if (transportType === "sse") {
    console.log("[mcp-skill] Using SSE transport for:", endpoint);
    return new SSEClientTransport(url);
  }

  console.log("[mcp-skill] Using HTTP Streaming transport for:", endpoint);
  return new StreamableHTTPClientTransport(url);
}

/**
 * Get or create an MCP client for the given endpoint
 * Uses TTL-based caching (2 minutes) to reuse connections within a code execution
 * while still ensuring connections don't become stale across requests.
 *
 * Auto-detects transport type (SSE vs HTTP Streaming) based on endpoint URL.
 *
 * IMPORTANT: Uses a pending connection pattern to prevent race conditions.
 * When multiple parallel calls try to connect to the same endpoint simultaneously,
 * only the first call actually creates the connection - all others wait for it.
 */
async function getMcpClient(endpoint: string): Promise<Client> {
  const now = Date.now();
  const cached = clientCache.get(endpoint);

  // Check if we have a valid cached connection
  if (cached && now - cached.createdAt < CONNECTION_CACHE_TTL_MS) {
    console.log("[mcp-skill] Reusing cached MCP connection to:", endpoint);
    return cached.client;
  }

  // Check if there's already a connection in progress for this endpoint
  // This prevents multiple parallel calls from creating duplicate connections
  const pending = pendingConnections.get(endpoint);
  if (pending) {
    console.log("[mcp-skill] Waiting for in-progress connection to:", endpoint);
    return pending;
  }

  // Clean up stale connection if exists
  if (cached) {
    console.log("[mcp-skill] Cached connection expired, creating fresh one");
    try {
      await cached.client.close();
    } catch {
      // Ignore close errors
    }
    clientCache.delete(endpoint);
  }

  // Create the connection promise and store it immediately
  // This ensures any concurrent calls will wait for this same promise
  const connectionPromise = createMcpConnection(endpoint, now);
  pendingConnections.set(endpoint, connectionPromise);

  try {
    const client = await connectionPromise;
    return client;
  } finally {
    // Clean up the pending promise regardless of success/failure
    pendingConnections.delete(endpoint);
  }
}

/**
 * Internal function to actually create the MCP connection
 * Separated from getMcpClient to enable the pending connection pattern
 */
async function createMcpConnection(
  endpoint: string,
  timestamp: number
): Promise<Client> {
  console.log("[mcp-skill] Creating fresh MCP connection to:", endpoint);
  const transportType = detectTransportType(endpoint);

  try {
    const transport = createMcpTransport(endpoint);
    const client = new Client(
      {
        name: "context-protocol",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    console.log(
      "[mcp-skill] Successfully connected via",
      transportType,
      "to:",
      endpoint
    );

    // Cache the connection with timestamp
    clientCache.set(endpoint, { client, createdAt: timestamp });

    return client;
  } catch (error) {
    // If HTTP Streaming fails, try SSE as fallback (for servers that don't support HTTP Streaming)
    if (transportType === "http-streaming") {
      console.log(
        "[mcp-skill] HTTP Streaming failed, trying SSE fallback for:",
        endpoint
      );
      try {
        const sseTransport = new SSEClientTransport(new URL(endpoint));
        const client = new Client(
          { name: "context-protocol", version: "1.0.0" },
          { capabilities: {} }
        );
        await client.connect(sseTransport);
        console.log(
          "[mcp-skill] Successfully connected via SSE fallback to:",
          endpoint
        );
        clientCache.set(endpoint, { client, createdAt: timestamp });
        return client;
      } catch (fallbackError) {
        console.error("[mcp-skill] SSE fallback also failed:", fallbackError);
        // Throw original error for better diagnostics
      }
    }

    console.error(
      "[mcp-skill] Failed to connect to MCP server:",
      endpoint,
      error
    );
    throw error;
  }
}

/**
 * Extract the MCP endpoint from a tool's schema
 */
function extractMcpEndpoint(tool: AITool): string {
  const schema = tool.toolSchema as Record<string, unknown> | null;
  if (!schema || typeof schema !== "object") {
    throw new Error(`Tool ${tool.name} has no schema configured.`);
  }

  const endpoint = schema.endpoint;
  if (typeof endpoint !== "string") {
    throw new Error(`Tool ${tool.name} is missing a valid MCP endpoint.`);
  }

  return endpoint;
}

/**
 * Check if a tool is free (price = 0)
 */
function isFreeTool(tool: AITool): boolean {
  const price = Number(tool.pricePerQuery ?? 0);
  return price === 0;
}

/**
 * Get a human-readable preview of the result for execution progress
 */
function getResultPreview(content: unknown): string {
  if (content === null || content === undefined) {
    return "empty response";
  }

  if (typeof content === "string") {
    return content.length > 50 ? `${content.slice(0, 50)}...` : content;
  }

  if (Array.isArray(content)) {
    return `${content.length} item${content.length !== 1 ? "s" : ""}`;
  }

  if (typeof content === "object") {
    const keys = Object.keys(content);
    // Look for common patterns
    if (
      "chains" in content &&
      Array.isArray((content as Record<string, unknown>).chains)
    ) {
      const chains = (content as Record<string, unknown[]>).chains;
      return `${chains.length} chain${chains.length !== 1 ? "s" : ""}`;
    }
    if (
      "estimates" in content &&
      Array.isArray((content as Record<string, unknown>).estimates)
    ) {
      return "gas estimates";
    }
    if ("error" in content) {
      return `error: ${String((content as Record<string, unknown>).error).slice(0, 30)}`;
    }
    // Generic object
    return `${keys.length} field${keys.length !== 1 ? "s" : ""} (${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""})`;
  }

  return String(content).slice(0, 50);
}

/**
 * Call a skill on an MCP Tool's server
 *
 * This is the execution function for MCP Tools. Users pay once per "Tool" per turn,
 * but the agent can call this skill function up to 100 times within that turn.
 *
 * Auto Mode (Trust Model):
 * - Tools execute IMMEDIATELY (no payment pause)
 * - Usage is TRACKED in autoModeToolsUsed
 * - Payment happens at END via batch transaction
 *
 * @param toolId - The database ID of the MCP Tool (marketplace listing)
 * @param toolName - The name of the specific tool to call on the MCP server
 * @param args - Arguments to pass to the tool
 */
export async function callMcpSkill({
  toolId,
  toolName,
  args,
}: CallMcpSkillParams): Promise<McpSkillResult> {
  const runtime = getSkillRuntime();

  // Look up the tool from the database
  const tool = await getAIToolById({ id: toolId });
  if (!tool) {
    throw new Error(`Tool with ID ${toolId} not found.`);
  }

  // Check if tool is active
  if (!tool.isActive) {
    throw new Error(`Tool ${tool.name} is currently inactive.`);
  }

  // Check payment authorization for paid tools
  const isFree = isFreeTool(tool);

  if (!isFree) {
    // Check if tool is pre-authorized (manual selection with payment)
    const isPreAuthorized = runtime.allowedTools?.has(toolId);

    // Auto Mode phases:
    // - Discovery phase: DON'T execute paid tools, only search
    // - Execution phase: Execute paid tools with verified payment
    const isAutoModeEnabled = runtime.isAutoMode === true;
    const isDiscoveryPhase = runtime.isDiscoveryPhase === true;

    // During discovery phase, reject paid tool execution
    // The AI should only search the marketplace, not execute tools
    if (isDiscoveryPhase) {
      console.log(
        "[mcp-skill] Discovery phase: rejecting paid tool execution",
        {
          toolId,
          toolName: tool.name,
          price: tool.pricePerQuery,
        }
      );
      throw new Error(
        `Tool "${tool.name}" requires payment ($${tool.pricePerQuery}/query). This is the discovery phase - tool will be executed after payment confirmation.`
      );
    }

    if (!isPreAuthorized && !isAutoModeEnabled) {
      throw new Error(
        `Tool "${tool.name}" requires payment ($${tool.pricePerQuery}/query). Please enable it in the sidebar and confirm payment.`
      );
    }

    if (isPreAuthorized) {
      // Pre-authorized tool: use existing context
      const toolContext = runtime.allowedTools?.get(toolId);
      if (!toolContext) {
        throw new Error(`Tool context not found for ${tool.name}.`);
      }

      // Enforce call limit for paid tools
      if (toolContext.executionCount >= MAX_CALLS_PER_TURN) {
        throw new Error(
          `Tool ${tool.name} has reached its limit of ${MAX_CALLS_PER_TURN} calls per turn.`
        );
      }

      toolContext.executionCount++;
    } else if (isAutoModeEnabled) {
      // Auto Mode Execution Phase: Tool is authorized via verified payment
      // Track execution for logging purposes
      if (!runtime.autoModeToolsUsed) {
        runtime.autoModeToolsUsed = new Map();
      }

      // Track this tool usage
      const existing = runtime.autoModeToolsUsed.get(toolId);
      if (existing) {
        existing.callCount++;
        console.log(
          "[mcp-skill] Auto Mode Execution: tool call tracked (repeated)",
          {
            toolId,
            toolName: tool.name,
            callCount: existing.callCount,
          }
        );
      } else {
        runtime.autoModeToolsUsed.set(toolId, { tool, callCount: 1 });
        console.log(
          "[mcp-skill] Auto Mode Execution: tool call tracked (new)",
          {
            toolId,
            toolName: tool.name,
            price: tool.pricePerQuery,
          }
        );
      }
    }
  }

  // Get the MCP endpoint
  const endpoint = extractMcpEndpoint(tool);
  const chatId = runtime.chatId ?? runtime.requestId;

  console.log("[mcp-skill] Calling tool:", {
    toolId,
    toolName,
    args,
    endpoint,
  });

  // Helper to emit execution progress to the UI
  const emitProgress = (
    type: "query" | "result" | "error",
    message: string
  ) => {
    if (runtime.dataStream) {
      runtime.dataStream.write({
        type: "data-executionProgress",
        data: { type, toolName, message, timestamp: Date.now() },
      });
    }
  };

  // Emit query start
  const argsPreview =
    Object.keys(args).length > 0 ? ` with ${Object.keys(args).join(", ")}` : "";
  emitProgress("query", `Querying ${toolName}${argsPreview}...`);

  try {
    // Get or create MCP client
    const client = await getMcpClient(endpoint);

    // Call the tool with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

    try {
      console.log("[mcp-skill] Invoking client.callTool:", toolName);
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      clearTimeout(timeout);
      console.log(
        "[mcp-skill] Raw MCP result:",
        JSON.stringify(result).slice(0, 500)
      );

      // Unwrap MCP result to return clean data to the agent
      // MCP 2025-06-18 spec supports `structuredContent` for typed responses
      // We prefer that over parsing the content array
      const unwrappedContent = unwrapMcpResult(result as McpCallToolResult);
      console.log(
        "[mcp-skill] Unwrapped content:",
        JSON.stringify(unwrappedContent).slice(0, 500)
      );

      // Record to tool call history for agentic reflection
      // This allows the AI to see raw outputs if execution produces suspicious results
      if (!runtime.toolCallHistory) {
        runtime.toolCallHistory = [];
      }
      runtime.toolCallHistory.push({
        toolId,
        toolName,
        args,
        result: unwrappedContent,
        timestamp: Date.now(),
      });

      // Emit result progress - show a preview of what was returned
      const resultPreview = getResultPreview(unwrappedContent);
      emitProgress("result", `${toolName} returned: ${resultPreview}`);

      // Record the query for analytics
      await recordToolQuery({
        toolId,
        userId: runtime.session.user.id,
        chatId,
        amountPaid: isFree ? "0" : tool.pricePerQuery,
        transactionHash: isFree
          ? "free-tool"
          : (runtime.allowedTools?.get(toolId)?.transactionHash ?? "unknown"),
        queryInput: { toolName, args },
        queryOutput: unwrappedContent as Record<string, unknown>,
        status: result.isError ? "failed" : "completed",
      });

      // Return unwrapped content directly so agent code can access it naturally
      // e.g., result.data.chains instead of result.content[0].text
      if (result.isError) {
        emitProgress(
          "error",
          `${toolName} failed: ${typeof unwrappedContent === "string" ? unwrappedContent : "Unknown error"}`
        );
        throw new Error(
          typeof unwrappedContent === "string"
            ? unwrappedContent
            : JSON.stringify(unwrappedContent)
        );
      }

      return unwrappedContent;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[mcp-skill] Tool call failed:", { toolId, toolName, error });

    // Emit error progress
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    emitProgress("error", `${toolName} failed: ${errorMessage.slice(0, 100)}`);

    // Record failed query
    await recordToolQuery({
      toolId,
      userId: runtime.session.user.id,
      chatId,
      amountPaid: isFree ? "0" : tool.pricePerQuery,
      transactionHash: isFree
        ? "free-tool"
        : (runtime.allowedTools?.get(toolId)?.transactionHash ?? "unknown"),
      queryInput: { toolName, args },
      status: "failed",
    });

    const message = error instanceof Error ? error.message : "MCP call failed";
    throw new Error(`MCP tool ${toolName} failed: ${message}`);
  }
}

/**
 * List available tools on an MCP server
 * Useful for discovery and validation during tool registration
 *
 * @param endpoint - The MCP server endpoint URL
 */
export async function listMcpTools(
  endpoint: string
): Promise<
  {
    name: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }[]
> {
  const client = await getMcpClient(endpoint);
  const result = await client.listTools();

  return result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));
}

/**
 * Disconnect and clear all cached MCP clients
 * Should be called during cleanup/shutdown
 */
export async function disconnectAllMcpClients(): Promise<void> {
  for (const [endpoint, cachedClient] of clientCache.entries()) {
    try {
      await cachedClient.client.close();
    } catch (error) {
      console.warn(`Failed to close MCP client for ${endpoint}:`, error);
    }
  }
  clientCache.clear();
}

// ============================================================================
// SELF-HEALING SCHEMA REFRESH SYSTEM
// ============================================================================

/** Cache for schema refresh timestamps (toolId -> lastRefreshedAt) */
const schemaRefreshCache = new Map<string, number>();

/** TTL for schema refresh: 1 hour in milliseconds */
const SCHEMA_REFRESH_TTL_MS = 60 * 60 * 1000;

/**
 * Check if a tool's schema needs refreshing based on TTL
 */
function needsSchemaRefresh(toolId: string): boolean {
  const lastRefresh = schemaRefreshCache.get(toolId);
  if (!lastRefresh) return true;
  return Date.now() - lastRefresh > SCHEMA_REFRESH_TTL_MS;
}

/**
 * Refresh the schema for a single MCP tool from its server
 * This is the self-healing mechanism that keeps schemas up-to-date
 *
 * @param tool - The AITool to refresh
 * @returns true if schema was updated, false if unchanged or failed
 */
export async function refreshMcpToolSchema(tool: AITool): Promise<boolean> {
  const schema = tool.toolSchema as Record<string, unknown> | null;
  if (!schema || schema.kind !== "mcp") {
    return false;
  }

  const endpoint = schema.endpoint as string;
  if (!endpoint) {
    console.warn(`[mcp-refresh] Tool ${tool.id} has no endpoint`);
    return false;
  }

  try {
    console.log(
      `[mcp-refresh] Refreshing schema for ${tool.name} from ${endpoint}`
    );

    const freshTools = await listMcpTools(endpoint);

    if (!freshTools || freshTools.length === 0) {
      console.warn(`[mcp-refresh] No tools found at ${endpoint}`);
      return false;
    }

    // Check if schema has changed by comparing tool names and schemas
    const existingTools = schema.tools as unknown[] | undefined;
    const existingJson = JSON.stringify(existingTools || []);
    const freshJson = JSON.stringify(freshTools);

    if (existingJson === freshJson) {
      console.log(`[mcp-refresh] Schema unchanged for ${tool.name}`);
      schemaRefreshCache.set(tool.id, Date.now());
      return false;
    }

    // Schema has changed - update the database
    console.log(
      `[mcp-refresh] Schema changed for ${tool.name}, updating database`
    );

    const updatedSchema = {
      ...schema,
      tools: freshTools,
    };

    await updateAIToolSchema({
      id: tool.id,
      toolSchema: updatedSchema,
    });

    // Regenerate embedding with updated schema info
    try {
      const searchText = buildSearchText({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        toolSchema: updatedSchema,
      });
      const embedding = await generateEmbedding(searchText);
      await updateAIToolEmbedding({
        id: tool.id,
        searchText,
        embedding,
      });
      console.log(`[mcp-refresh] Regenerated embedding for ${tool.name}`);
    } catch (embeddingError) {
      // Log but don't fail if embedding regeneration fails
      console.warn(
        `[mcp-refresh] Failed to regenerate embedding for ${tool.name}:`,
        embeddingError
      );
    }

    schemaRefreshCache.set(tool.id, Date.now());
    console.log(`[mcp-refresh] Successfully updated schema for ${tool.name}`);
    return true;
  } catch (error) {
    console.error(
      `[mcp-refresh] Failed to refresh schema for ${tool.name}:`,
      error
    );
    // Don't throw - schema refresh failures shouldn't break the chat
    return false;
  }
}

/**
 * Refresh schemas for multiple MCP tools if they need it (based on TTL)
 * Called at the start of chat sessions to ensure fresh schemas
 *
 * @param tools - Array of AITools to potentially refresh
 * @returns Number of tools that were refreshed
 */
export async function refreshMcpToolSchemasIfNeeded(
  tools: AITool[]
): Promise<number> {
  const mcpTools = tools.filter((t) => {
    const schema = t.toolSchema as Record<string, unknown> | null;
    return schema?.kind === "mcp";
  });

  if (mcpTools.length === 0) {
    return 0;
  }

  const toolsNeedingRefresh = mcpTools.filter((t) => needsSchemaRefresh(t.id));

  if (toolsNeedingRefresh.length === 0) {
    console.log(
      `[mcp-refresh] All ${mcpTools.length} MCP tools have fresh schemas`
    );
    return 0;
  }

  console.log(
    `[mcp-refresh] Refreshing ${toolsNeedingRefresh.length}/${mcpTools.length} MCP tool schemas`
  );

  // Refresh in parallel with a concurrency limit
  const results = await Promise.allSettled(
    toolsNeedingRefresh.map((tool) => refreshMcpToolSchema(tool))
  );

  const refreshedCount = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;

  console.log(`[mcp-refresh] Refreshed ${refreshedCount} tool schemas`);
  return refreshedCount;
}
