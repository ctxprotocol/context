"use client";

/**
 * WalletLinkingPrompt Component
 *
 * In-chat prompt shown when a user asks about their portfolio but has no
 * linked wallets. Allows them to link a wallet without leaving the chat,
 * then automatically retries their original query.
 *
 * Design follows the existing LinkedWalletsSection pattern from settings
 * with consistent styling per design-system.json.
 */

import { useLinkAccount, usePrivy } from "@privy-io/react-auth";
import { Info, Link2, SkipForward, Wallet, X } from "lucide-react";
import { useState } from "react";
import { LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type WalletLinkingPromptProps = {
  /** Context types required by the selected tools */
  requiredContext: string[];
  /** Called after user successfully links a wallet */
  onWalletLinked: () => void;
  /** Called when user chooses to skip (proceed without wallet data) */
  onSkip: () => void;
  /** Called when user cancels the request entirely */
  onCancel: () => void;
};

/**
 * Maps context requirement keys to human-readable protocol names.
 */
function getProtocolDisplayName(ctx: string): string {
  switch (ctx) {
    case "polymarket":
      return "Polymarket";
    case "hyperliquid":
      return "Hyperliquid";
    case "wallet":
      return "DeFi";
    default:
      return ctx;
  }
}

export function WalletLinkingPrompt({
  requiredContext,
  onWalletLinked,
  onSkip,
  onCancel,
}: WalletLinkingPromptProps) {
  const [isLinking, setIsLinking] = useState(false);
  const { ready } = usePrivy();

  const { linkWallet } = useLinkAccount({
    onSuccess: () => {
      setIsLinking(false);
      onWalletLinked();
    },
    onError: (error) => {
      // "exited_link_flow" is not a real error - user just closed modal
      if (error !== "exited_link_flow") {
        // eslint-disable-next-line no-console
        console.error("[wallet-linking-prompt] Failed to link wallet:", error);
      }
      setIsLinking(false);
    },
  });

  const handleLinkWallet = () => {
    setIsLinking(true);
    linkWallet();
  };

  // Build human-readable protocol names
  const protocolNames = requiredContext
    .map(getProtocolDisplayName)
    .join(" and ");

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-500">
          <Link2 className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">Action Required</span>
          <span className="text-muted-foreground text-xs">
            Link wallet to continue
          </span>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        To analyze your <strong>{protocolNames}</strong> positions, I need to read
        your wallet&apos;s public data. This is completely{" "}
        <strong>read-only</strong>.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-8 flex-1 text-xs"
          disabled={isLinking || !ready}
          onClick={handleLinkWallet}
        >
          {isLinking ? (
            <>
              <span className="animate-spin">
                <LoaderIcon size={14} />
              </span>
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="size-3.5" />
              Link Wallet
            </>
          )}
        </Button>

        <Button
          className="h-8 flex-1 text-xs"
          disabled={isLinking}
          onClick={onSkip}
          variant="outline"
        >
          <SkipForward className="size-3.5" />
          Skip (Limited Analysis)
        </Button>
      </div>

      {/* Cancel option */}
      <Button
        className="h-auto p-0 text-muted-foreground text-xs hover:bg-transparent hover:text-foreground"
        onClick={onCancel}
        size="sm"
        variant="ghost"
      >
        Cancel Request
      </Button>
    </div>
  );
}


