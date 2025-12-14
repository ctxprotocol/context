"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Shield,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { encodeFunctionData, type Hex, parseUnits } from "viem";
import { base } from "viem/chains";
import { useReadContract } from "wagmi";
import { toggleToolStatus } from "@/app/(chat)/developer/tools/actions";
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
import { trackEngagement } from "@/hooks/use-track-engagement";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { calculateRequiredStake } from "@/lib/constants";
import {
  contextRouterAbi,
  useReadContextRouterGetStake,
  useReadContextRouterGetWithdrawalStatus,
} from "@/lib/generated";
import { cn, formatPrice, uuidToUint256 } from "@/lib/utils";

type StakePanelProps = {
  tools: Array<{
    id: string;
    name: string;
    pricePerQuery: string;
    totalStaked: string | null;
    isActive: boolean;
  }>;
};

/**
 * StakePanel - Manage stakes for ALL tools
 *
 * All tools require developers to stake collateral as economic security.
 * Formula: MAX($1.00 minimum, 100x query price)
 *
 * Examples:
 *   Free tool ($0.00/query)   → $1.00 stake (minimum)
 *   $0.01/query tool          → $1.00 stake
 *   $0.10/query tool          → $10.00 stake
 *
 * This creates accountability similar to Apple's $99/year developer fee,
 * but the stake is fully refundable with a 7-day withdrawal delay.
 */
