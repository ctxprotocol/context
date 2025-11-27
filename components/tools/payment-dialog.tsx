"use client";

import { useEffect, useState } from "react";
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
import { base } from "viem/chains";
import { CheckIcon } from "@/components/icons";
import { formatPrice } from "@/lib/utils";

export function PaymentDialog({
  open,
  onOpenChange,
  toolName,
  price,
  isBusy,
  onConfirm,
  chainId,
  onSwitchNetwork,
  isSwitchingNetwork,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  price: string;
  isBusy?: boolean;
  onConfirm: () => void;
  chainId?: number;
  onSwitchNetwork?: () => void;
  isSwitchingNetwork?: boolean;
}) {
  // Use local state to ensure reactivity to chainId changes
  const [currentChainId, setCurrentChainId] = useState(chainId);

  // Update local state when chainId prop changes
  useEffect(() => {
    setCurrentChainId(chainId);
  }, [chainId]);

  const isOnBaseMainnet = currentChainId === base.id;
  const canProceed = isOnBaseMainnet && !isBusy;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm payment</AlertDialogTitle>
          <AlertDialogDescription>
            Execute "{toolName}" for ${formatPrice(price)} USDC?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Network Status Indicator - matches content width (no extra padding needed) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
            {isOnBaseMainnet ? (
              <>
                <div className="flex size-5 items-center justify-center rounded-full bg-green-500/10">
                  <CheckIcon className="size-3 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium text-foreground">
                  Connected to Base
                </span>
              </>
            ) : (
              <>
                <div className="flex size-5 items-center justify-center rounded-full bg-orange-500/10">
                  <span className="font-semibold text-orange-600 text-xs dark:text-orange-400">
                    !
                  </span>
                </div>
                <span className="font-medium text-foreground">
                  Wrong network detected
                </span>
              </>
            )}
          </div>

          {!isOnBaseMainnet && (
            <p className="text-muted-foreground text-xs">
              All payments are executed on Base mainnet. Please switch your
              wallet network to continue.
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy || isSwitchingNetwork}>
            Cancel
          </AlertDialogCancel>
          {!isOnBaseMainnet && onSwitchNetwork ? (
            <Button
              disabled={isSwitchingNetwork}
              onClick={onSwitchNetwork}
              type="button"
            >
              {isSwitchingNetwork ? "Switching..." : "Switch to Base"}
            </Button>
          ) : (
            <AlertDialogAction disabled={!canProceed} onClick={onConfirm}>
              {isBusy ? "Processing..." : "Pay & run"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


