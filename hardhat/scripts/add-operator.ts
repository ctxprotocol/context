import dotenv from "dotenv";
import { ethers as hardhatEthers } from "hardhat";

dotenv.config({ path: "../.env.local" });

type SignerWithAddress = {
  getAddress: () => Promise<string>;
};

type HardhatEthersExtended = typeof hardhatEthers & {
  getSigners: () => Promise<SignerWithAddress[]>;
};

const ethers = hardhatEthers as HardhatEthersExtended;

/**
 * Register the deployer wallet as an operator on the ContextRouter contract.
 * The deployer is also the contract owner, so it has permission to add operators.
 * The deployer wallet is used for Auto Pay to execute payments on behalf of users.
 */
async function main() {
  console.log("🔧 Adding operator to ContextRouter...\n");

  const routerAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS;
  if (!routerAddress) {
    throw new Error(
      "NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS not set in .env.local"
    );
  }

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`📡 Router: ${routerAddress}`);
  console.log(`👤 Deployer/Operator: ${deployerAddress}\n`);

  // Get the contract instance
  const ContextRouter = await ethers.getContractFactory("ContextRouter");
  const router = ContextRouter.attach(routerAddress);

  // Check if already an operator
  const isAlreadyOperator = await router.isOperator(deployerAddress);
  if (isAlreadyOperator) {
    console.log("✅ Deployer is already registered as an operator.");
    return;
  }

  // Add the deployer as an operator
  console.log("📝 Registering deployer as operator...");
  const tx = await router.addOperator(deployerAddress);
  console.log(`⏳ Transaction submitted: ${tx.hash}`);

  await tx.wait();
  console.log("✅ Operator added successfully!\n");

  // Verify
  const isOperatorNow = await router.isOperator(deployerAddress);
  console.log(`🔍 Verification: isOperator(${deployerAddress}) = ${isOperatorNow}`);
}

main().catch((error: unknown) => {
  console.error("\n❌ Failed to add operator:");
  console.error(error);
  process.exitCode = 1;
});

