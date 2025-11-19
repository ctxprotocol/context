"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";

type UsePrivyReturn = ReturnType<typeof usePrivy>;
type PrivyUser = UsePrivyReturn["user"];
type PrivyWallet = NonNullable<PrivyUser>["wallet"];
type PrivyHookWithWallets = UsePrivyReturn & {
  wallets?: PrivyWallet[];
};

function inferWalletClientType(wallet: PrivyWallet | undefined) {
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

  const wallets =
    privy.wallets ?? (user?.wallet ? [user.wallet] : ([] as PrivyWallet[]));

  const activeWallet = useMemo(() => {
    if (wallets.length === 0) {
      return user?.wallet;
    }

    const smartWallet = wallets.find((wallet) => {
      const clientType = inferWalletClientType(wallet);
      return clientType === "smart_wallet" || clientType === "coinbase_smart_wallet";
    });

    if (smartWallet) {
      return smartWallet;
    }

    return user?.wallet ?? wallets[0];
  }, [user, wallets]);

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
