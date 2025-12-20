"use client";

import { useState, useEffect } from "react";
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
  /** Minimum amount needed for the current query (displayed as first option) */
  amountLabel: string;
  isFunding: boolean;
  onDismiss?: () => void;
  /** Called with the selected funding amount */
  onFund: (amount: number) => void;
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
  // Parse the minimum amount needed
  const minAmount = Number.parseFloat(amountLabel) || 0.01;
  const normalizedMinAmount = formatPrice(minAmount);

  // Default to $10 (best for onboarding UX - covers multiple queries)
  const [selectedAmount, setSelectedAmount] = useState(10);

  // Reset to $10 when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAmount(10);
    }
  }, [open]);

  const handleFund = () => {
    onFund(selectedAmount);
  };

  const options = [
    { label: normalizedMinAmount, value: minAmount },
    { label: "$10", value: 10 },
    { label: "$50", value: 50 },
    { label: "$100", value: 100 },
  ].filter(
    (opt, index, self) => index === self.findIndex((t) => t.value === opt.value)
  );

  // Deduplicate tool names (e.g., "Hyperliquid, Hyperliquid, Hyperliquid" → "Hyperliquid")
  const uniqueToolNames = toolName
    ? [...new Set(toolName.split(", ").map((t) => t.trim()))].join(", ")
    : undefined;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="max-w-md rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Add funds to continue</AlertDialogTitle>
          <AlertDialogDescription>
            {uniqueToolNames
              ? `You need at least ${normalizedMinAmount} USDC on Base to use ${uniqueToolNames}.`
              : `You need at least ${normalizedMinAmount} USDC on Base to continue.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Funding Amount Selector */}
          <div className="space-y-2">
            <span className="font-medium text-sm">Add Funds</span>
            <div className="flex gap-2">
              {options.map((option) => (
                <button
                  className={`flex-1 rounded-md border px-3 py-2 font-medium text-sm transition-colors ${
                    selectedAmount === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                  disabled={isFunding}
                  key={option.value}
                  onClick={() => setSelectedAmount(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Add more to avoid funding again soon. $10 covers many queries.
            </p>
          </div>

          {walletAddress ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                Funds will be deposited into {formatWalletAddress(walletAddress)}{" "}
                (your smart wallet).
              </p>
              {showResendHint ? (
                <p className="font-medium text-muted-foreground">
                  Your query will automatically continue after funding.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

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
            onClick={handleFund}
            type="button"
          >
            {isFunding ? "Opening onramp…" : `Add $${selectedAmount}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
