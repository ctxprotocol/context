import dotenv from "dotenv";
import { ethers as hardhatEthers, run } from "hardhat";

dotenv.config({ path: "../.env.local" });

type SignerWithAddress = {
  getAddress: () => Promise<string>;
};

type HardhatProvider = {
  getNetwork: () => Promise<{ chainId: bigint; name: string }>;
  getBalance: (address: string) => Promise<bigint>;
  getCode: (address: string) => Promise<string>;
};

type HardhatEthersExtended = typeof hardhatEthers & {
  getSigners: () => Promise<SignerWithAddress[]>;
  provider: HardhatProvider;
};

const ethers = hardhatEthers as HardhatEthersExtended;

const CHAIN_ID_HARDHAT = 1337;
const CHAIN_ID_ANVIL = 31_337;
const CHAIN_ID_BASE_SEPOLIA = 84_532;
const CHAIN_ID_BASE_MAINNET = 8453;

const LOCAL_CHAIN_IDS = new Set<number>([CHAIN_ID_HARDHAT, CHAIN_ID_ANVIL]);
const VERIFIED_CHAIN_IDS = new Set<number>([
  CHAIN_ID_BASE_SEPOLIA,
  CHAIN_ID_BASE_MAINNET,
]);

const DEFAULT_USDC_ADDRESSES: Record<number, string> = {
  [CHAIN_ID_BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [CHAIN_ID_BASE_MAINNET]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const DEFAULT_VERIFICATION_CONFIRMATIONS = 5;
const DEFAULT_VERIFICATION_DELAY_MS = 30_000;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type ContractLike = {
  getAddress?: () => Promise<string>;
  target?: string;
};

const resolveContractAddress = async (
  contract: unknown,
  label: string
): Promise<string> => {
  const candidate = contract as ContractLike;

  if (typeof candidate.getAddress === "function") {
    return await candidate.getAddress();
  }

  if (typeof candidate.target === "string") {
    return candidate.target;
  }

  throw new Error(`❌ Unable to resolve ${label} address.`);
};

const normalizeAddress = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!ethers.isAddress(trimmed) || trimmed === ethers.ZeroAddress) {
    throw new Error(`❌ Invalid USDC address provided: ${value}`);
  }

  return trimmed;
};

const getNumericEnv = (name: string, fallback: number): number => {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`❌ Invalid numeric value for ${name}: ${rawValue}`);
  }

  return parsed;
};

const resolveConfiguredAddress = (chainId: number): string | null => {
  if (process.env.USDC_ADDRESS_OVERRIDE) {
    return normalizeAddress(process.env.USDC_ADDRESS_OVERRIDE);
  }

  switch (chainId) {
    case CHAIN_ID_BASE_SEPOLIA:
      return (
        normalizeAddress(process.env.BASE_SEPOLIA_USDC_ADDRESS) ??
        DEFAULT_USDC_ADDRESSES[chainId]
      );
    case CHAIN_ID_BASE_MAINNET:
      return (
        normalizeAddress(process.env.BASE_MAINNET_USDC_ADDRESS) ??
        DEFAULT_USDC_ADDRESSES[chainId]
      );
    default:
      return normalizeAddress(process.env.LOCAL_USDC_ADDRESS);
  }
};

const deployMockUsdc = async (
  deployer: SignerWithAddress
): Promise<{ address: string; isMock: true }> => {
  console.log("🪄 No USDC configured. Deploying local MockERC20 (USDC)…");
  const mockFactory = await ethers.getContractFactory("MockERC20");
  const mockUsdc = await mockFactory.deploy("Mock USDC", "mUSDC");

  console.log("⏳ Waiting for Mock USDC deployment...");
  await mockUsdc.waitForDeployment();

  const mockAddress = await resolveContractAddress(mockUsdc, "Mock USDC");
  console.log(`✅ Mock USDC deployed at: ${mockAddress}`);

  const recipient = await deployer.getAddress();
  const initialMintAmount = ethers.parseUnits("1000000", 6);
  const mintTx = await mockUsdc.mint(recipient, initialMintAmount);
  await mintTx.wait();
  console.log(
    `💵 Minted ${ethers.formatUnits(initialMintAmount, 6)} mock USDC to ${recipient}`
  );

  return { address: mockAddress, isMock: true };
};

