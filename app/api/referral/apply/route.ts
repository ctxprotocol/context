import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getUserByReferralCode,
  setUserReferrer,
} from "@/lib/db/queries";

const applyReferralSchema = z.object({
  code: z.string().min(6).max(12),
});

/**
 * POST /api/referral/apply
 *
 * Apply a referral code to the current user.
 * Called after authentication when a referral code was captured from URL.
 *
 * This is idempotent - if user already has a referrer, it's a no-op.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = applyReferralSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 400 }
      );
    }

    const { code } = validation.data;

    // Look up the referrer by code
    const referrer = await getUserByReferralCode(code);
    if (!referrer) {
      return NextResponse.json(
        { error: "Invalid referral code", applied: false },
        { status: 400 }
      );
    }

    // Don't allow self-referral
    if (referrer.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot use your own referral code", applied: false },
        { status: 400 }
      );
    }

    // Apply the referral (idempotent - will no-op if already referred)
    const applied = await setUserReferrer(session.user.id, referrer.id);

    return NextResponse.json({
      success: true,
      applied, // true if newly applied, false if already had a referrer
    });
  } catch (error) {
    console.error("[api/referral/apply] Failed:", error);
    return NextResponse.json(
      { error: "Failed to apply referral" },
      { status: 500 }
    );
  }
}



