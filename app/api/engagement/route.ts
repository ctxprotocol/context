import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { trackEngagementEvent } from "@/lib/db/queries";
import type { EngagementEventType } from "@/lib/db/schema";

/**
 * POST /api/engagement
 *
 * Track engagement events for the Protocol Ledger (Stealth Points System).
 * This endpoint is used for client-side events that can't be tracked server-side.
 *
 * Events tracked here:
 * - USDC_APPROVED: User approved spending (high intent signal)
 * - TOOL_STAKED: Developer staked on their tool
 * - TOOL_VIEW: User viewed tool details
 *
 * Note: Server-side events (MARKETPLACE_SEARCH, TOOL_CREATED, etc.) are
 * tracked directly in their respective handlers.
 */

const engagementEventSchema = z.object({
  eventType: z.enum([
    "MARKETPLACE_SEARCH",
    "TOOL_VIEW",
    "WALLET_CONNECTED",
    "USDC_APPROVED",
    "TOOL_CREATED",
    "TOOL_STAKED",
    "REFERRAL_LINK_CREATED",
    "REFERRAL_CONVERTED",
  ]),
  resourceId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = engagementEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { eventType, resourceId, metadata } = validation.data;

    // Fire and forget - don't wait for DB write
    trackEngagementEvent({
      userId: session.user.id,
      eventType: eventType as EngagementEventType,
      resourceId,
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[engagement] Failed to track event:", error);
    // Always return success - tracking should never block user flow
    return NextResponse.json({ success: true });
  }
}





