import { NextResponse } from "next/server";
import { z } from "zod";
import { runPaidSkillWithAuth } from "@/lib/tools/run-paid-skill";

const executeToolSchema = z.object({
  toolId: z.string().uuid(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chatId: z.string().uuid().optional(),
  code: z.string().min(1),
});

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
