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
  // Exa + Polymarket: Real-time news → prediction market mispricing
  "Search for breaking crypto news from the last hour and find Polymarket bets that are mispriced based on this news",
  // Exa + Hyperliquid: Deep research → trading signal
  "Research the next major token unlocks this week and calculate the price impact if teams dump on Hyperliquid",
  // Polymarket + Hyperliquid: Cross-market alpha
  "Find funding arbitrage on Hyperliquid and show me which prediction markets have whale divergence from retail",
  // Exa + Polymarket + Hyperliquid: Full intelligence stack
  "What's the smart money saying about ETH? Show me whale flow on Polymarket, funding rates on Hyperliquid, and latest analyst reports",
  // Hyperliquid: Large order simulation
  "What's the slippage if I market sell $500K of HYPE right now? How long should I TWAP it to minimize impact?",
  // Polymarket + Exa: Political intelligence
  "Who are the top SEC chair candidates? Cross-reference their recent statements with current Polymarket odds",
  // Hyperliquid + Polymarket: Sentiment correlation
  "Compare BTC funding rates on Hyperliquid with crypto prediction market sentiment - is there a divergence?",
  // Exa + Hyperliquid: Rumor validation
  "Search for 'Binance listing rumors' and check for unusual volume or open interest spikes on Hyperliquid perps",
  // Polymarket + Exa: Controversy analysis
  "Find the most controversial prediction markets ending this week and research the latest news impacting results",
  // Hyperliquid + Polymarket: Crash prediction
  "Identify perps with negative funding and see if prediction markets are pricing in a crash for those assets",
  // Exa + Hyperliquid + Polymarket: Macro strategy
  "Analyze the current macro outlook, check BTC funding rates, and find hedging opportunities on prediction markets",
  // Exa + Polymarket: Election analytics
  "Search for real-time election polls and compare them against the current implied probabilities on Polymarket",
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
