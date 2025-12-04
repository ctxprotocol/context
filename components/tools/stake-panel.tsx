"use client";

import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import {
  useWriteContextRouterDepositStake,
  useWriteContextRouterWithdrawStake,
  useWriteErc20Approve,
} from "@/lib/generated";
import { cn, formatPrice, uuidToUint256 } from "@/lib/utils";

// Staking threshold: $1.00 per query requires collateral
const STAKING_THRESHOLD = 1.0;
// Required stake = 100x the query price
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
 * StakePanel - Manage stakes for high-value tools
 * 
 * Tools priced >= $1.00/query require developers to stake 100x the query price
 * as collateral. This provides economic security for users against scams.
 */
export function StakePanel({ tools }: StakePanelProps) {
  const { activeWallet } = useWalletIdentity();
  const isConnected = !!activeWallet?.address;

  // Filter to tools that require staking (price >= $1.00)
  const toolsRequiringStake = tools.filter((tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    return price >= STAKING_THRESHOLD;
  });

  // Calculate total required vs total staked
  const totalRequired = toolsRequiringStake.reduce((sum, tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    return sum + (price * STAKE_MULTIPLIER);
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
              High-value tools (${STAKING_THRESHOLD}+/query) require collateral
            </p>
          </div>
          {hasUnderstakedTools && (
            <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600">
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
            <p className={cn(
              "font-bold text-lg",
              totalStaked < totalRequired ? "text-amber-600" : "text-emerald-600"
            )}>
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
                key={tool.id}
                isConnected={isConnected}
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
  tool: { id: string; name: string; pricePerQuery: string; totalStaked: string | null };
  isConnected: boolean;
  walletAddress?: string;
}) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "approving" | "depositing">("idle");

  // Contract addresses
  const routerAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Contract hooks for staking
  const { writeContractAsync: depositStakeAsync, isPending: isDepositing, data: depositTxHash } = 
    useWriteContextRouterDepositStake();
  const { writeContract: withdrawStake, isPending: isWithdrawing, data: withdrawTxHash } = 
    useWriteContextRouterWithdrawStake();
  
  // USDC approval hook
  const { writeContractAsync: approveUsdcAsync, isPending: isApproving, data: approveTxHash } = 
    useWriteErc20Approve();
  
  // Wait for transaction confirmations
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = 
    useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = 
    useWaitForTransactionReceipt({ hash: depositTxHash });
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = 
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  // Check current USDC allowance for the router
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: walletAddress ? [walletAddress as `0x${string}`, routerAddress] : undefined,
    query: {
      enabled: Boolean(walletAddress && routerAddress && usdcAddress),
    },
  });

  const price = Number.parseFloat(tool.pricePerQuery) || 0;
  const staked = Number.parseFloat(tool.totalStaked ?? "0") || 0;
  const required = price * STAKE_MULTIPLIER;
  const hasEnough = staked >= required;
  const shortfall = Math.max(0, required - staked);

  // Tool ID conversion using full UUID (collision-free)
  // See lib/utils.ts uuidToUint256 for implementation details

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
      const currentAllowanceNum = currentAllowance ? BigInt(currentAllowance.toString()) : BigInt(0);
      
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
      const errorMessage = error instanceof Error ? error.message : "Failed to deposit stake";
      if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setApprovalStatus("idle");
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to withdraw stake");
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
      const toolIdBigInt = uuidToUint256(tool.id);
      
      withdrawStake({
        args: [toolIdBigInt, amountInUsdc],
      });
      toast.success("Withdrawal transaction submitted!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to withdraw stake");
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
    }
  }, [isWithdrawSuccess, isWithdrawOpen]);

  const isDepositBusy = isDepositing || isDepositConfirming || isApproving || isApproveConfirming || approvalStatus !== "idle";
  const isWithdrawBusy = isWithdrawing || isWithdrawConfirming;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{tool.name}</p>
          {hasEnough ? (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600">
                  <Shield className="size-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Fully staked</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="size-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Need ${formatPrice(shortfall)} more</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          ${formatPrice(staked)} / ${formatPrice(required)} staked
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Deposit Dialog */}
        <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <ArrowDownToLine className="size-3.5" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Stake</DialogTitle>
              <DialogDescription>
                Add USDC collateral for {tool.name}. Required: ${formatPrice(required)}
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
              <Button disabled={isDepositBusy} onClick={handleDeposit} type="button">
                {isDepositBusy ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {approvalStatus === "approving" || isApproving || isApproveConfirming
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
        <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={staked === 0}
              size="sm"
              variant="ghost"
              className="gap-1"
            >
              <ArrowUpFromLine className="size-3.5" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Stake</DialogTitle>
              <DialogDescription>
                Remove USDC collateral from {tool.name}. Current stake: ${formatPrice(staked)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
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
            </div>
            <DialogFooter>
              <Button disabled={isWithdrawBusy} onClick={handleWithdraw} type="button" variant="outline">
                {isWithdrawBusy ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {isWithdrawConfirming ? "Confirming..." : "Withdrawing..."}
                  </>
                ) : (
                  "Withdraw USDC"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

