"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useState } from "react";
import { formatUnits } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import {
  useReadContextRouterGetUnclaimedBalance,
  useWriteContextRouterClaimEarnings,
} from "@/lib/generated";

export function EarningsPanel() {
  // Get wallet address from Privy smart wallet or embedded wallet
  const { activeWallet } = useWalletIdentity();
  const { client: smartWalletClient } = useSmartWallets();
  const developerAddress = (smartWalletClient?.account?.address ||
    activeWallet?.address) as `0x${string}` | undefined;
  const [lastTxHash, setLastTxHash] = useState<`0x${string}`>();

  // Read unclaimed balance
  const { data: balanceWei, refetch } = useReadContextRouterGetUnclaimedBalance(
    {
      args: developerAddress ? [developerAddress] : undefined,
    }
  );

  // Claim earnings
  const {
    writeContract,
    isPending: isClaimPending,
    data: txHash,
  } = useWriteContextRouterClaimEarnings();

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const balanceUSD = balanceWei ? Number(formatUnits(balanceWei, 6)) : 0;

  const handleClaim = async () => {
    if (!developerAddress) {
      toast.error("Connect your wallet to claim earnings");
      return;
    }

    try {
      await writeContract({});
      setLastTxHash(txHash);
      toast.success("Claim transaction submitted!");
    } catch (error) {
      console.error("Claim failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to claim earnings"
      );
    }
  };

  // Refetch balance after successful claim
  if (isSuccess && lastTxHash === txHash) {
    refetch();
    setLastTxHash(undefined);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-bold text-2xl">${balanceUSD.toFixed(2)}</h3>
          <p className="text-muted-foreground text-sm">Unclaimed Earnings</p>
        </div>
        <Button
          disabled={
            balanceUSD === 0 ||
            isClaimPending ||
            isConfirming ||
            !developerAddress
          }
          onClick={handleClaim}
        >
          {isClaimPending && "Confirming..."}
          {isConfirming && "Processing..."}
          {!isClaimPending && !isConfirming && "Claim Earnings"}
        </Button>
      </div>
      {isSuccess && (
        <p className="mt-2 text-green-600 text-sm">
          ✅ Earnings claimed successfully!
        </p>
      )}
    </Card>
  );
}
