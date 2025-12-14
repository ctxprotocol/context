/**
 * Client-side hook for tracking engagement events (Protocol Ledger)
 *
 * This hook is used for client-side events that can't be tracked server-side:
 * - USDC_APPROVED: User approved spending (high intent signal)
 * - TOOL_STAKED: Developer staked on their tool
 *
 * The tracking is fire-and-forget - it should never block the user experience.
 */

type EngagementEventType =
  | "MARKETPLACE_SEARCH"
  | "TOOL_VIEW"
  | "WALLET_CONNECTED"
  | "USDC_APPROVED"
  | "TOOL_CREATED"
  | "TOOL_STAKED"
  | "REFERRAL_LINK_CREATED"
  | "REFERRAL_CONVERTED";

type TrackEngagementParams = {
  eventType: EngagementEventType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Track an engagement event for the Protocol Ledger.
 * This is a fire-and-forget function that never throws.
 */
export async function trackEngagement({
  eventType,
  resourceId,
  metadata,
}: TrackEngagementParams): Promise<void> {
  try {
    await fetch("/api/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, resourceId, metadata }),
    });
  } catch {
    // Silently ignore errors - tracking should never block user flow
  }
}

/**
 * Hook for tracking engagement events.
 * Returns a stable function reference that can be called from event handlers.
 */
export function useTrackEngagement() {
  return { trackEngagement };
}


