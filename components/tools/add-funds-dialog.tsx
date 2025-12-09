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
import { formatPrice, formatWalletAddress } from "@/lib/utils";

type AddFundsDialogProps = {
  amountLabel: string;
  isFunding: boolean;
  onDismiss?: () => void;
  onFund: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Show hint to resend message after funding (for Auto Mode) */
  showResendHint?: boolean;
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
  showResendHint,
  toolName,
  walletAddress,
}: AddFundsDialogProps) {
  // Use formatPrice to properly display micropayments (e.g., $0.0001)
  const normalizedAmount = formatPrice(amountLabel);

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
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Context is a pay-per-query marketplace where you pay only for the
              AI tools you use. Funds are held in your smart wallet and spent
              automatically.
            </p>
            <p className="text-muted-foreground">
              Funds will be deposited into {formatWalletAddress(walletAddress)}{" "}
              (smart wallet, controlled by your embedded signer).
            </p>
            {showResendHint ? (
              <p className="text-muted-foreground">
                After adding funds, resend your message to continue.
              </p>
            ) : null}
          </div>
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
