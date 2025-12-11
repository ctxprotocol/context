import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";

// Load environment variables from parent .env.local (shared with main app)
dotenv.config({ path: "../.env.local" });

// Environment variable checks
const INFURA_API_KEY = process.env.INFURA_API_KEY;
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY; // V2 API works for all chains

// Base network configuration
const BASE_SEPOLIA_RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL ||
  (INFURA_API_KEY
    ? `https://base-sepolia.infura.io/v3/${INFURA_API_KEY}`
    : "https://sepolia.base.org");
const BASE_MAINNET_RPC_URL =
  process.env.BASE_MAINNET_RPC_URL ||
  (INFURA_API_KEY
    ? `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`
    : "https://mainnet.base.org");

// USDC contract addresses
const BASE_SEPOLIA_USDC_ADDRESS =
  process.env.BASE_SEPOLIA_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_MAINNET_USDC_ADDRESS =
  process.env.BASE_MAINNET_USDC_ADDRESS ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

if (
  !INFURA_API_KEY &&
  (process.env.HARDHAT_NETWORK === "baseSepolia" ||
    process.env.HARDHAT_NETWORK === "baseMainnet")
) {
  console.warn("WARN: INFURA_API_KEY not set. Using default Base RPC URLs.");
}

if (
  !DEPLOYER_KEY &&
  (process.env.HARDHAT_NETWORK === "baseSepolia" ||
    process.env.HARDHAT_NETWORK === "baseMainnet")
) {
  console.warn(
    "WARN: DEPLOYER_KEY not set. Deployment to Base networks will fail."
  );
}

if (!ETHERSCAN_API_KEY) {
  console.warn("WARN: ETHERSCAN_API_KEY not set. Verification will fail.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: DEPLOYER_MNEMONIC ? { mnemonic: DEPLOYER_MNEMONIC } : undefined,
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      chainId: 84_532,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
      gasPrice: 1_000_000_000, // 1 gwei
    },
    baseMainnet: {
      url: BASE_MAINNET_RPC_URL,
      chainId: 8453,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
  etherscan: {
    // Etherscan V2 API - single key works for all chains
    apiKey: ETHERSCAN_API_KEY || "",
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84_532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

export default config;

// Export USDC addresses for use in deployment scripts
export const USDC_ADDRESSES = {
  baseSepolia: BASE_SEPOLIA_USDC_ADDRESS,
  baseMainnet: BASE_MAINNET_USDC_ADDRESS,
};
