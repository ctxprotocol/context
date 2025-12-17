"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useCallback } from "react";
import { useAutoPay } from "@/hooks/use-auto-pay";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
};

/**
 * Mind-blowing questions that showcase Context's unique capabilities
 * with Hyperliquid and Polymarket tools - things you can't ask ChatGPT
 */
const SUGGESTED_ACTIONS = [
  // Hyperliquid: Real-time orderbook analysis with price impact simulation
  "What's the slippage if I market sell $500K of HYPE right now? How long should I TWAP it?",
  // Hyperliquid: Cross-exchange funding arbitrage
  "Find funding arbitrage between Hyperliquid, Binance and Bybit - where can I get paid to hold?",
  // Polymarket: Real arbitrage detection from actual orderbooks
  "Are there any arbitrage opportunities on Polymarket where I can lock in guaranteed profit?",
  // Polymarket: Smart money tracking
  "What prediction markets are whales piling into? Show me the smart money flow.",
];

function PureSuggestedActions({
  chatId,
  sendMessage,
  isReadonly,
}: SuggestedActionsProps) {
  const { isAutoMode, requestAutoMode } = useAutoPay();

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (isReadonly) {
        return;
      }

      // These advanced queries require Auto Mode for tool discovery
      if (!isAutoMode) {
        // Request auto mode enablement - this will trigger the approval dialog
        requestAutoMode();
        // Don't send yet - user needs to enable auto mode first
        return;
      }

      // Auto mode is enabled, proceed with the query
      window.history.replaceState({}, "", `/chat/${chatId}`);
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: suggestion }],
      });
    },
    [isReadonly, isAutoMode, requestAutoMode, chatId, sendMessage]
  );

  return (
    <div
      className="grid w-full gap-2 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {SUGGESTED_ACTIONS.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={suggestedAction}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal rounded-xl p-3 text-left"
            disabled={isReadonly}
            onClick={handleSuggestionClick}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.isReadonly !== nextProps.isReadonly) {
      return false;
    }

    return true;
  }
);