const resolveUsdcAddress = async (
  chainId: number,
  deployer: SignerWithAddress
): Promise<{ address: string; isMock: boolean }> => {
  const configuredAddress = resolveConfiguredAddress(chainId);
  if (configuredAddress) {
    console.log(`💵 Using configured USDC at: ${configuredAddress}\n`);
    return { address: configuredAddress, isMock: false };
  }

  if (chainId in DEFAULT_USDC_ADDRESSES) {
    const fallback = DEFAULT_USDC_ADDRESSES[chainId];
    console.log(`💵 Using default USDC for chain ${chainId}: ${fallback}\n`);
    return { address: fallback, isMock: false };
  }

  if (LOCAL_CHAIN_IDS.has(chainId)) {
    return await deployMockUsdc(deployer);
  }

  throw new Error(
    `❌ USDC address not configured for chain ${chainId}. ` +
      "Set USDC_ADDRESS_OVERRIDE or the appropriate network-specific environment variable."
  );
};

async function main() {
  console.log("🚀 Starting ContextRouter deployment...\n");

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`📡 Network: ${network.name} (chainId: ${chainId})`);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  const { address: usdcAddress, isMock: usingMockUsdc } =
    await resolveUsdcAddress(chainId, deployer);

  const ContextRouter = await ethers.getContractFactory("ContextRouter");
  console.log("📝 Deploying ContextRouter contract...");
  const contextRouter = await ContextRouter.deploy(usdcAddress);

  console.log("⏳ Waiting for deployment transaction...");
  await contextRouter.waitForDeployment();

  const contractAddress = await resolveContractAddress(
    contextRouter,
    "ContextRouter"
  );
  console.log(`✅ ContextRouter deployed to: ${contractAddress}\n`);

  console.log("🔍 Verifying contract bytecode on-chain...");
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("❌ Contract deployment failed - no code at address");
  }
  console.log("✅ Contract code present on-chain\n");

  const owner = await contextRouter.owner();
  const feePercent = await contextRouter.PLATFORM_FEE_PERCENT();
  const usdc = await contextRouter.usdc();

  console.log("📋 Contract Details:");
  console.log(`   Owner: ${owner}`);
  console.log(`   Platform Fee: ${feePercent}%`);
  console.log(`   USDC Token: ${usdc}`);
  console.log(`   Mock USDC: ${usingMockUsdc ? "yes" : "no"}\n`);

  console.log("📦 Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=${contractAddress}\n`);

  const shouldVerify =
    VERIFIED_CHAIN_IDS.has(chainId) &&
    process.env.SKIP_CONTRACT_VERIFY?.toLowerCase() !== "true" &&
    !usingMockUsdc;

  if (shouldVerify) {
    const confirmations = getNumericEnv(
      "VERIFICATION_CONFIRMATIONS",
      DEFAULT_VERIFICATION_CONFIRMATIONS
    );
    const verificationDelayMs = getNumericEnv(
      "VERIFICATION_DELAY_MS",
      DEFAULT_VERIFICATION_DELAY_MS
    );

    console.log(
      `⏳ Waiting for ${confirmations} confirmations before verification...`
    );
    const deployTx = contextRouter.deploymentTransaction();
    if (deployTx) {
      await deployTx.wait(confirmations);
      console.log(`✅ ${confirmations} confirmations received`);
    } else {
      console.warn("⚠️ Could not access deployment transaction. Skipping wait.");
    }

    if (verificationDelayMs > 0) {
      console.log(
        `⏱️ Waiting an additional ${verificationDelayMs / 1000} seconds for explorer indexing...`
      );
      await delay(verificationDelayMs);
    }

    console.log("🛰️ Verifying contract on Basescan...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [usdcAddress],
        contract: "contracts/ContextRouter.sol:ContextRouter",
      });
      console.log("✅ Verification successful!");
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes("already verified")) {
          console.log("ℹ️ Contract already verified on explorer.");
        } else if (
          error.message.toLowerCase().includes("does not have bytecode")
        ) {
          console.warn(
            "⚠️ Explorer could not find bytecode. It may still be indexing. Try again later."
          );
        } else {
          console.error("❌ Verification failed:");
          console.error(error);
        }
      } else {
        console.error("❌ Verification failed with unknown error:");
        console.error(error);
      }
    }
  } else {
    console.log(
      "ℹ️ Skipping on-chain verification (unsupported network, mock USDC, or SKIP_CONTRACT_VERIFY set)."
    );
  }

  console.log("═══════════════════════════════════════════");
  console.log("🎉 Deployment Complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`Contract: ${contractAddress}`);
  console.log(`Network: ${network.name} (${chainId})`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`Mock USDC: ${usingMockUsdc ? "yes" : "no"}`);
  console.log("═══════════════════════════════════════════\n");
}

main().catch((error: unknown) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});
