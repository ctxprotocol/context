// lib/privy.ts
import { PrivyClient } from "@privy-io/server-auth";
import "server-only";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

if (!privyAppId || !privyAppSecret) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET"
  );
}

const privy = new PrivyClient(privyAppId, privyAppSecret);

export async function verifyPrivyToken(token: string) {
  try {
    const claims = await privy.verifyAuthToken(token);
    return claims;
  } catch (error) {
    console.error("Token verification failed:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
    return null;
  }
}

export async function getPrivyUser(userId: string) {
  try {
    const user = await privy.getUser(userId);
    return user;
  } catch (error) {
    console.error("Failed to fetch Privy user:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
    return null;
  }
}

/**
 * Get linked external wallets for a user.
 *
 * Returns wallet addresses that are linked for portfolio context (read-only).
 * Excludes the embedded Privy wallet since that's for payments, not portfolio.
 *
 * Used by the wallet linking prompt flow to determine if user needs to link
 * a wallet before tools requiring portfolio context can execute.
 *
 * @param userId - Privy user ID (e.g., "did:privy:...")
 * @returns Array of wallet addresses (empty if none linked or on error)
 */
export async function getLinkedWalletsForUser(
  userId: string
): Promise<string[]> {
  try {
    console.log("[privy] Looking up user:", userId);
    const user = await privy.getUser(userId);

    // Debug: Log ALL linked accounts to understand what Privy returns
    const allWalletAccounts = user.linkedAccounts.filter(
      (account) => account.type === "wallet"
    );

    console.log("[privy] All wallet accounts:", {
      totalAccounts: user.linkedAccounts.length,
      walletAccounts: allWalletAccounts.length,
      wallets: allWalletAccounts.map((w) => ({
        type: w.type,
        walletClientType: (w as any).walletClientType,
        address: (w as any).address,
        isEmbedded: (w as any).walletClientType === "privy",
      })),
    });

    // Filter to external wallets only (exclude embedded Privy wallet)
    // The embedded wallet has walletClientType === "privy"
    // External wallets have walletClientType like "metamask", "phantom", "coinbase_wallet", etc.
    const linkedWallets = user.linkedAccounts
      .filter(
        (account) =>
          account.type === "wallet" &&
          (account as any).walletClientType !== "privy"
      )
      .map((account) => {
        // Type assertion: wallet accounts have an address property
        return (account as { address: string }).address;
      });

    console.log("[privy] Filtered external wallets:", {
      count: linkedWallets.length,
      addresses: linkedWallets,
    });

    return linkedWallets;
  } catch (error) {
    console.error("[privy] Failed to get linked wallets:", error);
    return [];
  }
}
