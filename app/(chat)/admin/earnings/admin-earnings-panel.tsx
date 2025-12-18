"use client";

import { DollarSignIcon, WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import {
  useReadContextRouterGetPlatformBalance,
  useWriteContextRouterClaimPlatformFees,
} from "@/lib/generated";
import { formatPrice } from "@/lib/utils";

export function AdminEarningsPanel() {
  const { embeddedWallet, activeWallet } = useWalletIdentity();
  const connectedAddress = (embeddedWallet?.address || activeWallet?.address) as
    | `0x${string}`
    | undefined;
  const [lastTxHash, setLastTxHash] = useState<`0x${string}`>();

  // Read platform balance from contract
  const { data: platformBalanceWei, refetch } =
    useReadContextRouterGetPlatformBalance();

  // Claim platform fees
  const {
    writeContract,
    isPending: isClaimPending,
    data: txHash,
  } = useWriteContextRouterClaimPlatformFees();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const platformBalanceUSD = platformBalanceWei
    ? Number(formatUnits(platformBalanceWei, 6))
    : 0;

  const handleClaim = async () => {
    if (!connectedAddress) {
      toast.error("Connect your wallet to claim platform fees");
      return;
    }

    try {
      await writeContract({});
      setLastTxHash(txHash);
      toast.success("Claim transaction submitted!");
    } catch (error) {
      console.error("Claim failed:", error);
      const message =
        error instanceof Error ? error.message : "Failed to claim";

      // Check for common errors
      if (message.includes("OwnableUnauthorizedAccount")) {
        toast.error(
          "Only the contract owner can claim platform fees. Make sure you're connected with the deployer wallet."
        );
      } else {
        toast.error(message);
      }
    }
  };

  // Refetch balance after successful claim
  if (isSuccess && lastTxHash === txHash) {
    refetch();
    setLastTxHash(undefined);
    toast.success("Platform fees claimed successfully!");
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSignIcon className="size-5" />
          Platform Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-4xl tabular-nums">
              ${formatPrice(platformBalanceUSD)}
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Platform fees + model costs ready to claim
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="min-w-[180px]"
              disabled={
                platformBalanceUSD === 0 ||
                isClaimPending ||
                isConfirming ||
                !connectedAddress
              }
              onClick={handleClaim}
              size="lg"
            >
              {isClaimPending && "Confirming..."}
              {isConfirming && "Processing..."}
              {!isClaimPending && !isConfirming && "Claim Platform Fees"}
            </Button>

            {!connectedAddress && (
              <p className="flex items-center gap-1 text-muted-foreground text-xs">
                <WalletIcon className="size-3" />
                Connect wallet to claim
              </p>
            )}
          </div>
        </div>

        {isSuccess && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-green-800 text-sm dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            ✅ Platform fees claimed successfully! The USDC has been transferred
            to your wallet.
          </div>
        )}

        {/* Show connected wallet info */}
        {connectedAddress && (
          <div className="mt-4 rounded-md border bg-muted/30 p-3">
            <p className="font-mono text-muted-foreground text-xs">
              Connected: {connectedAddress}
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Note: Only the contract owner (deployer wallet) can claim platform
              fees.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
