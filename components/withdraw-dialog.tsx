"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useState } from "react";
import { toast } from "sonner";
import { encodeFunctionData, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { LoaderIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { formatWalletAddress } from "@/lib/utils";

type WithdrawDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  signerAddress?: string;
  smartWalletAddress?: string;
};

export function WithdrawDialog({
  onOpenChange,
  open,
  signerAddress,
  smartWalletAddress,
}: WithdrawDialogProps) {
  const [destinationAddress, setDestinationAddress] = useState(
    signerAddress ?? ""
  );
  const [amount, setAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const { client: smartWalletClient } = useSmartWallets();
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Read USDC balance of smart wallet
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: smartWalletAddress
      ? [smartWalletAddress as `0x${string}`]
      : undefined,
    query: {
      enabled: Boolean(smartWalletAddress && usdcAddress),
    },
  });

  // Format balance for display (6 decimals for USDC)
  const balanceNumber = usdcBalance ? Number(usdcBalance) / 1_000_000 : 0;
  // Show actual balance with up to 4 decimals for micropayment precision
  // Always show at least 2 decimal places for currency
  const formattedBalance = (() => {
    if (balanceNumber === 0) return "0.00";
    // Check if we need more than 2 decimals
    const twoDecimals = balanceNumber.toFixed(2);
    const fourDecimals = balanceNumber.toFixed(4);
    // If 2 decimals loses precision, show 4
    return Number.parseFloat(twoDecimals) !== Number.parseFloat(fourDecimals)
      ? fourDecimals.replace(/0+$/, "").replace(/\.$/, "")
      : twoDecimals;
  })();

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setDestinationAddress(signerAddress ?? "");
      setAmount("");
    }
    onOpenChange(newOpen);
  };

  const handleSetMax = () => {
    setAmount(balanceNumber.toString());
  };

  const handleWithdraw = async () => {
    if (!smartWalletClient || !destinationAddress || !amount) {
      toast.error("Please fill in all fields.");
      return;
    }

    // Validate address
    if (!destinationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid destination address.");
      return;
    }

    const withdrawAmount = Number.parseFloat(amount);
    if (Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (withdrawAmount > balanceNumber) {
      toast.error("Insufficient balance.");
      return;
    }

    setIsWithdrawing(true);

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(amount, 6);

      // Encode the ERC20 transfer call
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [destinationAddress as `0x${string}`, amountInUnits],
      });

      // Send transaction from smart wallet (gas sponsored)
      const txHash = await smartWalletClient.sendTransaction({
        account: smartWalletClient.account,
        chain: smartWalletClient.chain,
        to: usdcAddress,
        data: transferData,
        value: BigInt(0),
      });

      console.log("[withdraw] Transaction sent:", txHash);

      toast.success(
        `Successfully withdrew ${amount} USDC to ${formatWalletAddress(destinationAddress)}`
      );

      // Refresh balance
      await refetchBalance();

      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error("[withdraw] Error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Withdrawal failed. Please try again."
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent className="max-w-sm rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw USDC</AlertDialogTitle>
          <AlertDialogDescription>
            Transfer USDC from your smart wallet to any address.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          {/* Balance display */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground text-sm">
              Available balance
            </span>
            <span className="font-medium">${formattedBalance} USDC</span>
          </div>

          {/* Destination address */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination address</Label>
            <Input
              id="destination"
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="0x..."
              value={destinationAddress}
            />
            {signerAddress && destinationAddress === signerAddress && (
              <p className="text-muted-foreground text-xs">
                Sending to your signer wallet (exportable to MetaMask)
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Button
                className="h-auto px-2 py-0.5 text-xs"
                disabled={balanceNumber === 0}
                onClick={handleSetMax}
                type="button"
                variant="ghost"
              >
                Max
              </Button>
            </div>
            <Input
              id="amount"
              min="0"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              type="number"
              value={amount}
            />
          </div>

          {/* Info text */}
          <p className="text-muted-foreground text-xs">
            Gas fees are sponsored. You will receive the full amount at the
            destination address.
          </p>
        </div>

        <AlertDialogFooter className="mt-4">
          <Button
            disabled={isWithdrawing}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="min-w-28"
            disabled={
              isWithdrawing ||
              !amount ||
              !destinationAddress ||
              balanceNumber === 0
            }
            onClick={handleWithdraw}
            type="button"
          >
            {isWithdrawing ? (
              <>
                <span className="mr-2 animate-spin">
                  <LoaderIcon size={16} />
                </span>
                Sending…
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