export function StakePanel({ tools }: StakePanelProps) {
  const { activeWallet } = useWalletIdentity();
  const isConnected = !!activeWallet?.address;

  // ALL tools require staking now (minimum $1 or 100x price)
  const toolsRequiringStake = tools;

  // Calculate total required vs total staked using the new formula
  const totalRequired = toolsRequiringStake.reduce((sum, tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    return sum + calculateRequiredStake(price);
  }, 0);

  const totalStaked = toolsRequiringStake.reduce((sum, tool) => {
    return sum + (Number.parseFloat(tool.totalStaked ?? "0") || 0);
  }, 0);

  const hasUnderstakedTools = toolsRequiringStake.some((tool) => {
    const price = Number.parseFloat(tool.pricePerQuery) || 0;
    const staked = Number.parseFloat(tool.totalStaked ?? "0") || 0;
    const required = calculateRequiredStake(price);
    return staked < required;
  });

  // Don't render if no tools
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
              $10 minimum or 100× query price • Refundable with 7-day delay
            </p>
          </div>
          {hasUnderstakedTools && (
            <Badge
              className="gap-1 bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-500"
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
                  ? "text-amber-600 dark:text-amber-500"
                  : "text-emerald-600 dark:text-emerald-400"
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
          Stake is held in the ContextRouter contract on Base. Withdrawals
          require a 7-day delay to prevent front-running disputes. Tools with
          insufficient stake remain inactive.
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
    isActive: boolean;
  };
  isConnected: boolean;
  walletAddress?: string;
}) {
  const router = useRouter();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<
    "idle" | "approving" | "depositing"
  >("idle");

  // Smart wallet for gas-sponsored transactions
  const { client: smartWalletClient } = useSmartWallets();
  const smartWalletAddress = smartWalletClient?.account?.address;

  // Contract addresses
  const routerAddress = process.env
    .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Transaction state management (replaces wagmi hooks)
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [isCancellingWithdrawal, setIsCancellingWithdrawal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Track successful transactions for effects
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [requestWithdrawalSuccess, setRequestWithdrawalSuccess] =
    useState(false);

  // Check current USDC allowance for the router (use smart wallet address)
  const allowanceCheckAddress = smartWalletAddress || walletAddress;
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: allowanceCheckAddress
        ? [allowanceCheckAddress as `0x${string}`, routerAddress]
        : undefined,
      query: {
        enabled: Boolean(allowanceCheckAddress && routerAddress && usdcAddress),
      },
    }
  );

  // Tool ID for contract calls (collision-free UUID conversion)
  const toolIdBigInt = uuidToUint256(tool.id);

  // Read stake amount directly from contract (source of truth)
  const { data: onChainStake, refetch: refetchStake } =
    useReadContextRouterGetStake({
      args: [toolIdBigInt],
      query: {
        enabled: Boolean(routerAddress),
      },
    });

  // Use on-chain stake if available, otherwise fall back to prop value
  const price = Number.parseFloat(tool.pricePerQuery) || 0;
  const stakedFromProp = Number.parseFloat(tool.totalStaked ?? "0") || 0;
  const stakedFromChain = onChainStake
    ? Number(onChainStake) / 1_000_000
    : null; // USDC has 6 decimals
  const staked = stakedFromChain ?? stakedFromProp;
  const required = calculateRequiredStake(price);
  const hasEnough = staked >= required;
  const shortfall = Math.max(0, required - staked);

  // Prefill deposit amount with shortfall when dialog opens
  useEffect(() => {
    if (isDepositOpen && shortfall > 0 && depositAmount === "") {
      setDepositAmount(formatPrice(shortfall));
    }
  }, [isDepositOpen, shortfall, depositAmount]);

  // Read withdrawal timelock status from contract (7-day delay)
  const { data: withdrawalStatus, refetch: refetchWithdrawalStatus } =
    useReadContextRouterGetWithdrawalStatus({
      args: [toolIdBigInt],
      query: {
        enabled: Boolean(routerAddress && staked > 0),
      },
    });

  // Parse withdrawal status (requestTime, availableAt, canWithdraw)
  const withdrawalRequestTime = withdrawalStatus?.[0]
    ? Number(withdrawalStatus[0])
    : 0;
  const withdrawalAvailableAt = withdrawalStatus?.[1]
    ? Number(withdrawalStatus[1])
    : 0;
  const canWithdrawNow = withdrawalStatus?.[2] ?? false;
  const hasPendingWithdrawal = withdrawalRequestTime > 0;

  // Calculate time remaining for pending withdrawal
  const getTimeRemaining = () => {
    if (!hasPendingWithdrawal || canWithdrawNow) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    const remaining = withdrawalAvailableAt - now;
    if (remaining <= 0) {
      return null;
    }
    const days = Math.floor(remaining / 86_400);
    const hours = Math.floor((remaining % 86_400) / 3600);
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to deposit stake");
      return;
    }

    if (!smartWalletClient) {
      toast.error("Smart wallet not ready. Please try again.");
      return;
    }

    const amount = Number.parseFloat(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      setIsDepositing(true);
      const amountInUsdc = parseUnits(depositAmount, 6); // USDC has 6 decimals

      // Check if we need approval first
      const currentAllowanceNum = currentAllowance
        ? BigInt(currentAllowance.toString())
        : BigInt(0);

      if (currentAllowanceNum < amountInUsdc) {
        // Need to approve first - use smart wallet for gas sponsorship
        setApprovalStatus("approving");
        setIsApproving(true);
        toast.info("Approving USDC spend...");

        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress, amountInUsdc],
        });

        await smartWalletClient.sendTransaction({
          chain: base,
          to: usdcAddress,
          data: approveData as Hex,
          value: BigInt(0),
        });

        setIsApproving(false);
        toast.success("USDC approved! Now depositing stake...");
        await refetchAllowance();
      }

      // Now deposit via smart wallet
      setApprovalStatus("depositing");
      const depositData = encodeFunctionData({
        abi: contextRouterAbi,
        functionName: "depositStake",
        args: [toolIdBigInt, amountInUsdc],
      });

      await smartWalletClient.sendTransaction({
        chain: base,
        to: routerAddress,
        data: depositData as Hex,
        value: BigInt(0),
      });

      toast.success("Deposit transaction submitted!");
      setDepositSuccess(true);
    } catch (error) {
      console.error("Deposit failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to deposit stake";
      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected") ||
        errorMessage.includes("denied")
      ) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setApprovalStatus("idle");
      setIsDepositing(false);
      setIsApproving(false);
    }
  };

  // Request withdrawal (starts 7-day timer) - via smart wallet
  const handleRequestWithdrawal = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to request withdrawal");
      return;
    }

    if (!smartWalletClient) {
      toast.error("Smart wallet not ready. Please try again.");
      return;
    }

    try {
      setIsRequestingWithdrawal(true);

      const requestWithdrawalData = encodeFunctionData({
        abi: contextRouterAbi,
        functionName: "requestWithdrawal",
        args: [toolIdBigInt],
      });

      await smartWalletClient.sendTransaction({
        chain: base,
        to: routerAddress,
        data: requestWithdrawalData as Hex,
        value: BigInt(0),
      });

      toast.success("Withdrawal requested! 7-day timer started.");
      setRequestWithdrawalSuccess(true);
    } catch (error) {
      console.error("Request withdrawal failed:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to request withdrawal";
      if (
        msg.includes("User rejected") ||
        msg.includes("user rejected") ||
        msg.includes("denied")
      ) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsRequestingWithdrawal(false);
    }
  };

  // Cancel pending withdrawal - via smart wallet
  const handleCancelWithdrawal = async () => {
    if (!isConnected) {
      return;
    }

    if (!smartWalletClient) {
      toast.error("Smart wallet not ready. Please try again.");
      return;
    }

    try {
      setIsCancellingWithdrawal(true);

      const cancelWithdrawalData = encodeFunctionData({
        abi: contextRouterAbi,
        functionName: "cancelWithdrawal",
        args: [toolIdBigInt],
      });

      await smartWalletClient.sendTransaction({
        chain: base,
        to: routerAddress,
        data: cancelWithdrawalData as Hex,
        value: BigInt(0),
      });

      toast.success("Withdrawal request cancelled");
    } catch (error) {
      console.error("Cancel withdrawal failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel withdrawal"
      );
    } finally {
      setIsCancellingWithdrawal(false);
    }
  };

  // Execute withdrawal (only after 7-day delay) - via smart wallet
  const handleWithdraw = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet to withdraw stake");
      return;
    }

    if (!smartWalletClient) {
      toast.error("Smart wallet not ready. Please try again.");
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
      setIsWithdrawing(true);
      const amountInUsdc = parseUnits(withdrawAmount, 6); // USDC has 6 decimals

      const withdrawStakeData = encodeFunctionData({
        abi: contextRouterAbi,
        functionName: "withdrawStake",
        args: [toolIdBigInt, amountInUsdc],
      });

      await smartWalletClient.sendTransaction({
        chain: base,
        to: routerAddress,
        data: withdrawStakeData as Hex,
        value: BigInt(0),
      });

      toast.success("Withdrawal transaction submitted!");
      setWithdrawSuccess(true);
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to withdraw stake"
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Close dialogs and reset on successful transactions (properly in useEffect)
  // Also immediately activate tool if stake now meets requirement
  useEffect(() => {
    if (depositSuccess && isDepositOpen) {
      // Calculate if stake now meets requirement BEFORE clearing the amount
      // Use the deposit amount to estimate new stake (on-chain will be authoritative)
      const depositedAmount = Number.parseFloat(depositAmount) || 0;
      const newStakeEstimate = staked + depositedAmount;
      const shouldActivate = !tool.isActive && newStakeEstimate >= required;

      setIsDepositOpen(false);
      setDepositAmount("");
      setDepositSuccess(false);
      toast.success("Stake deposited successfully!");

      // Refetch the on-chain stake to update the UI immediately
      refetchStake();

      // Protocol Ledger: Track stake deposit (developer economic commitment)
      trackEngagement({
        eventType: "TOOL_STAKED",
        resourceId: tool.id,
        metadata: {
          amount: depositedAmount,
          newTotalStake: newStakeEstimate,
          required,
          meetsRequirement: newStakeEstimate >= required,
        },
      });

      // If tool was inactive and stake now meets requirement, activate immediately
      // The cron will also catch this, but this provides instant feedback
      if (shouldActivate) {
        toggleToolStatus(tool.id, true)
          .then((result) => {
            if (result.success) {
              toast.success("Tool activated! Now visible in marketplace.");
            }
          })
          .catch(console.error);
      }

      // Refresh the page to update the ToolCard badge with new stake amount
      router.refresh();
    }
  }, [
    depositSuccess,
    isDepositOpen,
    depositAmount,
    staked,
    required,
    tool.isActive,
    tool.id,
    refetchStake,
    router,
  ]);

  useEffect(() => {
    if (withdrawSuccess && isWithdrawOpen) {
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawSuccess(false);
      toast.success("Stake withdrawn successfully!");
      // Refetch both stake and withdrawal status
      refetchStake();
      refetchWithdrawalStatus();
    }
  }, [withdrawSuccess, isWithdrawOpen, refetchStake, refetchWithdrawalStatus]);

  // Handle successful withdrawal request - immediately deactivate tool
  // This prevents the tool from being used during the 7-day withdrawal period
  useEffect(() => {
    if (requestWithdrawalSuccess) {
      refetchWithdrawalStatus();
      setRequestWithdrawalSuccess(false);

      // Immediately deactivate the tool when withdrawal is requested
      // The cron will also catch this, but this provides instant action
      // Once a withdrawal is requested, the tool should not be visible in the marketplace
      if (tool.isActive) {
        toggleToolStatus(tool.id, false)
          .then((result) => {
            if (result.success) {
              toast.info("Tool deactivated during withdrawal period.");
            }
          })
          .catch(console.error);
      }
    }
  }, [
    requestWithdrawalSuccess,
    refetchWithdrawalStatus,
    tool.isActive,
    tool.id,
  ]);

  const isDepositBusy =
    isDepositing || isApproving || approvalStatus !== "idle";
  const isWithdrawBusy = isWithdrawing;
  const isRequestBusy = isRequestingWithdrawal || isCancellingWithdrawal;

  // Check if smart wallet is ready
  const isSmartWalletReady = Boolean(smartWalletClient?.account);

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
                  className="gap-1 bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-500"
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
                disabled={isDepositBusy || !isSmartWalletReady}
                onClick={handleDeposit}
                type="button"
              >
                {isSmartWalletReady ? (
                  isDepositBusy ? (
                    <>
                      <span className="animate-spin">
                        <LoaderIcon size={16} />
                      </span>
                      {approvalStatus === "approving" || isApproving
                        ? "Approving USDC..."
                        : "Depositing..."}
                    </>
                  ) : (
                    "Deposit USDC"
                  )
                ) : (
                  "Preparing wallet..."
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
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-3",
                    canWithdrawNow
                      ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                      : "bg-amber-500/10 dark:bg-amber-500/15"
                  )}
                >
                  <Clock
                    className={cn(
                      "size-5 shrink-0",
                      canWithdrawNow
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-500"
                    )}
                  />
                  <div className="flex-1">
                    <p
                      className={cn(
                        "font-medium text-sm",
                        canWithdrawNow
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {canWithdrawNow
                        ? "Ready to Withdraw"
                        : "Withdrawal Pending"}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        canWithdrawNow
                          ? "text-emerald-600/80 dark:text-emerald-400/80"
                          : "text-amber-600/80 dark:text-amber-500/80"
                      )}
                    >
                      {canWithdrawNow
                        ? "7-day delay complete. You can now withdraw."
                        : `Available in ${getTimeRemaining()}`}
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
                      <p className="font-medium text-sm">
                        7-Day Withdrawal Delay
                      </p>
                      <p className="text-muted-foreground text-xs">
                        For security, withdrawals require a 7-day waiting
                        period. This prevents front-running if disputes are
                        filed.
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
                      Withdrawing...
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
