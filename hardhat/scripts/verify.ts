import { run } from "hardhat";

async function main() {
  // Get contract address from command line or environment
  const contractAddress = process.env.CONTRACT_ADDRESS || process.argv[2];

  if (!contractAddress) {
    console.error("❌ Please provide contract address:");
    console.error(
      "   npx hardhat run scripts/verify.ts --network baseSepolia CONTRACT_ADDRESS"
    );
    console.error("   or set CONTRACT_ADDRESS environment variable");
    process.exit(1);
  }

  console.log("🔍 Verifying contract on Basescan...\n");
  console.log(`📝 Contract: ${contractAddress}\n`);

  // USDC addresses for constructor arguments
  const USDC_ADDRESSES: Record<string, string> = {
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };

  // Determine network (default to baseSepolia)
  const network = process.env.HARDHAT_NETWORK || "baseSepolia";
  const usdcAddress = USDC_ADDRESSES[network];

  if (!usdcAddress) {
    console.error(`❌ Unsupported network: ${network}`);
    console.error("   Supported: baseSepolia, base");
    process.exit(1);
  }

  console.log(`💵 USDC Address: ${usdcAddress}`);
  console.log(`🌐 Network: ${network}\n`);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [usdcAddress],
    });

    console.log("\n✅ Contract verified successfully on Basescan!");
    console.log(
      `🔗 View at: https://${network === "base" ? "" : "sepolia."}basescan.org/address/${contractAddress}\n`
    );
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract already verified on Basescan!");
      console.log(
        `🔗 View at: https://${network === "base" ? "" : "sepolia."}basescan.org/address/${contractAddress}\n`
      );
    } else {
      console.error("\n❌ Verification failed:");
      console.error(error);
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
