// privy.config.ts
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { base, mainnet } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  // Embedded wallet configuration
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  // Supported chains - must match wagmi config
  // We transact only on Base, but Privy may use mainnet for
  // wallet auth/SiWE. Keep wagmi on Base-only.
  supportedChains: [base, mainnet],
  // Login methods
  loginMethods: ["email", "wallet", "google", "github"],
  // Appearance
  appearance: {
    showWalletLoginFirst: false,
    walletList: [], // Keeps external wallets like MetaMask disabled for now
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
