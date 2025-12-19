import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildSearchText, generateEmbedding } from "@/lib/ai/embeddings";
import { getSkillRuntime } from "@/lib/ai/skills/runtime";
import { generateServiceToken } from "@/lib/auth/service-auth";
import { buildHyperliquidContext } from "@/lib/context/hyperliquid";
import { buildPolymarketContext } from "@/lib/context/polymarket";
import {
  getAIToolById,
  recordToolQuery,
  updateAIToolEmbedding,
  updateAIToolSchema,
} from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";
import { getLinkedWalletsForUser } from "@/lib/privy";
import type { ContextRequirementType } from "@/lib/types";

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

// Regex for stripping markdown code blocks (defined at top level for performance)
const CODE_BLOCK_STRIP_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/;

// =============================================================================
// RATE LIMITING: Prevent AI-generated loops from hitting external rate limits
// =============================================================================

/**
 * Minimum delay between calls to the same endpoint (per-endpoint throttling)
 * This prevents AI-generated code from firing requests too fast in loops.
 *
 * Set to 200ms = max 5 requests/second per endpoint, which is safe for most APIs.
 * Can be tuned per-endpoint if needed in the future.
 */
const MIN_CALL_INTERVAL_MS = 200;

/**
 * Track last call timestamp per endpoint for throttling
 * Key: endpoint URL, Value: timestamp of last call
 */
const lastCallTimestamp = new Map<string, number>();

/**
 * Pending throttle promises per endpoint (to serialize calls)
 * Prevents race conditions when multiple parallel calls try to throttle
 */
const pendingThrottles = new Map<string, Promise<void>>();

/**
 * Throttle calls to an endpoint to prevent rate limiting
 * Uses a serialized queue approach - each call waits for the previous one's throttle
 *
 * @param endpoint - The MCP endpoint URL
 * @returns Promise that resolves when it's safe to make the call
 */
async function throttleEndpointCall(endpoint: string): Promise<void> {
  // Wait for any pending throttle on this endpoint first
  const pending = pendingThrottles.get(endpoint);
  if (pending) {
    await pending;
  }

  const now = Date.now();
  const lastCall = lastCallTimestamp.get(endpoint) ?? 0;
  const elapsed = now - lastCall;
  const waitTime = Math.max(0, MIN_CALL_INTERVAL_MS - elapsed);

  if (waitTime > 0) {
    console.log("[mcp-skill] Throttling call to prevent rate limit:", {
      endpoint: endpoint.slice(0, 50),
      waitMs: waitTime,
      callsPerSecond: Math.round(1000 / MIN_CALL_INTERVAL_MS),
    });

    // Create a promise for this throttle and store it
    const throttlePromise = sleep(waitTime);
    pendingThrottles.set(endpoint, throttlePromise);

    await throttlePromise;

    // Clean up
    pendingThrottles.delete(endpoint);
  }

  // Update timestamp BEFORE the call (optimistic)
  lastCallTimestamp.set(endpoint, Date.now());
}

