import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getOrCreateReferralCode,
  getReferralStats,
} from "@/lib/db/queries";

/**
 * GET /api/referral
 *
 * Get the current user's referral code and stats.
 * Creates a new code if one doesn't exist.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get or create referral code (idempotent)
    const referralCode = await getOrCreateReferralCode(session.user.id);

    // Get referral stats
    const stats = await getReferralStats(session.user.id);

    return NextResponse.json({
      referralCode: referralCode ?? stats.referralCode,
      totalReferred: stats.totalReferred,
      convertedCount: stats.convertedCount,
    });
  } catch (error) {
    console.error("[api/referral] Failed to get referral data:", error);
    return NextResponse.json(
      { error: "Failed to load referral data" },
      { status: 500 }
    );
  }
}



