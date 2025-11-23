"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";

type UsePrivyReturn = ReturnType<typeof usePrivy>;
type PrivyUser = UsePrivyReturn["user"];
type PrivyWallet = NonNullable<PrivyUser>["wallet"];
type WalletUnion = PrivyWallet | ConnectedWallet;

type PrivyHookWithWallets = UsePrivyReturn & {
  wallets?: PrivyWallet[];
};

function inferWalletClientType(wallet: WalletUnion | undefined) {
  if (!wallet) {
    return;
  }

  const { walletClientType, type } = wallet as {
    walletClientType?: string;
    type?: string;
    embedded?: boolean;
  };

  if (walletClientType) {
    return walletClientType;
  }

  if (type) {
    return type;
  }

  if ("embedded" in wallet && wallet.embedded) {
    return "embedded";
  }
}

export function useWalletIdentity() {
  const privy = usePrivy() as PrivyHookWithWallets;
  const { user } = privy;
  const { wallets: connectedWallets = [] } = useWallets();
  const [preferenceKey, setPreferenceKey] = useState(0);

  useEffect(() => {
    const handlePreferenceChange = () => setPreferenceKey((prev) => prev + 1);

    // Same-tab preference updates (e.g., when the user switches wallets
    // from within this window).
    window.addEventListener(
      "privy-wallet-preference-changed",
      handlePreferenceChange
    );

    // Cross-tab preference updates: when another tab changes the preferred
    // wallet in localStorage, the "storage" event fires in this tab.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "privy_wallet_preference") {
        handlePreferenceChange();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "privy-wallet-preference-changed",
        handlePreferenceChange
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const wallets: WalletUnion[] = useMemo(() => {
    if (!user) {
      return connectedWallets;
    }

    const linkedAddresses = new Set(
      user.linkedAccounts
        ?.filter((account) => account.type === "wallet")
        .map((account) => account.address.toLowerCase()) || []
    );

    if (user.wallet) {
      linkedAddresses.add(user.wallet.address.toLowerCase());
    }

    const linkedConnectedWallets = connectedWallets.filter((wallet) =>
      linkedAddresses.has(wallet.address.toLowerCase())
    );

    return linkedConnectedWallets.length > 0
      ? linkedConnectedWallets
      : user.wallet
        ? [user.wallet]
        : [];
  }, [user, connectedWallets]);

  const activeWallet = useMemo(() => {
    // Touch preferenceKey to ensure re-calculation when it changes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = preferenceKey;

    if (wallets.length === 0) {
      return user?.wallet;
    }

    const smartWallet = wallets.find((wallet) => {
      const clientType = inferWalletClientType(wallet);
      return (
        clientType === "smart_wallet" || clientType === "coinbase_smart_wallet"
      );
    });

    if (smartWallet) {
      return smartWallet;
    }

    // Check for stored preference
    if (typeof window !== "undefined") {
      const storedAddress = window.localStorage.getItem(
        "privy_wallet_preference"
      );
      if (storedAddress) {
        const matchedWallet = wallets.find(
          (w) => w?.address?.toLowerCase() === storedAddress.toLowerCase()
        );
        if (matchedWallet) {
          return matchedWallet;
        }
      }
    }

    const externalWallet = wallets.find((wallet) => {
      const clientType = inferWalletClientType(wallet);
      return clientType !== "embedded" && clientType !== "privy";
    });

    if (externalWallet) {
      return externalWallet;
    }

    return user?.wallet ?? wallets[0];
  }, [user, wallets, preferenceKey]);

  const embeddedWallet = useMemo(
    () =>
      wallets.find((wallet) => inferWalletClientType(wallet) === "embedded"),
    [wallets]
  );

  const walletClientType = inferWalletClientType(activeWallet);
  const isEmbeddedWallet =
    walletClientType === "embedded" ||
    walletClientType === "privy" ||
    walletClientType === "smart_wallet" ||
    walletClientType === "coinbase_smart_wallet";

  return {
    privy,
    activeWallet,
    wallets,
    walletClientType,
    isEmbeddedWallet,
    embeddedWallet,
  };
}
