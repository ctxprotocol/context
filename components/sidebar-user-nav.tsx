"use client";

import { useLinkAccount, useLogin, usePrivy } from "@privy-io/react-auth";
import { ChevronUp } from "lucide-react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
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
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const { isEmbeddedWallet, embeddedWallet, activeWallet } =
    useWalletIdentity();

  const walletAddress = activeWallet?.address;

  // Display email if available, otherwise show formatted wallet address
  const displayName = isConnected
    ? userEmail ||
      (walletAddress ? formatWalletAddress(walletAddress) : "User")
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

  const { linkWallet } = useLinkAccount();

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

  const handleLinkExternalWallet = async () => {
    try {
      setIsLinkingWallet(true);
      await linkWallet();
      toast({
        type: "success",
        description: "External wallet connected. Future payments will use it.",
      });
    } catch (error) {
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "";

      if (message === "exited_auth_flow") {
        return;
      }

      // This happens if the MetaMask address is already the primary
      // account for a *different* Privy user.
      if (message.includes("User already exists for this address")) {
        toast({
          type: "error",
          description:
            "This wallet is already linked to another account. Sign out and log in with that wallet instead, or choose a different wallet.",
        });
      } else {
        console.error("Link wallet error:", error);
        toast({
          type: "error",
          description: "Failed to connect wallet. Please try again.",
        });
      }
    } finally {
      setIsLinkingWallet(false);
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
              <a
                href="/contribute"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full cursor-pointer"
              >
                Contribute a Tool
              </a>
            </DropdownMenuItem>
            {isConnected && walletAddress && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                  Current wallet: {isEmbeddedWallet ? "Embedded" : "External"}
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
                {isEmbeddedWallet && (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    data-testid="user-nav-item-link-wallet"
                    disabled={isLinkingWallet}
                    onSelect={() => {
                      handleLinkExternalWallet();
                    }}
                  >
                    {isLinkingWallet
                      ? "Connecting wallet…"
                      : "Use your own wallet"}
                  </DropdownMenuItem>
                )}
              </>
            )}
            {!isEmbeddedWallet && embeddedWallet ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
                  Embedded wallet {formatWalletAddress(embeddedWallet.address)}{" "}
                  still holds any existing funds or earnings. Export it while
                  active to move assets.
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            ) : (
              <DropdownMenuSeparator />
            )}
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
