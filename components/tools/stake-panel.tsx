"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseUnits } from "viem";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { LoaderIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import {
  useReadContextRouterGetWithdrawalStatus,
  useWriteContextRouterCancelWithdrawal,
  useWriteContextRouterDepositStake,
  useWriteContextRouterRequestWithdrawal,
  useWriteContextRouterWithdrawStake,
  useWriteErc20Approve,
} from "@/lib/generated";
import { cn, formatPrice, uuidToUint256 } from "@/lib/utils";

// All paid tools require staking (100x query price)
// Free tools ($0) = no stake requirement
const STAKE_MULTIPLIER = 100;

type StakePanelProps = {
  tools: Array<{
    id: string;
    name: string;
    pricePerQuery: string;
    totalStaked: string | null;
  }>;
};

/**
 * StakePanel - Manage stakes for paid tools
 *
 * All paid tools require developers to stake 100x the query price as collateral.
 * This provides economic security for users against scams (like Apple's $99/yr fee,
 * but refundable). Free tools ($0) require no stake.
 */
export function StakePanel({ tools }: StakePanelProps) {
  const { activeWallet } = useWalletIdentity();
  const isConnected = !!activeWallet?.address;

  // Filter to paid tools (price > 0) - all paid tools require staking
  const toolsRequiringStake = tools.filter((tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    return price > 0;
  });

  // Calculate total required vs total staked
  const totalRequired = toolsRequiringStake.reduce((sum, tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    return sum + price * STAKE_MULTIPLIER;
  }, 0);

  const totalStaked = toolsRequiringStake.reduce((sum, tool) => {
    return sum + (Number.parseFloat(tool.totalStaked ?? "0") || 0);
  }, 0);

  const hasUnderstakedTools = toolsRequiringStake.some((tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    const staked = Number.parseFloat(tool.totalStaked ?? "0") || 0;
    const required = price * STAKE_MULTIPLIER;
    return staked < required;
  });

  // Don't render if no high-value tools
  if (toolsRequiringStake.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-muted-foreground" />
              <h3 className="font-semibold">Stake Management</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              100× query price • Refundable with 7-day withdrawal delay
            </p>
          </div>
          {hasUnderstakedTools && (
            <Badge
              className="gap-1 bg-amber-500/10 text-amber-600"
              variant="outline"
            >
              <AlertTriangle className="size-3" />
              Action Required
            </Badge>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-xs">Total Staked</p>
            <p className="font-bold text-lg">${formatPrice(totalStaked)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Required</p>
            <p
              className={cn(
                "font-bold text-lg",
                totalStaked < totalRequired
                  ? "text-amber-600"
                  : "text-emerald-600"
              )}
            >
              ${formatPrice(totalRequired)}
            </p>
          </div>
        </div>

        {/* Tools List */}
        <div className="space-y-3">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Tools Requiring Stake
          </p>
          <div className="space-y-2">
            {toolsRequiringStake.map((tool) => (
              <StakeToolRow
                isConnected={isConnected}
                key={tool.id}
                tool={tool}
                walletAddress={activeWallet?.address}
              />
            ))}
          </div>
        </div>

        {/* Info */}
        <p className="text-muted-foreground text-xs">
          Stake is held in the ContextRouter contract on Base. You can withdraw
          anytime, but users may avoid tools without sufficient collateral.
        </p>
      </div>
    </Card>
  );
}

function StakeToolRow({
  tool,
  isConnected,
  walletAddress,
}: {
  tool: {
    id: string;
    name: string;
    pricePerQuery: string;
    totalStaked: string | null;
  };
  isConnected: boolean;
  walletAddress?: string;
}) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<
    "idle" | "approving" | "depositing"
  >("idle");

  // Contract addresses
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Contract hooks for staking
  const {
    writeContractAsync: depositStakeAsync,
    isPending: isDepositing,
    data: depositTxHash,
  } = useWriteContextRouterDepositStake();
  const {
    writeContract: withdrawStake,
    isPending: isWithdrawing,
    data: withdrawTxHash,
  } = useWriteContextRouterWithdrawStake();
  
  // Withdrawal timelock hooks (7-day delay)
  const {
    writeContractAsync: requestWithdrawalAsync,
    isPending: isRequestingWithdrawal,
    data: requestWithdrawalTxHash,
  } = useWriteContextRouterRequestWithdrawal();
  const {
    writeContractAsync: cancelWithdrawalAsync,
    isPending: isCancellingWithdrawal,
  } = useWriteContextRouterCancelWithdrawal();

  // USDC approval hook
  const {
    writeContractAsync: approveUsdcAsync,
    isPending: isApproving,
    data: approveTxHash,
  } = useWriteErc20Approve();

  // Wait for transaction confirmations
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositTxHash });
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });
  const { isLoading: isRequestWithdrawalConfirming, isSuccess: isRequestWithdrawalSuccess } =
    useWaitForTransactionReceipt({ hash: requestWithdrawalTxHash });

  // Check current USDC allowance for the router
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: walletAddress
        ? [walletAddress as `0x${string}`, routerAddress]
        : undefined,
      query: {
        enabled: Boolean(walletAddress && routerAddress && usdcAddress),
      },
    }
  );

  const price = Number.parseFloat(tool.pricePerQuery) || 0;
  const staked = Number.parseFloat(tool.totalStaked ?? "0") || 0;
  const required = price * STAKE_MULTIPLIER;
  const hasEnough = staked >= required;
  const shortfall = Math.max(0, required - staked);

  // Tool ID for contract calls (collision-free UUID conversion)
  const toolIdBigInt = uuidToUint256(tool.id);

  // Read withdrawal timelock status from contract (7-day delay)
  const { data: withdrawalStatus, refetch: refetchWithdrawalStatus } = useReadContextRouterGetWithdrawalStatus({
    args: [toolIdBigInt],
    query: {
      enabled: Boolean(routerAddress && staked > 0),
    },
  });
  
  // Parse withdrawal status (requestTime, availableAt, canWithdraw)
  const withdrawalRequestTime = withdrawalStatus?.[0] ? Number(withdrawalStatus[0]) : 0;
  const withdrawalAvailableAt = withdrawalStatus?.[1] ? Number(withdrawalStatus[1]) : 0;
  const canWithdrawNow = withdrawalStatus?.[2] ?? false;
  const hasPendingWithdrawal = withdrawalRequestTime > 0;
  
  // Calculate time remaining for pending withdrawal
  const getTimeRemaining = () => {
    if (!hasPendingWithdrawal || canWithdrawNow) return null;
    const now = Math.floor(Date.now() / 1000);
    const remaining = withdrawalAvailableAt - now;
    if (remaining <= 0) return null;
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to deposit stake");
      return;
    }

    const amount = Number.parseFloat(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      const amountInUsdc = parseUnits(depositAmount, 6); // USDC has 6 decimals
      const toolIdBigInt = uuidToUint256(tool.id);

      // Check if we need approval first
      const currentAllowanceNum = currentAllowance
        ? BigInt(currentAllowance.toString())
        : BigInt(0);

      if (currentAllowanceNum < amountInUsdc) {
        // Need to approve first
        setApprovalStatus("approving");
        toast.info("Approving USDC spend...");

        await approveUsdcAsync({
          address: usdcAddress,
          args: [routerAddress, amountInUsdc],
        });

        // Wait for approval to be confirmed
        toast.success("USDC approved! Now depositing stake...");
        await refetchAllowance();
      }

      // Now deposit
      setApprovalStatus("depositing");
      await depositStakeAsync({
        args: [toolIdBigInt, amountInUsdc],
      });
      toast.success("Deposit transaction submitted!");
    } catch (error) {
      console.error("Deposit failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to deposit stake";
      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected")
      ) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setApprovalStatus("idle");
    }
  };

  // Request withdrawal (starts 7-day timer)
  const handleRequestWithdrawal = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to request withdrawal");
      return;
    }

    try {
      await requestWithdrawalAsync({
        args: [toolIdBigInt],
      });
      toast.success("Withdrawal requested! 7-day timer started.");
    } catch (error) {
      console.error("Request withdrawal failed:", error);
      const msg = error instanceof Error ? error.message : "Failed to request withdrawal";
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(msg);
      }
    }
  };

  // Cancel pending withdrawal
  const handleCancelWithdrawal = async () => {
    if (!isConnected) return;

    try {
      await cancelWithdrawalAsync({
        args: [toolIdBigInt],
      });
      toast.success("Withdrawal request cancelled");
    } catch (error) {
      console.error("Cancel withdrawal failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel withdrawal");
    }
  };

  // Execute withdrawal (only after 7-day delay)
  const handleWithdraw = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to withdraw stake");
      return;
    }

    if (!canWithdrawNow) {
      toast.error("Must wait for 7-day withdrawal delay");
      return;
    }

    const amount = Number.parseFloat(withdrawAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (amount > staked) {
      toast.error("Cannot withdraw more than staked amount");
      return;
    }

    try {
      const amountInUsdc = parseUnits(withdrawAmount, 6); // USDC has 6 decimals

      withdrawStake({
        args: [toolIdBigInt, amountInUsdc],
      });
      toast.success("Withdrawal transaction submitted!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to withdraw stake"
      );
    }
  };

  // Close dialogs and reset on successful transactions (properly in useEffect)
  useEffect(() => {
    if (isDepositSuccess && isDepositOpen) {
      setIsDepositOpen(false);
      setDepositAmount("");
      toast.success("Stake deposited successfully!");
    }
  }, [isDepositSuccess, isDepositOpen]);

  useEffect(() => {
    if (isWithdrawSuccess && isWithdrawOpen) {
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      toast.success("Stake withdrawn successfully!");
      refetchWithdrawalStatus();
    }
  }, [isWithdrawSuccess, isWithdrawOpen, refetchWithdrawalStatus]);

  // Refetch withdrawal status after requesting/cancelling
  useEffect(() => {
    if (isRequestWithdrawalSuccess) {
      refetchWithdrawalStatus();
    }
  }, [isRequestWithdrawalSuccess, refetchWithdrawalStatus]);

  const isDepositBusy =
    isDepositing ||
    isDepositConfirming ||
    isApproving ||
    isApproveConfirming ||
    approvalStatus !== "idle";
  const isWithdrawBusy = isWithdrawing || isWithdrawConfirming;
  const isRequestBusy = isRequestingWithdrawal || isRequestWithdrawalConfirming || isCancellingWithdrawal;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{tool.name}</p>
          {hasEnough ? (
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  className="gap-1 bg-emerald-500/10 text-emerald-600"
                  variant="outline"
                >
                  <Shield className="size-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Fully staked</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  className="gap-1 bg-amber-500/10 text-amber-600"
                  variant="outline"
                >
                  <AlertTriangle className="size-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Need ${formatPrice(shortfall)} more
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          ${formatPrice(staked)} / ${formatPrice(required)} staked
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Deposit Dialog */}
        <Dialog onOpenChange={setIsDepositOpen} open={isDepositOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1" size="sm" variant="outline">
              <ArrowDownToLine className="size-3.5" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Stake</DialogTitle>
              <DialogDescription>
                Add USDC collateral for {tool.name}. Required: $
                {formatPrice(required)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="space-y-3">
                <Label htmlFor="deposit-amount">Amount (USDC)</Label>
                <Input
                  disabled={isDepositBusy}
                  id="deposit-amount"
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={shortfall > 0 ? formatPrice(shortfall) : "0.00"}
                  type="number"
                  value={depositAmount}
                />
                {shortfall > 0 && (
                  <p className="text-muted-foreground text-xs">
                    Suggested: ${formatPrice(shortfall)} to meet requirement
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isDepositBusy}
                onClick={handleDeposit}
                type="button"
              >
                {isDepositBusy ? (
                  <>
                    <span className="animate-spin">
                      <LoaderIcon size={16} />
                    </span>
                    {approvalStatus === "approving" ||
                    isApproving ||
                    isApproveConfirming
                      ? "Approving USDC..."
                      : isDepositConfirming
                        ? "Confirming..."
                        : "Depositing..."}
                  </>
                ) : (
                  "Deposit USDC"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Withdraw Dialog */}
        <Dialog onOpenChange={setIsWithdrawOpen} open={isWithdrawOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-1"
              disabled={staked === 0}
              size="sm"
              variant="ghost"
            >
              <ArrowUpFromLine className="size-3.5" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Stake</DialogTitle>
              <DialogDescription>
                Remove USDC collateral from {tool.name}. Current stake: $
                {formatPrice(staked)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              {/* Timelock Status Banner */}
              {hasPendingWithdrawal && (
                <div className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  canWithdrawNow 
                    ? "border-emerald-500/30 bg-emerald-500/10" 
                    : "border-amber-500/30 bg-amber-500/10"
                )}>
                  <Clock className={cn(
                    "size-5 shrink-0",
                    canWithdrawNow ? "text-emerald-600" : "text-amber-600"
                  )} />
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium text-sm",
                      canWithdrawNow ? "text-emerald-700" : "text-amber-700"
                    )}>
                      {canWithdrawNow ? "Ready to Withdraw" : "Withdrawal Pending"}
                    </p>
                    <p className={cn(
                      "text-xs",
                      canWithdrawNow ? "text-emerald-600/80" : "text-amber-600/80"
                    )}>
                      {canWithdrawNow 
                        ? "7-day delay complete. You can now withdraw."
                        : `Available in ${getTimeRemaining()}`
                      }
                    </p>
                  </div>
                  {!canWithdrawNow && (
                    <Button
                      className="shrink-0"
                      disabled={isRequestBusy}
                      onClick={handleCancelWithdrawal}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Step 1: Request Withdrawal (if not yet requested) */}
              {!hasPendingWithdrawal && (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">7-Day Withdrawal Delay</p>
                      <p className="text-muted-foreground text-xs">
                        For security, withdrawals require a 7-day waiting period.
                        This prevents front-running if disputes are filed.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={isRequestBusy}
                    onClick={handleRequestWithdrawal}
                    variant="outline"
                  >
                    {isRequestBusy ? (
                      <>
                        <span className="animate-spin">
                          <LoaderIcon size={16} />
                        </span>
                        Requesting...
                      </>
                    ) : (
                      "Request Withdrawal"
                    )}
                  </Button>
                </div>
              )}

              {/* Step 2: Enter Amount & Withdraw (only if delay passed) */}
              {canWithdrawNow && (
                <div className="space-y-3">
                  <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
                  <Input
                    disabled={isWithdrawBusy}
                    id="withdraw-amount"
                    max={staked}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    value={withdrawAmount}
                  />
                  {!hasEnough && (
                    <p className="text-destructive text-xs">
                      Warning: Withdrawing will leave tool under-staked
                    </p>
                  )}
                </div>
              )}
            </div>
            {canWithdrawNow && (
              <DialogFooter>
                <Button
                  disabled={isWithdrawBusy}
                  onClick={handleWithdraw}
                  type="button"
                  variant="outline"
                >
                  {isWithdrawBusy ? (
                    <>
                      <span className="animate-spin">
                        <LoaderIcon size={16} />
                      </span>
                      {isWithdrawConfirming ? "Confirming..." : "Withdrawing..."}
                    </>
                  ) : (
                    "Withdraw USDC"
                  )}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
