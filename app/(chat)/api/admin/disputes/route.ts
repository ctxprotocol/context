import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getDisputes } from "@/lib/db/queries";

/**
 * GET /api/admin/disputes
 *
 * List all disputes with pagination and filters.
 * Admin-only endpoint.
 *
 * Query params:
 * - verdict: "pending" | "guilty" | "innocent" | "manual_review"
 * - reason: dispute reason filter
 * - limit: number (default 50)
 * - offset: number (default 0)
 */

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const verdict = searchParams.get("verdict") as
      | "pending"
      | "guilty"
      | "innocent"
      | "manual_review"
      | null;
    const reason = searchParams.get("reason");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    const result = await getDisputes({
      verdict: verdict || undefined,
      reason: reason || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/disputes] Failed to get disputes:", error);
    return NextResponse.json(
      { error: "Failed to retrieve disputes" },
      { status: 500 }
    );
  }
}
