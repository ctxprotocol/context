"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { ChevronUp } from "lucide-react";
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
import { toast } from "./toast";

export function SidebarUserNav() {
  const { status } = useSession();
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
  const formattedBalance = usdcBalance
    ? (Number(usdcBalance) / 1_000_000).toFixed(2)
    : "0.00";

  // Display email if available, otherwise show formatted wallet address
  const displayName = isConnected
    ? userEmail || (walletAddress ? formatWalletAddress(walletAddress) : "User")
    : "Connect Wallet";

  const { login } = useLogin({
    onComplete: ({ user }) => {
      console.log("Privy login complete", user);
      // That's it! The session sync hook will handle NextAuth sign-in
      toast({ type: "success", description: "Successfully signed in!" });
    },
    onError: (error) => {
      // "exited_auth_flow" is not a real error - it just means the user closed the modal
      if (error === "exited_auth_flow") {
        return;
      }
      console.error("Privy login error:", error);
      toast({ type: "error", description: "Failed to log in with Privy." });
    },
  });

  const handleSignOut = async () => {
    if (ready && authenticated) {
      await logout();
    }
    // Next-auth signout
    await signOut({ callbackUrl: "/" });
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast({
        type: "success",
        description: "Address copied to clipboard!",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy error:", error);
      toast({
        type: "error",
        description: "Failed to copy address.",
      });
    }
  };

  const handleExportWallet = async () => {
    try {
      await exportWallet();
    } catch (error) {
      console.error("Export wallet error:", error);
      toast({
        type: "error",
        description: "Failed to export wallet. Please try again.",
      });
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
                  alt={walletAddress ? "Wallet Avatar" : "User Avatar"}
                  className="rounded-full"
                  height={24}
                  src={`https://avatar.vercel.sh/${walletAddress ?? "default"}`}
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
              <Link className="w-full cursor-pointer" href="/contribute">
                Contribute a tool
              </Link>
            </DropdownMenuItem>
            {isConnected && walletAddress && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center justify-between font-normal text-muted-foreground text-xs">
                  <span>Your wallet</span>
                  <span className="font-medium text-foreground">
                    ${formattedBalance} USDC
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="user-nav-item-copy"
                  onSelect={handleCopyAddress}
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
                        {formatWalletAddress(walletAddress)}
                      </>
                    )}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="user-nav-item-export"
                  onSelect={handleExportWallet}
                >
                  Export wallet
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === "loading") {
                    toast({
                      type: "error",
                      description:
                        "Checking authentication status, please try again!",
                    });

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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
