"use server";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getAIToolsByDeveloper,
  updateAITool,
  updateAIToolStatus,
} from "@/lib/db/queries";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type EditToolState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type RefreshToolState = {
  status: "idle" | "success" | "error";
  message?: string;
  skillCount?: number;
  previousCount?: number;
};

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const editToolSchema = z.object({
  toolId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().min(1, "Description is required").max(5000),
  category: z.string().optional(),
  pricePerQuery: z.string().regex(/^\d+\.?\d*$/, "Invalid price format"),
});

// ─────────────────────────────────────────────────────────
// MCP Connection Helper (reused from contribute/actions.ts)
// ─────────────────────────────────────────────────────────

function detectTransportType(endpoint: string): "sse" | "http-streaming" {
  const url = new URL(endpoint);
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith("/sse") || pathname.includes("sse")) {
    return "sse";
  }
  return "http-streaming";
}

async function connectAndListTools(endpoint: string): Promise<{
  client: Client;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }>;
}> {
  const url = new URL(endpoint);
  const transportType = detectTransportType(endpoint);

  const primaryTransport =
    transportType === "sse"
      ? new SSEClientTransport(url)
      : new StreamableHTTPClientTransport(url);

  const client = new Client(
    { name: "context-refresh", version: "1.0.0" },
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
    };
  } catch (primaryError) {
    if (transportType === "http-streaming") {
      const fallbackClient = new Client(
        { name: "context-refresh", version: "1.0.0" },
        { capabilities: {} }
      );
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
      };
    }
    throw primaryError;
  }
}

// ─────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────

/**
 * Edit tool metadata (name, description, category, price)
 * Automatically regenerates embedding after update
 */
export async function editTool(
  _prevState: EditToolState,
  formData: FormData
): Promise<EditToolState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Not authenticated" };
  }

  const raw = {
    toolId: formData.get("toolId"),
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    pricePerQuery: formData.get("pricePerQuery"),
  };

  const parsed = editToolSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.at(0);
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { status: "error", message: "Please correct the errors", fieldErrors };
  }

  // Verify ownership
  const userTools = await getAIToolsByDeveloper({ developerId: session.user.id });
  const tool = userTools.find((t) => t.id === parsed.data.toolId);
  if (!tool) {
    return { status: "error", message: "Tool not found or you don't own it" };
  }

  try {
    await updateAITool({
      id: parsed.data.toolId,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category ?? null,
      pricePerQuery: parsed.data.pricePerQuery,
    });

    revalidatePath("/developer/tools");
    revalidatePath("/chat");

    return { status: "success", message: "Tool updated successfully" };
  } catch {
    return { status: "error", message: "Failed to update tool" };
  }
}

/**
 * Refresh MCP tool skills by re-connecting to the MCP server
 * Automatically regenerates embedding with new skill names/descriptions
 */
export async function refreshMCPSkills(toolId: string): Promise<RefreshToolState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Not authenticated" };
  }

  // Verify ownership
  const userTools = await getAIToolsByDeveloper({ developerId: session.user.id });
  const tool = userTools.find((t) => t.id === toolId);
  if (!tool) {
    return { status: "error", message: "Tool not found or you don't own it" };
  }

  // Check if it's an MCP tool
  const schema = tool.toolSchema as { kind?: string; endpoint?: string; tools?: unknown[] } | null;
  if (!schema || schema.kind !== "mcp" || !schema.endpoint) {
    return { status: "error", message: "This is not an MCP tool" };
  }

  const previousCount = schema.tools?.length ?? 0;

  try {
    // Connect to MCP server and list tools
    const { client, tools } = await connectAndListTools(schema.endpoint);

    // Close client gracefully - SSE connections throw AbortError on close, which is expected
    client.close().catch(() => {
      // Silently ignore - AbortError is expected when closing SSE connections
    });

    if (!tools || tools.length === 0) {
      return {
        status: "error",
        message: "No tools found on MCP server. Is it running?",
      };
    }

    // Update toolSchema with new tools array (this also regenerates embedding)
    const newToolSchema = {
      ...schema,
      tools,
    };

    await updateAITool({
      id: toolId,
      toolSchema: newToolSchema,
    });

    revalidatePath("/developer/tools");
    revalidatePath("/chat");

    return {
      status: "success",
      message: `Refreshed! Found ${tools.length} skills (was ${previousCount})`,
      skillCount: tools.length,
      previousCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: "error",
      message: `Could not connect to MCP server: ${message}`,
    };
  }
}

/**
 * Toggle tool active/inactive status
 */
export async function toggleToolStatus(
  toolId: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  // Verify ownership
  const userTools = await getAIToolsByDeveloper({ developerId: session.user.id });
  const tool = userTools.find((t) => t.id === toolId);
  if (!tool) {
    return { success: false, message: "Tool not found or you don't own it" };
  }

  try {
    await updateAIToolStatus({ id: toolId, isActive });
    revalidatePath("/developer/tools");
    revalidatePath("/chat");
    return {
      success: true,
      message: isActive ? "Tool activated" : "Tool deactivated",
    };
  } catch {
    return { success: false, message: "Failed to update status" };
  }
}

