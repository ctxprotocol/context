import { defineConfig } from "@wagmi/cli";
import { actions, hardhat, react } from "@wagmi/cli/plugins";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./.env.local" });

export default defineConfig({
  out: "lib/generated.ts", // Output auto-generated hooks here
  plugins: [
    react(), // Generates React hooks (useRead*, useWrite*, useSimulate*)
    actions(), // Generates vanilla actions (readContract, writeContract)
    hardhat({
      project: "./hardhat", // Path to Hardhat project
      deployments: {
        ContextRouter: {
          // Base Mainnet (chainId: 8453)
          8453: (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS ||
            "0x0000000000000000000000000000000000000000") as `0x${string}`,
          // Base Sepolia (chainId: 84532)
          84532: (process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA ||
            process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS ||
            "0x0000000000000000000000000000000000000000") as `0x${string}`,
        },
      },
    }),
  ],
});
