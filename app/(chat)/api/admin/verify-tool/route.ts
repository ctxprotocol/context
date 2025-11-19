import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { verifyAITool } from "@/lib/db/queries";

/**
 * Simple admin endpoint to verify tools
 * In production, add proper admin role checking
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add proper admin role check here
    // For MVP, any logged-in user can verify (remove in production!)

    const { toolId } = await request.json();

    if (!toolId) {
      return NextResponse.json({ error: "Tool ID required" }, { status: 400 });
    }

    // Update tool to verified
    await verifyAITool({
      toolId,
      verifiedBy: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to verify tool:", error);
    return NextResponse.json(
      { error: "Failed to verify tool" },
      { status: 500 }
    );
  }
}
