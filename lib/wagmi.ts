// IMPORTANT: Import createConfig from @privy-io/wagmi, NOT from wagmi!
import { createConfig } from "@privy-io/wagmi";
import { base } from "viem/chains";
import { http } from "wagmi";

/**
 * Wagmi configuration for Context
 * Uses Privy's wrapper to ensure proper integration with embedded wallets.
 * We only support Base mainnet for on-chain transactions.
 */
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});
