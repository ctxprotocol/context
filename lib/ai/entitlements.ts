import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

/**
 * User tier for the BYOK system:
 * - free: Limited daily queries using platform's API key
 * - byok: Unlimited queries using user's own API key
 * - convenience: Pay-as-you-go model cost pass-through
 */
export type UserTier = "free" | "byok" | "convenience";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

/**
 * Base entitlements by user type (anti-abuse limits).
 * These are high ceilings - actual limiting is via tier system.
 */
export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   * Very limited - should sign up to get more
   */
  guest: {
    maxMessagesPerDay: 5,
    availableChatModelIds: ["chat-model"],
  },

  /*
   * For users with an account
   * High ceiling for anti-abuse only - actual limiting is via tier system
   * Includes gemini-model but actual availability is filtered by tier
   */
  regular: {
    maxMessagesPerDay: 10_000,
    availableChatModelIds: [
      "chat-model",
      "chat-model-reasoning",
      "gemini-model",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

/**
 * Free tier daily limit for regular users.
 * Users can upgrade to BYOK or Convenience tier for unlimited queries.
 */
export const FREE_TIER_DAILY_LIMIT = 1000;

/**
 * Check if a user has exceeded their free tier limit.
 * Returns the remaining queries or -1 if unlimited (BYOK/convenience tier).
 */
export function getRemainingFreeQueries(
  tier: UserTier,
  usedToday: number
): number {
  if (tier === "byok" || tier === "convenience") {
    return -1; // Unlimited
  }
  return Math.max(0, FREE_TIER_DAILY_LIMIT - usedToday);
}

/**
 * Check if a user can make a query based on their tier and usage.
 */
export function canMakeQuery(tier: UserTier, usedToday: number): boolean {
  if (tier === "byok" || tier === "convenience") {
    return true; // Unlimited for BYOK and convenience tiers
  }
  return usedToday < FREE_TIER_DAILY_LIMIT;
}

/**
 * Model IDs available by tier (for non-BYOK users).
 * BYOK users get their provider's models instead.
 *
 * - Free tier: Only Kimi models (platform default)
 * - Convenience tier: Kimi + Gemini (paid pass-through)
 */
export const modelIdsByTier: Record<Exclude<UserTier, "byok">, string[]> = {
  free: ["chat-model", "chat-model-reasoning"],
  convenience: ["chat-model", "chat-model-reasoning", "gemini-model"],
};

/**
 * Get available model IDs for a user based on their tier.
 * For BYOK users, returns null (they use provider-specific models).
 */
export function getAvailableModelIds(tier: UserTier): string[] | null {
  if (tier === "byok") {
    return null; // BYOK users get models from their provider
  }
  return modelIdsByTier[tier];
}