// Retry configuration for resilient API calls
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500, // Start with 500ms delay
  maxDelayMs: 10_000, // Cap at 10 seconds
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "socket hang up",
    "network",
    "timeout",
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Check if an error is retryable (transient network/rate limit errors)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Check for known retryable error patterns
  for (const pattern of RETRY_CONFIG.retryableErrors) {
    if (message.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for HTTP status codes in error message
  for (const code of RETRY_CONFIG.retryableStatusCodes) {
    if (message.includes(`${code}`) || message.includes(`status ${code}`)) {
      return true;
    }
  }

  // Rate limit specific patterns
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("throttl")
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * 2 ** attempt;
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delay = Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
  return Math.round(delay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get context requirements for a specific tool from the tool schema.
 * Reads from _meta.contextRequirements in the MCP tool definition.
 */
function getToolContextRequirements(
  toolSchema: Record<string, unknown> | null,
  toolName: string
): ContextRequirementType[] {
  if (!toolSchema || toolSchema.kind !== "mcp") {
    console.log("[mcp-skill] getToolContextRequirements: no valid schema", {
      hasSchema: Boolean(toolSchema),
      kind: toolSchema?.kind,
    });
    return [];
  }

  const tools = toolSchema.tools as
    | Array<{
        name: string;
        _meta?: { contextRequirements?: string[] };
      }>
    | undefined;

  if (!tools || !Array.isArray(tools)) {
    console.log("[mcp-skill] getToolContextRequirements: no tools array");
    return [];
  }

  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    console.log("[mcp-skill] getToolContextRequirements: tool not found", {
      toolName,
      availableTools: tools.map((t) => t.name).slice(0, 5),
    });
    return [];
  }

  const requirements = tool._meta?.contextRequirements;
  console.log("[mcp-skill] getToolContextRequirements: found tool", {
    toolName,
    hasMeta: Boolean(tool._meta),
    requirements,
  });

  if (!Array.isArray(requirements)) {
    return [];
  }

  return requirements.filter(
    (r): r is ContextRequirementType =>
      r === "polymarket" || r === "hyperliquid" || r === "wallet"
  );
}

/**
 * Inject portfolio context into tool arguments based on context requirements.
 * Fetches the user's linked wallet data and builds the appropriate context.
 */
async function injectContextIfNeeded(
  args: Record<string, unknown>,
  requirements: ContextRequirementType[],
  privyDid: string
): Promise<Record<string, unknown>> {
  if (requirements.length === 0) {
    return args;
  }

  // Get user's linked wallets
  const linkedWallets = await getLinkedWalletsForUser(privyDid);

  if (linkedWallets.length === 0) {
    console.log("[mcp-skill] Context injection: no linked wallets found");
    return args;
  }

  console.log("[mcp-skill] Context injection: building context", {
    requirements,
    walletCount: linkedWallets.length,
  });

  // Build context based on requirements
  const injectedArgs = { ...args };

  for (const requirement of requirements) {
    if (requirement === "polymarket") {
      const polymarketContext = await buildPolymarketContext(linkedWallets);
      injectedArgs.portfolio = polymarketContext;
      console.log(
        "[mcp-skill] Context injection: Polymarket context injected",
        {
          walletAddress: polymarketContext.walletAddress,
          positionCount: polymarketContext.positions?.length ?? 0,
        }
      );
    } else if (requirement === "hyperliquid") {
      const hyperliquidContext = await buildHyperliquidContext(linkedWallets);
      injectedArgs.portfolio = hyperliquidContext;
      console.log(
        "[mcp-skill] Context injection: Hyperliquid context injected",
        {
          walletAddress: hyperliquidContext.walletAddress,
          positionCount: hyperliquidContext.perpPositions?.length ?? 0,
        }
      );
    } else if (requirement === "wallet") {
      // Generic wallet context - just pass the addresses
      injectedArgs.walletAddresses = linkedWallets;
      console.log("[mcp-skill] Context injection: wallet addresses injected", {
        walletCount: linkedWallets.length,
      });
    }
  }

  return injectedArgs;
}

// Connection cache TTL - connections are reused within this window
// Set to 2 minutes to outlast the MCP SDK's 60-second internal timeout
const CONNECTION_CACHE_TTL_MS = 120_000; // 2 minutes

// Authenticated connection cache TTL - shorter to account for token expiry
// Service tokens expire in 2 minutes, so we use 90 seconds to be safe
const AUTH_CONNECTION_CACHE_TTL_MS = 90_000; // 90 seconds

// Cache MCP clients per endpoint with TTL to avoid reconnecting on every call
type CachedClient = {
  client: Client;
  createdAt: number;
};
const clientCache = new Map<string, CachedClient>();

// Separate cache for authenticated connections (prevents token/connection mismatch)
const authClientCache = new Map<string, CachedClient>();

// Pending connection promises to prevent race conditions
// When multiple parallel calls try to connect to the same endpoint simultaneously,
// the first call creates the connection and all others wait for the same promise
const pendingConnections = new Map<string, Promise<Client>>();

// Separate pending connections for authenticated requests
const pendingAuthConnections = new Map<string, Promise<Client>>();

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
  const match = CODE_BLOCK_STRIP_REGEX.exec(text);
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
 * Headers to inject into MCP transport requests
 */
type McpTransportHeaders = Record<string, string>;

/**
 * Create the appropriate MCP transport based on endpoint URL
 * @param endpoint - The MCP server endpoint URL
 * @param headers - Optional headers to inject (e.g., Authorization)
 */
function createMcpTransport(
  endpoint: string,
  headers?: McpTransportHeaders
): SSEClientTransport | StreamableHTTPClientTransport {
  const url = new URL(endpoint);
  const transportType = detectTransportType(endpoint);

  if (transportType === "sse") {
    console.log("[mcp-skill] Using SSE transport for:", endpoint);
    // SSE transport: headers go in requestInit (for the initial HTTP request)
    // eventSourceInit is for EventSource options like credentials, not headers
    return new SSEClientTransport(url, {
      requestInit: headers ? { headers } : undefined,
    });
  }

  console.log("[mcp-skill] Using HTTP Streaming transport for:", endpoint);
  // HTTP Streaming transport accepts requestInit with headers
  return new StreamableHTTPClientTransport(url, {
    requestInit: headers ? { headers } : undefined,
  });
}

/**
 * Get or create an MCP client for the given endpoint
 * Uses TTL-based caching to reuse connections within a code execution
 * while still ensuring connections don't become stale across requests.
 *
 * Auto-detects transport type (SSE vs HTTP Streaming) based on endpoint URL.
 *
 * IMPORTANT: Uses a pending connection pattern to prevent race conditions.
 * When multiple parallel calls try to connect to the same endpoint simultaneously,
 * only the first call actually creates the connection - all others wait for it.
 *
 * PERFORMANCE: Authenticated connections are now cached (90s TTL) to prevent
 * overwhelming MCP servers with connection requests. Service tokens are valid
 * for 2 minutes, so 90s cache is safe.
 *
 * @param endpoint - The MCP server endpoint URL
 * @param headers - Optional headers to inject (uses separate cache with shorter TTL)
 */
async function getMcpClient(
  endpoint: string,
  headers?: McpTransportHeaders
): Promise<Client> {
  const now = Date.now();

  // Authenticated requests: use separate cache with shorter TTL
  if (headers) {
    const authCached = authClientCache.get(endpoint);

    // Check if we have a valid cached authenticated connection
    if (
      authCached &&
      now - authCached.createdAt < AUTH_CONNECTION_CACHE_TTL_MS
    ) {
      console.log(
        "[mcp-skill] Reusing cached authenticated connection to:",
        endpoint
      );
      return authCached.client;
    }

    // Check if there's already an authenticated connection in progress
    const pendingAuth = pendingAuthConnections.get(endpoint);
    if (pendingAuth) {
      console.log(
        "[mcp-skill] Waiting for in-progress authenticated connection to:",
        endpoint
      );
      return pendingAuth;
    }

    // Clean up stale authenticated connection if exists
    if (authCached) {
      console.log(
        "[mcp-skill] Authenticated connection expired, creating fresh one"
      );
      try {
        await authCached.client.close();
      } catch {
        // Ignore close errors
      }
      authClientCache.delete(endpoint);
    }

    // Create authenticated connection with pending pattern
    console.log("[mcp-skill] Creating authenticated connection to:", endpoint);
    const authConnectionPromise = createMcpConnection(endpoint, now, headers);
    pendingAuthConnections.set(endpoint, authConnectionPromise);

    try {
      const client = await authConnectionPromise;
      return client;
    } finally {
      pendingAuthConnections.delete(endpoint);
    }
  }

  // Unauthenticated requests: use main cache
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
 *
 * @param endpoint - The MCP server endpoint URL
 * @param timestamp - Timestamp for cache TTL tracking
 * @param headers - Optional headers to inject (for authenticated requests)
 */
async function createMcpConnection(
  endpoint: string,
  timestamp: number,
  headers?: McpTransportHeaders
): Promise<Client> {
  console.log("[mcp-skill] Creating fresh MCP connection to:", endpoint);
  const transportType = detectTransportType(endpoint);
  const isAuthenticated = Boolean(headers);

  try {
    const transport = createMcpTransport(endpoint, headers);
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
      endpoint,
      isAuthenticated ? "(authenticated)" : ""
    );

    // Cache the connection in the appropriate cache
    if (isAuthenticated) {
      // Cache authenticated connections with shorter TTL (90s)
      authClientCache.set(endpoint, { client, createdAt: timestamp });
    } else {
      // Cache unauthenticated connections with standard TTL (2 min)
      clientCache.set(endpoint, { client, createdAt: timestamp });
    }

    return client;
  } catch (error) {
    // If HTTP Streaming fails, try SSE as fallback (for servers that don't support HTTP Streaming)
    if (transportType === "http-streaming") {
      console.log(
        "[mcp-skill] HTTP Streaming failed, trying SSE fallback for:",
        endpoint
      );
      try {
        const sseTransport = new SSEClientTransport(new URL(endpoint), {
          requestInit: headers ? { headers } : undefined,
        });
        const client = new Client(
          { name: "context-protocol", version: "1.0.0" },
          { capabilities: {} }
        );
        await client.connect(sseTransport);
        console.log(
          "[mcp-skill] Successfully connected via SSE fallback to:",
          endpoint
        );
        if (!isAuthenticated) {
          clientCache.set(endpoint, { client, createdAt: timestamp });
        }
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
  // Debug: Entry logging to confirm function is being called
  console.log("[mcp-skill] ========== callMcpSkill ENTRY ==========");
  console.log("[mcp-skill] toolId:", toolId);
  console.log("[mcp-skill] toolName:", toolName);
  console.log("[mcp-skill] args keys:", Object.keys(args ?? {}));
  console.log(
    "[mcp-skill] args.portfolio exists:",
    Boolean((args as Record<string, unknown>)?.portfolio)
  );

  const runtime = getSkillRuntime();

  // Debug: Runtime state
  console.log("[mcp-skill] runtime check:", {
    hasRuntime: Boolean(runtime),
    hasSession: Boolean(runtime?.session),
    hasUser: Boolean(runtime?.session?.user),
    userKeys: runtime?.session?.user ? Object.keys(runtime.session.user) : [],
    privyDid: runtime?.session?.user?.privyDid
      ? `${runtime.session.user.privyDid.slice(0, 25)}...`
      : "UNDEFINED",
    isAutoMode: runtime?.isAutoMode,
    isDiscoveryPhase: runtime?.isDiscoveryPhase,
  });

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

      // Track this tool usage and enforce call limit
      const existing = runtime.autoModeToolsUsed.get(toolId);
      if (existing) {
        // Enforce call limit to prevent runaway loops
        if (existing.callCount >= MAX_CALLS_PER_TURN) {
          throw new Error(
            `Tool ${tool.name} has reached its limit of ${MAX_CALLS_PER_TURN} calls per turn. Consider batching your requests or using a different approach.`
          );
        }
        existing.callCount++;
        console.log(
          "[mcp-skill] Auto Mode Execution: tool call tracked (repeated)",
          {
            toolId,
            toolName: tool.name,
            callCount: existing.callCount,
            maxCalls: MAX_CALLS_PER_TURN,
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

  // Check for context requirements and inject portfolio data if needed
  const contextRequirements = getToolContextRequirements(
    tool.toolSchema as Record<string, unknown> | null,
    toolName
  );

  // Debug: Log context injection decision
  console.log("[mcp-skill] Context injection check:", {
    toolName,
    hasToolSchema: Boolean(tool.toolSchema),
    contextRequirements,
    hasPrivyDid: Boolean(runtime.session?.user?.privyDid),
    privyDid: runtime.session?.user?.privyDid
      ? `${runtime.session.user.privyDid.slice(0, 20)}...`
      : "undefined",
  });

  let finalArgs = args;
  if (contextRequirements.length > 0 && runtime.session?.user?.privyDid) {
    console.log("[mcp-skill] Tool requires context injection:", {
      toolName,
      requirements: contextRequirements,
    });

    finalArgs = await injectContextIfNeeded(
      args,
      contextRequirements,
      runtime.session.user.privyDid
    );
  } else if (contextRequirements.length > 0) {
    console.warn(
      "[mcp-skill] Context injection SKIPPED - no privyDid in session:",
      {
        toolName,
        requirements: contextRequirements,
        sessionUser: runtime.session?.user
          ? Object.keys(runtime.session.user)
          : "no user",
      }
    );
  }

  console.log("[mcp-skill] Calling tool:", {
    toolId,
    toolName,
    args: finalArgs,
    endpoint,
    contextInjected: contextRequirements.length > 0,
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

  // Throttle calls to prevent AI-generated loops from hitting rate limits
  // This ensures minimum delay between calls to the same endpoint
  await throttleEndpointCall(endpoint);

  // Generate service token for authentication (RS256 signed JWT)
  // This authenticates the Context Platform to the MCP tool server
  const serviceToken = await generateServiceToken(toolId, endpoint);
  const authHeaders: McpTransportHeaders | undefined = serviceToken
    ? {
        Authorization: `Bearer ${serviceToken}`,
        ...(runtime.requestId && { "X-Context-Request-Id": runtime.requestId }),
      }
    : undefined;

  if (serviceToken) {
    console.log(
      "[mcp-skill] Service token generated for authenticated request"
    );
  }

  // Retry loop for resilient API calls
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Get or create MCP client (may need fresh connection on retry)
      // Authenticated requests bypass caching for token freshness
      const client = await getMcpClient(endpoint, authHeaders);

      // Call the tool with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

      try {
        if (attempt > 0) {
          console.log("[mcp-skill] Retry attempt:", {
            toolName,
            attempt,
            maxRetries: RETRY_CONFIG.maxRetries,
          });
          emitProgress(
            "query",
            `Retrying ${toolName} (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1})...`
          );
        }

        console.log("[mcp-skill] Invoking client.callTool:", toolName);
        const result = await client.callTool({
          name: toolName,
          arguments: finalArgs,
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
          args: finalArgs,
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
          queryInput: { toolName, args: finalArgs },
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

        // Success! Log if this was a retry that worked
        if (attempt > 0) {
          console.log("[mcp-skill] Retry succeeded:", {
            toolName,
            attempt,
          });
        }

        return unwrappedContent;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error("[mcp-skill] Tool call failed:", {
        toolId,
        toolName,
        attempt,
        error: lastError.message,
        isRetryable: isRetryableError(lastError),
      });

      // Check if we should retry
      const canRetry =
        attempt < RETRY_CONFIG.maxRetries && isRetryableError(lastError);

      if (canRetry) {
        const delay = calculateBackoffDelay(attempt);
        console.log("[mcp-skill] Will retry after backoff:", {
          toolName,
          attempt,
          delayMs: delay,
          nextAttempt: attempt + 1,
        });

        // Clear potentially stale connection before retry
        const cached = clientCache.get(endpoint);
        if (cached) {
          try {
            await cached.client.close();
          } catch {
            // Ignore close errors
          }
          clientCache.delete(endpoint);
        }

        await sleep(delay);
        continue; // Retry
      }

      // No more retries - emit error and record failure
      const errorMessage = lastError.message;
      emitProgress(
        "error",
        `${toolName} failed: ${errorMessage.slice(0, 100)}`
      );

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

      throw new Error(`MCP tool ${toolName} failed: ${errorMessage}`);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error(`MCP tool ${toolName} failed after retries`);
}

/**
 * List available tools on an MCP server
 * Useful for discovery and validation during tool registration
 *
 * @param endpoint - The MCP server endpoint URL
 */
export async function listMcpTools(endpoint: string): Promise<
  {
    name: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    /** MCP spec _meta field for arbitrary tool metadata like contextRequirements */
    _meta?: {
      contextRequirements?: string[];
      [key: string]: unknown;
    };
  }[]
> {
  const client = await getMcpClient(endpoint);
  const result = await client.listTools();

  return result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    // CRITICAL: Include _meta field for context injection (e.g., contextRequirements: ["polymarket"])
    // Without this, getToolContextRequirements() returns empty and portfolio data isn't injected
    _meta: (
      tool as {
        _meta?: { contextRequirements?: string[]; [key: string]: unknown };
      }
    )._meta,
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
  if (!lastRefresh) {
    return true;
  }
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
