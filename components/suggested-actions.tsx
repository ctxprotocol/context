"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useCallback, useEffect, useState } from "react";
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
 * by composing Exa (real-time search/research), Hyperliquid (perp trading),
 * and Polymarket (prediction markets) - impossible to ask ChatGPT
 */
const ALL_SUGGESTED_ACTIONS = [
  // Polymarket → Exa: Find markets, then validate pricing
  "Find the highest volume Polymarket markets right now and research if the odds are correctly priced",
  // Hyperliquid → Exa: Extreme funding → research why
  "Which Hyperliquid perps have the most extreme funding rates? Research why and if it's justified",
  // Polymarket → Exa: Ending soon → news impact
  "Find the most controversial prediction markets ending this week and research the latest news impacting results",
  // Hyperliquid: Large order simulation (pure tool showcase)
  "What's the slippage if I market sell $500K of HYPE right now? How long should I TWAP it to minimize impact?",
  // Hyperliquid → Exa: OI spikes → find catalyst
  "Which Hyperliquid perps have unusual open interest spikes today? Search for news that explains the positioning",
  // Polymarket: Arbitrage detection (pure tool showcase)
  "Are there any arbitrage opportunities on Polymarket where I can lock in guaranteed profit right now?",
  // Hyperliquid → Polymarket: Negative funding → crash sentiment
  "Identify perps with negative funding on Hyperliquid and check if prediction markets are pricing in a crash",
  // Polymarket → Exa: Whale flow → validate thesis
  "Show me where whales are positioning on Polymarket and research if the smart money thesis is correct",
  // Hyperliquid + Polymarket: Cross-market divergence
  "Find funding arbitrage on Hyperliquid and show me which prediction markets have whale divergence from retail",
  // Hyperliquid → Exa: Top movers → news correlation
  "What are the top 5 movers on Hyperliquid perps today? Research what's driving each one",
  // Polymarket → Exa: Low liquidity gems
  "Find low liquidity Polymarket markets with upcoming catalysts and research if they're mispriced",
  // Hyperliquid: Position analysis (pure tool showcase)
  "Analyze my open positions on Hyperliquid - what's my liquidation risk and should I adjust leverage?",
];

function PureSuggestedActions({
  chatId,
  sendMessage,
  isReadonly,
}: SuggestedActionsProps) {
  const { isAutoMode, requestAutoMode } = useAutoPay();
  const [suggestions, setSuggestions] = useState(() =>
    ALL_SUGGESTED_ACTIONS.slice(0, 4)
  );

  useEffect(() => {
    // Randomize suggestions on mount (client-side only)
    const shuffled = [...ALL_SUGGESTED_ACTIONS].sort(() => 0.5 - Math.random());
    setSuggestions(shuffled.slice(0, 4));
  }, []);

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
      {suggestions.map((suggestedAction, index) => (
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
