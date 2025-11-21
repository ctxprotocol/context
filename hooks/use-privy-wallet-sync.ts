"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  type ConnectedWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";

type WalletLike = ConnectedWallet & {
  walletClientType?: string;
  type?: string;
  embedded?: boolean;
};

function normalizeAddress(value: string | undefined) {
  return value?.toLowerCase();
}

export function isEmbeddedWallet(wallet: ConnectedWallet | undefined) {
  if (!wallet) {
    return false;
  }

  const { walletClientType, type, embedded } = wallet as WalletLike;

  if (
    walletClientType === "embedded" ||
    walletClientType === "privy" ||
    walletClientType === "smart_wallet" ||
    walletClientType === "coinbase_smart_wallet"
  ) {
    return true;
  }

  if (type === "embedded" || type === "smart_wallet") {
    return true;
  }

  if (embedded) {
    return true;
  }

  return false;
}

function toWalletKey(wallet: ConnectedWallet | undefined) {
  if (!wallet) {
    return undefined;
  }
  const walletLike = wallet as WalletLike;
  return `${normalizeAddress(wallet.address) ?? ""}:${walletLike.walletClientType ?? ""}`;
}

export function usePrivyWalletSync() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets = [] } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const lastWalletKeyRef = useRef<string>();

  const preferredWallet = useMemo(() => {
    if (!ready || !authenticated) {
      return undefined;
    }

    const connectedWallets = wallets.length
      ? wallets
      : user?.wallet
        ? [user.wallet]
        : [];

    // Filter out wallets that are not linked to the user's account
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

    if (!linkedConnectedWallets.length) {
      return undefined;
    }

    const smartWallet = linkedConnectedWallets.find((wallet) => {
      const walletLike = wallet as WalletLike;
      return (
        walletLike.type === "smart_wallet" ||
        walletLike.walletClientType === "smart_wallet" ||
        walletLike.walletClientType === "coinbase_smart_wallet"
      );
    });

    if (smartWallet) {
      return smartWallet;
    }

    // Check for stored preference
    if (typeof window !== "undefined") {
      const storedAddress = window.localStorage.getItem("privy_wallet_preference");
      if (storedAddress) {
        const matchedWallet = linkedConnectedWallets.find(
          (w) => normalizeAddress(w.address) === normalizeAddress(storedAddress)
        );
        if (matchedWallet) {
          return matchedWallet;
        }
      }
    }

    // Prioritize external wallets (non-embedded, non-smart)
    const externalWallet = linkedConnectedWallets.find(
      (wallet) => !isEmbeddedWallet(wallet)
    );
    if (externalWallet) {
      return externalWallet;
    }

    if (user?.wallet) {
      const matchedWallet = linkedConnectedWallets.find(
        (wallet) =>
          normalizeAddress(wallet.address) ===
            normalizeAddress(user.wallet?.address) &&
          wallet.walletClientType === user.wallet?.walletClientType
      );

      if (matchedWallet) {
        return matchedWallet;
      }

      if (!isEmbeddedWallet(user.wallet)) {
        return user.wallet;
      }
    }

    const embeddedWallet = linkedConnectedWallets.find(isEmbeddedWallet);
    return embeddedWallet ?? linkedConnectedWallets[0];
  }, [ready, authenticated, user, wallets]);

  useEffect(() => {
    if (!preferredWallet) {
      lastWalletKeyRef.current = undefined;
      return;
    }

    const walletKey = toWalletKey(preferredWallet);

    if (walletKey && walletKey === lastWalletKeyRef.current) {
      return;
    }

    lastWalletKeyRef.current = walletKey;

    void setActiveWallet(preferredWallet).catch(() => {
      lastWalletKeyRef.current = undefined;
    });
  }, [preferredWallet, setActiveWallet]);
}

