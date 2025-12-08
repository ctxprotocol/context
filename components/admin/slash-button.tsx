"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { contextRouterAbi } from "@/lib/generated"; // ensure this exists

interface SlashButtonProps {
  toolId: string;
  disputeId: string;
  toolName: string;
  amount: string; // USDC amount to slash (e.g. "50.00")
  contractAddress: string;
}

export function SlashButton({
  toolId,
  disputeId,
  toolName,
  amount,
  contractAddress,
}: SlashButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  const isPending = isWritePending || isConfirming;

  // The API call and writeContract logic is handled in onConfirm below.
  // This component uses a two-step pattern:
  // 1. User clicks "Slash Stake" -> modal opens
  // 2. User confirms -> onConfirm calls API, then triggers writeContract

  const onConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      toast.loading("Preparing transaction...");
      const res = await fetch("/api/admin/slash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, disputeId, amount }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to prepare transaction");
      }

      const { details } = await res.json();
      toast.dismiss();

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: contextRouterAbi,
        functionName: "slash",
        args: [
          BigInt(details.toolIdNumeric),
          BigInt(details.amountWei),
          details.reason,
        ],
      });
    } catch (error) {
      toast.dismiss();
      toast.error("Failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Effect to close modal and show success
  if (isConfirmed && open) {
    setOpen(false);
    toast.success("Stake Slashed Successfully", {
      description: `Transaction: ${hash}`,
    });
    router.refresh();
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2" size="sm" variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          Slash Stake
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Slash Tool Stake?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to slash <strong>${amount} USDC</strong>{" "}
              from Wait, the tool is <strong>{toolName}</strong>?
            </p>
            <p className="font-medium text-red-500 text-sm">
              This action requires an on-chain transaction and cannot be undone.
              The funds will be seized by the protocol.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConfirming ? "Confirming..." : "Sign in Wallet..."}
              </>
            ) : (
              "Slash Stake"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
