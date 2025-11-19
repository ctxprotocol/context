"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatWalletAddress } from "@/lib/utils";

type AddFundsDialogProps = {
  amountLabel: string;
  isFunding: boolean;
  onDismiss?: () => void;
  onFund: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  toolName?: string;
  walletAddress?: string;
};

export function AddFundsDialog({
  amountLabel,
  isFunding,
  onDismiss,
  onFund,
  onOpenChange,
  open,
  toolName,
  walletAddress,
}: AddFundsDialogProps) {
  const normalizedAmount =
    Number(amountLabel) > 0 ? Number(amountLabel).toFixed(2) : amountLabel;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="max-w-sm rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Add funds to continue</AlertDialogTitle>
          <AlertDialogDescription>
            {toolName
              ? `You need at least ${normalizedAmount} USDC on Base to use ${toolName}.`
              : `You need at least ${normalizedAmount} USDC on Base to continue.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {walletAddress ? (
          <p className="text-muted-foreground text-sm">
            Funds will be deposited into {formatWalletAddress(walletAddress)}{" "}
            (embedded wallet).
          </p>
        ) : null}

        <AlertDialogFooter className="mt-4">
          <Button
            disabled={isFunding}
            onClick={() => {
              onDismiss?.();
              onOpenChange(false);
            }}
            type="button"
            variant="outline"
          >
            Not now
          </Button>
          <Button
            className="min-w-28"
            disabled={isFunding}
            onClick={onFund}
            type="button"
          >
            {isFunding ? "Opening onramp…" : "Add funds"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
