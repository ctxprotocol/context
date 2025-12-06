import { NextResponse } from "next/server";
import { eq, and, desc, lt, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { aiTool, chat, message, toolQuery } from "@/lib/db/schema";

// biome-ignore lint/style/noNonNullAssertion: env validation happens at startup
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * GET /api/chat/[id]/tools
 *
 * Fetches tools used in a chat session, filtered by message if provided.
 * - Tool details (name, price)
 * - Transaction hash (for dispute filing)
 * - Query output (for schema validation context)
 *
 * Query params:
 * - messageId: Filter to tools executed for this specific message's turn
 *
 * This endpoint is used by the Report Tool modal to show users
 * which tools were used and allow them to file disputes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: chatId } = await params;
  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId");

  // Verify the chat belongs to the user
  const [chatRecord] = await db
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRecord) {
    return NextResponse.json(
      { error: "Chat not found or access denied" },
      { status: 404 }
    );
  }

  // Build the query conditions
  let queryConditions = eq(toolQuery.chatId, chatId);

  // If messageId is provided, filter to tools executed for that message's turn
  // We use timestamp-based filtering since ToolQuery doesn't have messageId yet
  if (messageId) {
    // Get the target message and the previous assistant message
    const messages = await db
      .select({ id: message.id, createdAt: message.createdAt, role: message.role })
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(message.createdAt);

    const targetIndex = messages.findIndex((m) => m.id === messageId);

    if (targetIndex !== -1) {
      const targetMessage = messages[targetIndex];

      // Find the previous assistant message (start of this turn)
      let previousAssistantTime: Date | null = null;
      for (let i = targetIndex - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          previousAssistantTime = messages[i].createdAt;
          break;
        }
      }

      // Filter tools executed between previous assistant message and this message
      const endTime = new Date(targetMessage.createdAt.getTime() + 60000); // +1 min buffer
      if (previousAssistantTime) {
        queryConditions = and(
          eq(toolQuery.chatId, chatId),
          gte(toolQuery.executedAt, previousAssistantTime),
          lt(toolQuery.executedAt, endTime)
        )!;
      } else {
        // First turn - filter tools before this message
        queryConditions = and(
          eq(toolQuery.chatId, chatId),
          lt(toolQuery.executedAt, endTime)
        )!;
      }
    }
  }

  // Fetch tool queries with the appropriate filter
  const toolQueries = await db
    .select({
      id: toolQuery.id,
      toolId: toolQuery.toolId,
      transactionHash: toolQuery.transactionHash,
      amountPaid: toolQuery.amountPaid,
      status: toolQuery.status,
      queryOutput: toolQuery.queryOutput,
      executedAt: toolQuery.executedAt,
      // Join tool details
      toolName: aiTool.name,
      toolCategory: aiTool.category,
      toolSchema: aiTool.toolSchema,
    })
    .from(toolQuery)
    .innerJoin(aiTool, eq(toolQuery.toolId, aiTool.id))
    .where(queryConditions)
    .orderBy(desc(toolQuery.executedAt));

  // Group by transaction hash (since multiple tools share one tx)
  const transactionGroups = new Map<
    string,
    {
      transactionHash: string;
      totalPaid: number;
      executedAt: Date;
      tools: Array<{
        queryId: string;
        toolId: string;
        toolName: string;
        toolCategory: string | null;
        amountPaid: string;
        status: string;
        hasOutput: boolean;
      }>;
    }
  >();

  for (const query of toolQueries) {
    const txHash = query.transactionHash;

    if (!transactionGroups.has(txHash)) {
      transactionGroups.set(txHash, {
        transactionHash: txHash,
        totalPaid: 0,
        executedAt: query.executedAt,
        tools: [],
      });
    }

    const group = transactionGroups.get(txHash);
    if (group) {
      group.totalPaid += Number.parseFloat(query.amountPaid);
      group.tools.push({
        queryId: query.id,
        toolId: query.toolId,
        toolName: query.toolName,
        toolCategory: query.toolCategory,
        amountPaid: query.amountPaid,
        status: query.status,
        hasOutput: query.queryOutput !== null,
      });
    }
  }

  return NextResponse.json({
    chatId,
    transactions: [...transactionGroups.values()].map((group) => ({
      ...group,
      totalPaid: group.totalPaid.toFixed(6),
    })),
    totalQueries: toolQueries.length,
  });
}

