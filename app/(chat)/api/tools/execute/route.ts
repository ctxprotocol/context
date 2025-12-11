import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { trackEngagementEvent } from "@/lib/db/queries";
import { runPaidSkillWithAuth } from "@/lib/tools/run-paid-skill";

const executeToolSchema = z.object({
  toolId: z.string().uuid(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chatId: z.string().uuid().optional(),
  code: z.string().min(1),
});

/**
 * POST /api/tools/execute
 *
 * Execute a paid tool after payment verification.
 *
 * Protocol Ledger: Tracks TOOL_VIEW events for TGE allocation.
 * (The actual query is tracked in recordToolQuery)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = executeToolSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { toolId, transactionHash, chatId, code } = validation.data;

    // Track tool view/execution for Protocol Ledger (fire and forget)
    const session = await auth();
    if (session?.user?.id) {
      trackEngagementEvent({
        userId: session.user.id,
        eventType: "TOOL_VIEW",
        resourceId: toolId,
        metadata: { chatId, hasTransaction: true },
      });
    }

    const result = await runPaidSkillWithAuth({
      toolId,
      transactionHash,
      chatId,
      code,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      logs: result.logs,
      tool: {
        id: result.tool.id,
        name: result.tool.name,
      },
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("Failed to execute tool:", error);
    return NextResponse.json(
      { error: "Failed to execute tool" },
      { status: 500 }
    );
  }
}
