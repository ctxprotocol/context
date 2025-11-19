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
import { PaymentStatusProvider } from "@/hooks/use-payment-status";
import { isEmbeddedWallet, usePrivyWalletSync } from "@/hooks/use-privy-wallet-sync";
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

  const resolvedUserWallet = user?.wallet as ConnectedWallet | undefined;

  if (resolvedUserWallet) {
    const matchedWallet = wallets.find(
      (wallet) =>
        normalizeAddress(wallet.address) ===
          normalizeAddress(resolvedUserWallet.address) &&
        wallet.walletClientType === resolvedUserWallet.walletClientType
    );

    if (matchedWallet) {
      return matchedWallet;
    }

    if (!isEmbeddedWallet(resolvedUserWallet)) {
      return resolvedUserWallet;
    }
  }

  const embeddedWallet = wallets.find((wallet) => isEmbeddedWallet(wallet));

  return embeddedWallet ?? wallets[0];
};

// Client component that hosts the sync hook
function SessionSyncManager({ children }: { children: React.ReactNode }) {
  useSessionSync();
  usePrivyWalletSync();
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={privyConfig}
    >
      <SmartWalletsProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider
            config={wagmiConfig}
            setActiveWalletForWagmi={selectWalletForWagmi}
          >
            <SessionProvider>
              <PaymentStatusProvider>
                <SessionSyncManager>{children}</SessionSyncManager>
              </PaymentStatusProvider>
            </SessionProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
