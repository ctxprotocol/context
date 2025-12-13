"use client";

import { useState } from "react";
import { useLinkAccount, usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet, X, ExternalLink, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LinkedWalletsSection() {
  const { user, unlinkWallet, ready } = usePrivy();
  const { linkWallet } = useLinkAccount({
    onSuccess: () => {
      toast.success("Wallet linked successfully!");
      setIsLinking(false);
    },
    onError: (error) => {
      // "exited_link_flow" is not a real error - user just closed modal
      if (error !== "exited_link_flow") {
        toast.error("Failed to link wallet");
      }
      setIsLinking(false);
    },
  });
  const [isLinking, setIsLinking] = useState(false);
  const [unlinkingAddress, setUnlinkingAddress] = useState<string | null>(null);

  // Get linked wallets (excluding embedded Privy wallet)
  const linkedExternalWallets =
    user?.linkedAccounts?.filter(
      (account) =>
        account.type === "wallet" && account.walletClientType !== "privy"
    ) ?? [];

  const handleLinkWallet = () => {
    setIsLinking(true);
    linkWallet();
  };

  const handleUnlinkWallet = async (address: string) => {
    setUnlinkingAddress(address);
    try {
      await unlinkWallet(address);
      toast.success("Wallet unlinked");
    } catch {
      toast.error("Failed to unlink wallet");
    } finally {
      setUnlinkingAddress(null);
    }
  };

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Wallets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-5" />
          Portfolio Wallets
        </CardTitle>
        <CardDescription>
          Link wallets to analyze your positions across DeFi protocols. These
          wallets are <strong>read-only</strong> — they cannot sign transactions
          in this app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <p className="text-muted-foreground text-sm">
            When you chat with tools like <strong>Polymarket Intelligence</strong>,
            we&apos;ll automatically fetch your positions from linked wallets to
            provide personalized analysis.
          </p>
        </div>

        {/* Linked wallets list */}
        {linkedExternalWallets.length > 0 ? (
          <div className="space-y-2">
            {linkedExternalWallets.map((wallet) => (
              <div
                key={wallet.address}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                  <div>
                    <p className="font-mono text-sm">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {wallet.walletClientType === "metamask"
                        ? "MetaMask"
                        : wallet.walletClientType === "coinbase_wallet"
                          ? "Coinbase Wallet"
                          : wallet.walletClientType === "wallet_connect"
                            ? "WalletConnect"
                            : wallet.walletClientType || "External Wallet"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={`https://polygonscan.com/address/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlinkWallet(wallet.address)}
                    disabled={unlinkingAddress === wallet.address}
                  >
                    {unlinkingAddress === wallet.address ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No external wallets linked yet.
          </p>
        )}

        {/* Link wallet button */}
        <Button
          onClick={handleLinkWallet}
          disabled={isLinking}
          variant="outline"
          className="w-full"
        >
          {isLinking ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "+ Link External Wallet"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

