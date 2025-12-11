"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { encodeFunctionData, type Hex, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { CheckIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SPENDING_CAP_OPTIONS, useAutoPay } from "@/hooks/use-auto-pay";
import { trackEngagement } from "@/hooks/use-track-engagement";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { formatPrice } from "@/lib/utils";

type AutoPayApprovalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprovalSuccess: () => void;
  onApprovalCancel: () => void;
  /** If provided, pre-select this cap (used when increasing from sidebar) */
  initialCap?: number;
};

export function AutoPayApprovalDialog({
  open,
  onOpenChange,
  onApprovalSuccess,
  onApprovalCancel,
  initialCap,
}: AutoPayApprovalDialogProps) {
  const { spendingCap, setSpendingCap } = useAutoPay();
  const { activeWallet } = useWalletIdentity();
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { client: smartWalletClient } = useSmartWallets();

  const walletAddress = activeWallet?.address as `0x${string}` | undefined;
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  const chainId = chain?.id;
  const isOnBase = chainId === base.id;

  const [isApproving, setIsApproving] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [selectedCap, setSelectedCap] = useState(initialCap ?? spendingCap);
  const [approvalStatus, setApprovalStatus] = useState<
    "idle" | "pending" | "confirming"
  >("idle");

  // Reset selected cap when dialog opens
  useEffect(() => {
    if (open) {
      // Use initialCap if provided (for cap increases), otherwise use current spending cap
      setSelectedCap(initialCap ?? spendingCap);
      setApprovalStatus("idle");
    }
  }, [open, spendingCap, initialCap]);

  // Check current allowance - use smart wallet address if available
  const smartWalletAddress = smartWalletClient?.account?.address as
    | `0x${string}`
    | undefined;
  const allowanceCheckAddress = smartWalletAddress || walletAddress;

  const { data: currentAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: allowanceCheckAddress
      ? [allowanceCheckAddress, routerAddress]
      : undefined,
    query: {
      enabled: Boolean(allowanceCheckAddress && routerAddress && usdcAddress),
    },
  });

  const handleSwitchNetwork = async () => {
    try {
      setIsSwitchingNetwork(true);
      await switchChainAsync({ chainId: base.id });
      toast.success("Switched to Base");
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch {
      toast.error("Failed to switch network");
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const handleApprove = async () => {
    if (!routerAddress || !usdcAddress) {
      toast.error("Configuration error");
      return;
    }

    if (!smartWalletClient) {
      toast.error("Smart wallet not ready. Please try again.");
      return;
    }

    if (!isOnBase) {
      toast.error("Please switch to Base first");
      return;
    }

    try {
      setIsApproving(true);
      setApprovalStatus("pending");

      // Approve spending cap amount (convert to USDC decimals - 6)
      const approvalAmount = parseUnits(selectedCap.toString(), 6);

      // Encode the approve function call
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, approvalAmount],
      });

      // Use smart wallet to send transaction - gas is sponsored!
      setApprovalStatus("confirming");
      const txHash = await smartWalletClient.sendTransaction({
        chain: base,
        to: usdcAddress,
        data: approveData as Hex,
        value: BigInt(0),
      });

      if (txHash) {
        setSpendingCap(selectedCap);
        toast.success(
          "Auto Pay enabled! You can now use tools without signing each time."
        );

        // Protocol Ledger: Track USDC approval (very high intent signal)
        trackEngagement({
          eventType: "USDC_APPROVED",
          metadata: { spendingCap: selectedCap, txHash },
        });

        onApprovalSuccess();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Approval failed";

      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected") ||
        errorMessage.includes("denied")
      ) {
        toast.error("Approval cancelled");
      } else {
        console.error("Approval error:", error);
        toast.error("Failed to approve. Please try again.");
      }
    } finally {
      setIsApproving(false);
      setApprovalStatus("idle");
    }
  };

  const handleCancel = () => {
    onApprovalCancel();
    onOpenChange(false);
  };

  const isBusy = isApproving || isSwitchingNetwork;

  // Check if already has sufficient allowance
  const currentAllowanceNum = currentAllowance
    ? Number(currentAllowance) / 1_000_000
    : 0;
  const hasSufficientAllowance = currentAllowanceNum >= selectedCap;

  // Check if smart wallet is ready
  const isSmartWalletReady = Boolean(smartWalletClient?.account);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable Auto Pay</AlertDialogTitle>
          <AlertDialogDescription>
            Sign once to allow automatic payments up to your spending cap. You
            won't need to sign for each tool query. Gas fees are sponsored by
            Context.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Spending Cap Selector */}
          <div className="space-y-2">
            <span className="font-medium text-sm">Spending Cap</span>
            <div className="flex gap-2">
              {SPENDING_CAP_OPTIONS.map((option) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-2 font-medium text-sm transition-colors ${
                    selectedCap === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                  disabled={isBusy}
                  key={option.value}
                  onClick={() => setSelectedCap(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Maximum amount that can be spent automatically per session
            </p>
          </div>

          {/* Network Status */}
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
            {isOnBase ? (
              <>
                <div className="flex size-5 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckIcon size={12} />
                </div>
                <span className="font-medium">Connected to Base</span>
              </>
            ) : (
              <>
                <div className="flex size-5 items-center justify-center rounded-full bg-orange-500/10">
                  <span className="font-semibold text-orange-600 text-xs">
                    !
                  </span>
                </div>
                <span className="font-medium">Switch to Base required</span>
              </>
            )}
          </div>

          {/* Existing Allowance Info */}
          {currentAllowanceNum > 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Current allowance: </span>
              <span className="font-medium">
                ${formatPrice(currentAllowanceNum)}
              </span>
              {hasSufficientAllowance && (
                <span className="ml-2 text-green-600">
                  ✓ Sufficient for selected cap
                </span>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy} onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          {isOnBase ? (
            hasSufficientAllowance ? (
              <AlertDialogAction
                onClick={() => {
                  setSpendingCap(selectedCap);
                  onApprovalSuccess();
                }}
              >
                Enable Auto Pay
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={isBusy || !isSmartWalletReady}
                onClick={handleApprove}
              >
                {isSmartWalletReady
                  ? approvalStatus === "pending"
                    ? "Waiting for signature..."
                    : approvalStatus === "confirming"
                      ? "Confirming..."
                      : `Approve $${selectedCap} USDC`
                  : "Preparing wallet..."}
              </AlertDialogAction>
            )
          ) : (
            <Button disabled={isSwitchingNetwork} onClick={handleSwitchNetwork}>
              {isSwitchingNetwork ? "Switching..." : "Switch to Base"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
