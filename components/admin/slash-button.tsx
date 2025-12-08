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

  const handleSlash = async () => {
    try {
      // 1. Prepare transaction data via API (acts as a check and formats data)
      const res = await fetch("/api/admin/slash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, disputeId, amount }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to prepare slash transaction");
      }

      const { transaction } = await res.json();

      // 2. Execute on-chain
      writeContract({
        address: transaction.to as `0x${string}`,
        abi: contextRouterAbi,
        functionName: "slash",
        args: [
          // We need to parse the args from the API response specifically if they are complex
          // But here we can just use the args we know:
          // slash(uint256 toolId, uint256 amount, string reason)
          // However, the API returns raw calldata.
          // Can we just send the raw transaction? useWriteContract expects abi/functionName for type safety usually.
          // Let's rely on the API for validation but construct args here to be safe with wagmi type inference.
          // Actually, the API returns `transaction` object with `data`.
          // Wagmi's sendTransaction might be more appropriate if we have raw data,
          // but writeContract is better for ABI interaction.
          // let's parse the BigInts.
          // toolId needs to be numeric. The API does `uuidToNumeric`. We should probably expose that helper or just use the one from api response "details".
          // Let's use the details from api response.
        ],
      });

      // WAIT. writing raw calldata with wagmi is `sendTransaction`.
      // But verify-tool uses server-side logic? No, verify-tool was simple DB update.
      // Slash is on-chain.

      // Let's use the `details` from the API response to call writeContract properly.
      // We need to fetch first in the onClick, then write.

      // Refetching to get the numeric ID inside the event handler:
      // We already did the fetch above.
    } catch (err) {
      toast.error("Error preparing slash", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setOpen(false); // Close modal on error
    }
  };

  // Re-implementing handleSlash to properly wait for the API and then write
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
