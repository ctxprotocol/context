// privy.config.ts
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base, mainnet, polygon } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  // Embedded wallet configuration
  // IMPORTANT: All users get embedded wallets for Auto Pay to work
  // External wallets (MetaMask) cannot auto-sign transactions by design
  // Only embedded wallets enable seamless Auto Pay + gas sponsorship
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users", // Every user gets an embedded wallet
    },
    // NOTE: We use per-transaction uiOptions to control popups:
    // - Auto Pay OFF: Show confirmation popup (default behavior)
    // - Auto Pay ON: Pass { showWalletUIs: false } to auto-sign
  },
  // Supported chains for Privy wallet recognition
  // - Base: Where we transact (tool payments)
  // - Mainnet: For wallet auth/SiWE
  // - Polygon: For reading Polymarket positions (no transactions, just portfolio context)
  // NOTE: wagmi.config.ts stays Base-only for actual transactions
  supportedChains: [base, mainnet, polygon],
  // Login methods - NO external wallets for login (they can't auto-sign)
  // Users authenticate with email/social, get embedded wallet automatically
  // But we DO allow LINKING external wallets for portfolio context (read-only)
  loginMethods: ["email", "google", "github"],
  // Appearance
  appearance: {
    showWalletLoginFirst: false,
  },
};

// export const privyConfig: PrivyClientConfig = {
//   embeddedWallets: {
//     createOnLogin: 'users-without-wallets',
//     // Consider setting this to false for initial testing
//     requireUserPasswordOnCreate: false,
//     showWalletUIs: true,
//   },
//   loginMethods: ['email'],
//   appearance: {
//     showWalletLoginFirst: false, // Email first
//   },
// };

// import type { PrivyClientConfig } from '@privy-io/react-auth';

// // Replace this with your Privy config
// export const privyConfig: PrivyClientConfig = {
//   embeddedWallets: {
//     createOnLogin: 'users-without-wallets',
//     requireUserPasswordOnCreate: true,
//     showWalletUIs: true,
//   },
//   loginMethods: ['email'],
//   appearance: {
//     showWalletLoginFirst: true,
//   },
// };
