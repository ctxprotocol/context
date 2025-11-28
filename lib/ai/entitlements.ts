import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   * High ceiling for anti-abuse only - actual limiting is via micropayments
   */
  guest: {
    maxMessagesPerDay: 10_000,
    availableChatModelIds: ["chat-model", "chat-model-reasoning"],
  },

  /*
   * For users with an account
   * High ceiling for anti-abuse only - actual limiting is via micropayments
   */
  regular: {
    maxMessagesPerDay: 10_000,
    availableChatModelIds: ["chat-model", "chat-model-reasoning"],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
