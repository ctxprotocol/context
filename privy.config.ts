// privy.config.ts
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base, mainnet } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  // Embedded wallet configuration
  // IMPORTANT: All users get embedded wallets for Auto Pay to work
  // External wallets (MetaMask) cannot auto-sign transactions by design
  // Only embedded wallets enable seamless Auto Pay + gas sponsorship
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users", // Every user gets an embedded wallet
    },
  },
  // Supported chains - must match wagmi config
  // We transact only on Base, but Privy may use mainnet for
  // wallet auth/SiWE. Keep wagmi on Base-only.
  supportedChains: [base, mainnet],
  // Login methods - NO external wallets (they can't auto-sign)
  // Users authenticate with email/social, get embedded wallet automatically
  loginMethods: ["email", "google", "github"],
  // Appearance
  appearance: {
    showWalletLoginFirst: false,
    // No external wallets - embedded only for Auto Pay support
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
