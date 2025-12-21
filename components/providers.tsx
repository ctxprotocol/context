// components/providers.tsx
"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
// CRITICAL: Import WagmiProvider from @privy-io/wagmi, NOT from wagmi!
import {
  WagmiProvider,
  type SetActiveWalletForWagmiType,
} from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";
import { AutoPayProvider } from "@/hooks/use-auto-pay";
import { ContextSidebarProvider } from "@/hooks/use-context-sidebar";
import { PaymentStatusProvider } from "@/hooks/use-payment-status";
import { isEmbeddedWallet, usePrivyWalletSync } from "@/hooks/use-privy-wallet-sync";
import { useReferralCapture } from "@/hooks/use-referral-capture";
import { useSessionSync } from "@/hooks/use-session-sync";
import { wagmiConfig } from "@/lib/wagmi";
import { privyConfig } from "../privy.config";

// Create QueryClient instance outside component to avoid recreation
const queryClient = new QueryClient();

const normalizeAddress = (value: string | undefined) => value?.toLowerCase();

const selectWalletForWagmi: SetActiveWalletForWagmiType = ({ wallets, user }) => {
  if (!wallets.length) {
    return undefined;
  }

  // Filter out wallets that are not linked to the user's account
  const linkedAddresses = new Set(
    user?.linkedAccounts
      ?.filter((account) => account.type === "wallet")
      .map((account) => account.address.toLowerCase()) || []
  );

  if (user?.wallet) {
    linkedAddresses.add(user.wallet.address.toLowerCase());
  }

  const availableWallets = wallets.filter((wallet) =>
    linkedAddresses.has(wallet.address.toLowerCase())
  );

  if (!availableWallets.length) {
    return undefined;
  }

  // Check for stored preference first
  if (typeof window !== "undefined") {
    const storedAddress = window.localStorage.getItem(
      "privy_wallet_preference"
    );
    if (storedAddress) {
      const matchedWallet = availableWallets.find(
        (w) => normalizeAddress(w.address) === normalizeAddress(storedAddress)
      );
      if (matchedWallet) {
        return matchedWallet;
      }
    }
  }

  const resolvedUserWallet = user?.wallet as ConnectedWallet | undefined;

  if (resolvedUserWallet) {
    const matchedWallet = availableWallets.find(
      (wallet) =>
        normalizeAddress(wallet.address) ===
          normalizeAddress(resolvedUserWallet.address) &&
        wallet.walletClientType === resolvedUserWallet.walletClientType
    );

    if (matchedWallet) {
      return matchedWallet;
    }

    if (!isEmbeddedWallet(resolvedUserWallet)) {
      // Only return if it's in availableWallets
      const availableUserWallet = availableWallets.find(
        (w) =>
          normalizeAddress(w.address) ===
          normalizeAddress(resolvedUserWallet.address)
      );
      if (availableUserWallet) {
        return availableUserWallet;
      }
    }
  }

  const embeddedWallet = availableWallets.find((wallet) =>
    isEmbeddedWallet(wallet)
  );

  return embeddedWallet ?? availableWallets[0];
};

// Internal component that uses useSearchParams (requires Suspense boundary)
function ReferralCaptureManager() {
  useReferralCapture(); // Captures ?ref=XXX from URL for Protocol Ledger
  return null;
}

// Client component that hosts the sync hooks
function SessionSyncManager({ children }: { children: React.ReactNode }) {
  useSessionSync();
  usePrivyWalletSync();
  return (
    <>
      {/* Wrap useSearchParams in Suspense for Next.js 15 static generation compatibility */}
      <Suspense fallback={null}>
        <ReferralCaptureManager />
      </Suspense>
      {children}
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={privyConfig}
    >
      <SmartWalletsProvider
        config={{
          // Enable gas sponsorship - Context pays for gas, users only need USDC for tools
          // The paymaster URL must be configured in the Privy Dashboard
          paymasterContext: {
            mode: "SPONSORED",
            calculateGasLimits: true,
            expiryDuration: 300, // 5 minutes
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider
            config={wagmiConfig}
            setActiveWalletForWagmi={selectWalletForWagmi}
          >
            <SessionProvider>
              <AutoPayProvider>
                <ContextSidebarProvider>
                  <PaymentStatusProvider>
                    <SessionSyncManager>{children}</SessionSyncManager>
                  </PaymentStatusProvider>
                </ContextSidebarProvider>
              </AutoPayProvider>
            </SessionProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
