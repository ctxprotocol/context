"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, ChevronUp, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useReadContract } from "wagmi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useWalletIdentity } from "@/hooks/use-wallet-identity";
import { ERC20_ABI } from "@/lib/abi/erc20";
import { formatWalletAddress } from "@/lib/utils";
import { CheckIcon, CopyIcon, LoaderIcon } from "./icons";
import { toast } from "sonner";
import { WithdrawDialog } from "./withdraw-dialog";

export function SidebarUserNav() {
  const { status, data: session } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const {
    ready,
    authenticated,
    user: privyUser,
    logout,
    exportWallet,
  } = usePrivy();

  const isConnected = authenticated;
  const userEmail = privyUser?.email?.address;
  const [copied, setCopied] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { activeWallet } = useWalletIdentity();
  const { client: smartWalletClient } = useSmartWallets();

  const walletAddress = activeWallet?.address;
  const smartWalletAddress = smartWalletClient?.account?.address;

  // Use smart wallet address for balance if available, otherwise use active wallet
  const balanceCheckAddress = (smartWalletAddress || walletAddress) as
    | `0x${string}`
    | undefined;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: balanceCheckAddress ? [balanceCheckAddress] : undefined,
    query: {
      enabled: Boolean(balanceCheckAddress && usdcAddress),
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Format USDC balance (6 decimals)
  // Show actual balance with up to 4 decimals for micropayment precision
  const formattedBalance = (() => {
    if (!usdcBalance) return "0.00";
    const balanceNumber = Number(usdcBalance) / 1_000_000;
    if (balanceNumber === 0) return "0.00";
    const twoDecimals = balanceNumber.toFixed(2);
    const fourDecimals = balanceNumber.toFixed(4);
    // If 2 decimals loses precision, show 4
    return Number.parseFloat(twoDecimals) !== Number.parseFloat(fourDecimals)
      ? fourDecimals.replace(/0+$/, "").replace(/\.$/, "")
      : twoDecimals;
  })();

  // Display email if available, otherwise show formatted wallet address
  const displayName = isConnected
    ? userEmail || (walletAddress ? formatWalletAddress(walletAddress) : "User")
    : "Connect Wallet";

  const { login } = useLogin({
    onComplete: ({ user }) => {
      console.log("Privy login complete", user);
      // That's it! The session sync hook will handle NextAuth sign-in
      toast.success("Successfully signed in!");
    },
    onError: (error) => {
      // "exited_auth_flow" is not a real error - it just means the user closed the modal
      if (error === "exited_auth_flow") {
        return;
      }
      console.error("Privy login error:", error);
      toast.error("Failed to log in with Privy.");
    },
  });

  const handleSignOut = async () => {
    if (ready && authenticated) {
      await logout();
    }
    // Next-auth signout
    await signOut({ callbackUrl: "/" });
  };

  // The display address is the smart wallet (where funds are)
  const displayAddress = smartWalletAddress || walletAddress;
  // The signer address is the EOA (what gets exported)
  const signerAddress = walletAddress;

  const handleCopyAddress = async (address: string | undefined, label: string) => {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("Failed to copy address.");
    }
  };

  const handleExportWallet = async () => {
    try {
      await exportWallet();
    } catch (error) {
      console.error("Export wallet error:", error);
      toast.error("Failed to export wallet. Please try again.");
    }
  };

  // Render dropdown menu for authenticated users
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-10 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
                  <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <Image
                  alt={displayAddress ? "Wallet Avatar" : "User Avatar"}
                  className="rounded-full"
                  height={24}
                  src={`https://avatar.vercel.sh/${displayAddress ?? "default"}`}
                  width={24}
                />
                <span className="truncate" data-testid="user-email">
                  {displayName}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link className="w-full cursor-pointer" href="/settings">
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="w-full cursor-pointer" href="/contribute">
                Contribute a tool
              </Link>
            </DropdownMenuItem>
            {session?.user?.isDeveloper && (
              <DropdownMenuItem asChild>
                <Link className="w-full cursor-pointer" href="/developer/tools">
                  <Wrench className="mr-2 h-4 w-4" />
                  My Tools
                </Link>
              </DropdownMenuItem>
            )}
            {isConnected && displayAddress && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center justify-between font-normal text-muted-foreground text-xs">
                  <span>Your wallet</span>
                  <span className="font-medium text-foreground">
                    ${formattedBalance} USDC
                  </span>
                </DropdownMenuLabel>
                {/* Smart wallet address - where funds are held */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="user-nav-item-copy"
                  onSelect={() => handleCopyAddress(displayAddress, "Wallet address")}
                >
                  <span className="flex items-center gap-2">
                    {copied ? (
                      <>
                        <CheckIcon size={14} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon size={14} />
                        {formatWalletAddress(displayAddress)}
                      </>
                    )}
                  </span>
                </DropdownMenuItem>
                {/* Withdraw funds from smart wallet */}
                {smartWalletAddress && (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    data-testid="user-nav-item-withdraw"
                    onSelect={() => setWithdrawOpen(true)}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpRight size={14} />
                      Withdraw funds
                    </span>
                  </DropdownMenuItem>
                )}
                {/* Export the signer (EOA) which controls the smart wallet */}
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="user-nav-item-export"
                  onSelect={handleExportWallet}
                >
                  Export signer key
                </DropdownMenuItem>
                {/* Show signer address for advanced users */}
                {smartWalletAddress && signerAddress && smartWalletAddress !== signerAddress && (
                  <DropdownMenuItem
                    className="cursor-pointer text-muted-foreground text-xs"
                    onSelect={() => handleCopyAddress(signerAddress, "Signer address")}
                  >
                    <span className="flex items-center gap-2">
                      <CopyIcon size={12} />
                      <span>Signer: {formatWalletAddress(signerAddress)}</span>
                    </span>
                  </DropdownMenuItem>
                )}
              </>
            )}
              <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === "loading") {
                    toast.error("Checking authentication status, please try again!");
                    return;
                  }

                  if (isConnected) {
                    handleSignOut();
                  } else {
                    login();
                  }
                }}
                type="button"
              >
                {isConnected ? "Sign out" : "Login to your account"}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Withdraw dialog */}
        <WithdrawDialog
          onOpenChange={setWithdrawOpen}
          open={withdrawOpen}
          signerAddress={signerAddress}
          smartWalletAddress={smartWalletAddress}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
