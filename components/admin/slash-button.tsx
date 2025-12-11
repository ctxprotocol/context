"use client";

import { Loader2, ShieldAlert, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { parseUnits } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { contextRouterAbi } from "@/lib/generated";

type CompensationPreview = {
  totalSlash: string;
  totalRefunds: string;
  bounty: string;
  adjudicationFee: string;
  firstReporterWallet: string | null;
  userCount: number;
};

type AffectedUser = {
  wallet: string;
  refund: string;
  isFirstReporter: boolean;
  disputeId: string;
};

type SlashButtonProps = {
  toolId: string;
  toolName: string;
  contractAddress: string;
};

export function SlashButton({
  toolId,
  toolName,
  contractAddress,
}: SlashButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compensation, setCompensation] = useState<CompensationPreview | null>(
    null
  );
  const [affectedUsers, setAffectedUsers] = useState<AffectedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  const isPending = isWritePending || isConfirming;

  const fetchCompensationPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/slash?toolId=${toolId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch preview");
      }
      const data = await res.json();
      setCompensation(data.compensation);
      setAffectedUsers(data.affectedUsers);

      if (!data.canSlash) {
        if (data.insufficientStake) {
          setError(
            `Insufficient stake. Need $${data.compensation.totalRefunds} but only $${data.tool.stake} staked.`
          );
        } else if (data.compensation.userCount === 0) {
          setError("No affected users found. At least one dispute must exist.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  // Fetch compensation preview when modal opens
  useEffect(() => {
    if (open && !compensation) {
      fetchCompensationPreview();
    }
  }, [open, compensation, fetchCompensationPreview]);

  const onConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!compensation) {
      toast.error("Compensation data not loaded");
      return;
    }

    try {
      toast.loading("Preparing transaction...");
      const res = await fetch("/api/admin/slash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId,
          slashAmount: compensation.totalSlash,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to prepare transaction");
      }

      const { details, affectedUsers: users } = await res.json();
      toast.dismiss();

      // Build arrays for contract call
      const recipients = users.map(
        (u: AffectedUser) => u.wallet as `0x${string}`
      );
      const refundAmounts = users.map((u: AffectedUser) =>
        parseUnits(u.refund, 6)
      );

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: contextRouterAbi,
        functionName: "slashAndCompensateAll",
        args: [
          BigInt(details.toolIdNumeric),
          BigInt(details.slashAmountWei),
          recipients,
          refundAmounts,
          compensation.firstReporterWallet as `0x${string}`,
          details.reason,
        ],
      });
    } catch (err) {
      toast.dismiss();
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  // Effect to close modal and show success
  if (isConfirmed && open) {
    setOpen(false);
    toast.success("Stake Slashed & Users Compensated!", {
      description: `Transaction: ${hash}`,
    });
    router.refresh();
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setCompensation(null);
      setAffectedUsers([]);
      setError(null);
    }
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2" size="sm" variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          Slash & Compensate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Slash & Compensate All Users?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Slash stake from <strong>{toolName}</strong> and compensate all
                affected users.
              </p>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/50 dark:text-red-400">
                  {error}
                </div>
              )}

              {compensation && !error && (
                <>
                  {/* Compensation Breakdown */}
                  <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                    <h4 className="font-medium text-sm">
                      Compensation Breakdown
                    </h4>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Total Slash:
                        </span>
                        <span className="font-medium font-mono">
                          ${compensation.totalSlash}
                        </span>
                      </div>

                      <div className="space-y-1 border-t pt-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            Refunds ({compensation.userCount} users):
                          </span>
                          <span className="font-mono text-green-600 dark:text-green-400">
                            ${compensation.totalRefunds}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Trophy className="h-3.5 w-3.5" />
                            Bounty (first reporter):
                          </span>
                          <span className="font-mono text-yellow-600 dark:text-yellow-400">
                            ${compensation.bounty}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Adjudication Fee:
                          </span>
                          <span className="font-mono">
                            ${compensation.adjudicationFee}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* First Reporter */}
                  {compensation.firstReporterWallet && (
                    <div className="rounded-md bg-yellow-50 p-3 text-sm dark:bg-yellow-950/30">
                      <p className="flex items-center gap-1.5 font-medium text-yellow-800 dark:text-yellow-200">
                        <Trophy className="h-4 w-4" />
                        First Reporter (Gets Bounty)
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-yellow-700 dark:text-yellow-300">
                        {compensation.firstReporterWallet}
                      </p>
                      <p className="mt-1 text-yellow-600 dark:text-yellow-400">
                        Receives: $
                        {affectedUsers.length > 0 &&
                        affectedUsers[0].isFirstReporter
                          ? (
                              Number.parseFloat(affectedUsers[0].refund) +
                              Number.parseFloat(compensation.bounty)
                            ).toFixed(2)
                          : compensation.bounty}
                      </p>
                    </div>
                  )}

                  {/* Affected Users List */}
                  {affectedUsers.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/50">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">
                              Wallet
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium">
                              Refund
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {affectedUsers.map((affUser) => (
                            <tr
                              className={
                                affUser.isFirstReporter
                                  ? "bg-yellow-50/50 dark:bg-yellow-950/20"
                                  : ""
                              }
                              key={affUser.disputeId}
                            >
                              <td className="max-w-[200px] truncate px-2 py-1.5 font-mono">
                                {affUser.wallet.slice(0, 6)}...
                                {affUser.wallet.slice(-4)}
                                {affUser.isFirstReporter && (
                                  <span className="ml-1.5 text-yellow-600">
                                    🏆
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                ${affUser.refund}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-red-500 text-xs">
                    ⚠️ This action requires an on-chain transaction and cannot be
                    undone.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={isPending || loading || !!error || !compensation}
            onClick={onConfirm}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConfirming ? "Confirming..." : "Sign in Wallet..."}
              </>
            ) : (
              "Slash & Compensate All"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
