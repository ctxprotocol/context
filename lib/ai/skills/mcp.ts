import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getSkillRuntime } from "@/lib/ai/skills/runtime";
import { getAIToolById, recordToolQuery } from "@/lib/db/queries";
import type { AITool } from "@/lib/db/schema";

/**
 * MCP Client Skill
 *
 * This module provides the ability to call tools on remote MCP servers.
 * It replaces the old HTTP tool pattern with the standard MCP protocol.
 *
 * Key differences from callHttpSkill:
 * - Uses MCP's JSON-RPC protocol over SSE transport
 * - Tool discovery is built-in (listTools)
 * - Supports free tools (price = 0) without payment flow
 */

type CallMcpToolParams = {
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
};

type McpToolResult = {
  content: unknown;
  isError?: boolean;
};

const MCP_TIMEOUT_MS = 30_000;
const MAX_CALLS_PER_TURN = 100;

// Cache MCP clients per endpoint to avoid reconnecting on every call
const clientCache = new Map<string, Client>();

/**
 * Get or create an MCP client for the given endpoint
 */
async function getMcpClient(endpoint: string): Promise<Client> {
  const cached = clientCache.get(endpoint);
  if (cached) {
    return cached;
  }

  const transport = new SSEClientTransport(new URL(endpoint));
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
  clientCache.set(endpoint, client);

  return client;
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
 * Call a tool on an MCP server
 *
 * @param toolId - The database ID of the tool (used to look up endpoint and billing)
 * @param toolName - The name of the specific tool to call on the MCP server
 * @param args - Arguments to pass to the tool
 */
export async function callMcpTool({
  toolId,
  toolName,
  args,
}: CallMcpToolParams): Promise<McpToolResult> {
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
    // For paid tools, check if it's in the allowed tools map
    if (!runtime.allowedTools?.has(toolId)) {
      throw new Error(
        `Tool "${tool.name}" requires payment ($${tool.pricePerQuery}/query). Please enable it in the sidebar and confirm payment.`
      );
    }

    const toolContext = runtime.allowedTools.get(toolId);
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
  }

  // Get the MCP endpoint
  const endpoint = extractMcpEndpoint(tool);
  const chatId = runtime.chatId ?? runtime.requestId;

  try {
    // Get or create MCP client
    const client = await getMcpClient(endpoint);

    // Call the tool with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      clearTimeout(timeout);

      // Record the query for analytics
      await recordToolQuery({
        toolId,
        userId: runtime.session.user.id,
        chatId,
        amountPaid: isFree ? "0" : tool.pricePerQuery,
        transactionHash: isFree
          ? "free-tool"
          : runtime.allowedTools?.get(toolId)?.transactionHash ?? "unknown",
        queryInput: { toolName, args },
        queryOutput: result.content as Record<string, unknown>,
        status: result.isError ? "failed" : "completed",
      });

      return {
        content: result.content,
        isError: result.isError,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    // Record failed query
    await recordToolQuery({
      toolId,
      userId: runtime.session.user.id,
      chatId,
      amountPaid: isFree ? "0" : tool.pricePerQuery,
      transactionHash: isFree
        ? "free-tool"
        : runtime.allowedTools?.get(toolId)?.transactionHash ?? "unknown",
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
): Promise<{ name: string; description?: string; inputSchema?: unknown }[]> {
  const client = await getMcpClient(endpoint);
  const result = await client.listTools();

  return result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Disconnect and clear all cached MCP clients
 * Should be called during cleanup/shutdown
 */
export async function disconnectAllMcpClients(): Promise<void> {
  for (const [endpoint, client] of clientCache.entries()) {
    try {
      await client.close();
    } catch (error) {
      console.warn(`Failed to close MCP client for ${endpoint}:`, error);
    }
  }
  clientCache.clear();
}

