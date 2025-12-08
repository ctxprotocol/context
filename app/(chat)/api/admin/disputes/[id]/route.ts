import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getDisputeById, updateDisputeVerdict } from "@/lib/db/queries";

/**
 * PATCH /api/admin/disputes/[id]
 *
 * Update dispute verdict (admin only).
 *
 * Body:
 * - verdict: "guilty" | "innocent"
 * - adminNotes?: string
 *
 * Side Effects:
 * - If guilty: Increment tool.totalFlags
 * - If flags >= 5: Set tool.isActive = false (soft slash)
 */

const ADMIN_EMAILS = [
  "alex.r.macleod@gmail.com",
  "dev+blocknative-http@context.local",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin check
    const userEmail = session.user.email || "";
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const dispute = await getDisputeById(id);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    return NextResponse.json({ dispute });
  } catch (error) {
    console.error("[admin/disputes/[id]] Failed to get dispute:", error);
    return NextResponse.json(
      { error: "Failed to retrieve dispute" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin check
    const userEmail = session.user.email || "";
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { verdict, adminNotes } = body;

    // Validate verdict
    if (!verdict || !["guilty", "innocent"].includes(verdict)) {
      return NextResponse.json(
        {
          error: "Invalid verdict",
          message: "Verdict must be 'guilty' or 'innocent'",
        },
        { status: 400 }
      );
    }

    const result = await updateDisputeVerdict({
      disputeId: id,
      verdict,
      adminNotes,
    });

    return NextResponse.json({
      success: true,
      dispute: result.dispute,
      toolStatus: result.toolStatus,
    });
  } catch (error) {
    console.error("[admin/disputes/[id]] Failed to update verdict:", error);

    // Check for not found error
    if (error instanceof Error && error.message.includes("Dispute not found")) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update verdict" },
      { status: 500 }
    );
  }
}
