import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

/**
 * User tier for the platform:
 * - convenience: Pay-as-you-go model cost pass-through (DEFAULT)
 * - byok: Unlimited queries using user's own API key
 *
 * Note: Free tier was removed - users need USDC for tools anyway,
 * so the payment friction exists regardless. Convenience is now the default.
 */
export type UserTier = "convenience" | "byok";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

/**
 * Base entitlements by user type (anti-abuse limits).
 * These are high ceilings for anti-abuse purposes only.
 */
export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   * Very limited - should sign up to get more
   */
  guest: {
    maxMessagesPerDay: 5,
    availableChatModelIds: ["gemini-flash-model"],
  },

  /*
   * For users with an account
   * High ceiling for anti-abuse only
   * All models available - paid via USDC wallet
   */
  regular: {
    maxMessagesPerDay: 10_000,
    availableChatModelIds: [
      "gemini-flash-model",
      "gemini-model",
      "claude-sonnet-model",
      "claude-opus-model",
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

/**
 * Model IDs available by tier (for non-BYOK users).
 * BYOK users get their provider's models instead.
 *
 * Convenience tier (default): All models including Claude (via OpenRouter)
 */
export const modelIdsByTier: Record<Exclude<UserTier, "byok">, string[]> = {
  convenience: [
    "gemini-flash-model",
    "gemini-model",
    "claude-sonnet-model",
    "claude-opus-model",
  ],
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
