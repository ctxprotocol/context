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
    <Card className="mx-auto my-4 max-w-md border-blue-500/20 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="size-5 text-blue-500" />
          Link Your Wallet to Continue
        </CardTitle>
        <CardDescription>
          Connect your wallet to access personalized analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Info banner - matches linked-wallets.tsx pattern */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <p className="text-muted-foreground text-sm">
            To analyze your <strong>{protocolNames}</strong> positions, I need
            to read your wallet&apos;s public data. This is completely{" "}
            <strong>read-only</strong> — I can never make transactions on your
            behalf.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            disabled={isLinking || !ready}
            onClick={handleLinkWallet}
          >
            {isLinking ? (
              <>
                <span className="animate-spin">
                  <LoaderIcon size={16} />
                </span>
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="size-4" />
                Link Wallet
              </>
            )}
          </Button>

          <Button
            className="flex-1"
            disabled={isLinking}
            onClick={onSkip}
            variant="outline"
          >
            <SkipForward className="size-4" />
            Skip (Limited Analysis)
          </Button>
        </div>

        {/* Cancel option - ghost style for less prominence */}
        <Button
          className="w-full text-muted-foreground"
          onClick={onCancel}
          size="sm"
          variant="ghost"
        >
          <X className="size-3" />
          Cancel Request
        </Button>
      </CardContent>
    </Card>
  );
}


