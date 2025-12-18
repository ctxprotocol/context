/**
 * On-Chain Payment Audit Script
 *
 * Cross-checks database records with actual on-chain payments.
 * Verifies that model costs from convenience tier were actually
 * paid to the ContextRouter contract.
 *
 * Usage: npx tsx scripts/audit-on-chain-payments.ts
 */
import { config } from "dotenv";
import postgres from "postgres";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

config({
  path: ".env.local",
});

// USDC on Base has 6 decimals
const USDC_DECIMALS = 6;

// Contract addresses
const CONTEXT_ROUTER_ADDRESS = process.env
  .NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS as `0x${string}`;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const; // USDC on Base

// ABI for reading contract state
const CONTEXT_ROUTER_ABI = [
  {
    inputs: [],
    name: "platformBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPlatformBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 ABI for balance
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Event signatures
const MODEL_COST_PAID_EVENT = parseAbiItem(
  "event ModelCostPaid(address indexed user, uint256 amount)"
);
const QUERY_PAID_EVENT = parseAbiItem(
  "event QueryPaid(uint256 indexed toolId, address indexed user, address indexed developer, uint256 amount, uint256 platformFee)"
);
const PLATFORM_FEES_CLAIMED_EVENT = parseAbiItem(
  "event PlatformFeesClaimed(address indexed platform, uint256 amount)"
);

const auditOnChainPayments = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }
  if (!CONTEXT_ROUTER_ADDRESS) {
    throw new Error("NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS is not defined");
  }

  const sql = postgres(process.env.POSTGRES_URL);

  // Create viem client
  const client = createPublicClient({
    chain: base,
    transport: http(),
  });

  console.log("\n🔗 ON-CHAIN PAYMENT AUDIT");
  console.log("=".repeat(60));
  console.log(`Contract: ${CONTEXT_ROUTER_ADDRESS}`);
  console.log("Chain: Base Mainnet");

  try {
    // =========================================================================
    // 1. CONTRACT STATE
    // =========================================================================
    console.log("\n💰 CONTRACT STATE");
    console.log("-".repeat(60));

    // Get platform balance from contract
    const platformBalance = await client.readContract({
      address: CONTEXT_ROUTER_ADDRESS,
      abi: CONTEXT_ROUTER_ABI,
      functionName: "platformBalance",
    });

    // Get contract's USDC balance
    const contractUsdcBalance = await client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [CONTEXT_ROUTER_ADDRESS],
    });

    console.log(
      `Platform Balance (claimable):  $${formatUnits(platformBalance, USDC_DECIMALS)}`
    );
    console.log(
      `Contract USDC Balance (total): $${formatUnits(contractUsdcBalance, USDC_DECIMALS)}`
    );
    console.log(
      `Developer Balances (locked):   $${formatUnits(contractUsdcBalance - platformBalance, USDC_DECIMALS)}`
    );

    // =========================================================================
    // 2. MODEL COST EVENTS (Convenience Tier)
    // =========================================================================
    console.log("\n📊 MODEL COST EVENTS (from contract)");
    console.log("-".repeat(60));

    // Get all ModelCostPaid events
    const modelCostLogs = await client.getLogs({
      address: CONTEXT_ROUTER_ADDRESS,
      event: MODEL_COST_PAID_EVENT,
      fromBlock: "earliest",
      toBlock: "latest",
    });

    let totalModelCostOnChain = 0n;
    const modelCostsByUser = new Map<string, bigint>();

    for (const log of modelCostLogs) {
      const user = log.args.user as string;
      const amount = log.args.amount as bigint;
      totalModelCostOnChain += amount;
      modelCostsByUser.set(user, (modelCostsByUser.get(user) ?? 0n) + amount);
    }

    console.log(`Total Model Cost Events: ${modelCostLogs.length}`);
    console.log(
      `Total Model Cost Paid:   $${formatUnits(totalModelCostOnChain, USDC_DECIMALS)}`
    );

    if (modelCostsByUser.size > 0) {
      console.log("\nBy User:");
      for (const [userAddr, amount] of modelCostsByUser) {
        console.log(`  ${userAddr}: $${formatUnits(amount, USDC_DECIMALS)}`);
      }
    }

    // =========================================================================
    // 3. QUERY PAID EVENTS (Tool Payments)
    // =========================================================================
    console.log("\n🛠️  QUERY PAID EVENTS (Tool Payments)");
    console.log("-".repeat(60));

    const queryPaidLogs = await client.getLogs({
      address: CONTEXT_ROUTER_ADDRESS,
      event: QUERY_PAID_EVENT,
      fromBlock: "earliest",
      toBlock: "latest",
    });

    let totalToolPaymentsOnChain = 0n;
    let totalPlatformFeesOnChain = 0n;

    for (const log of queryPaidLogs) {
      const amount = log.args.amount as bigint;
      const platformFee = log.args.platformFee as bigint;
      totalToolPaymentsOnChain += amount;
      totalPlatformFeesOnChain += platformFee;
    }

    console.log(`Total QueryPaid Events:  ${queryPaidLogs.length}`);
    console.log(
      `Total Tool Payments:     $${formatUnits(totalToolPaymentsOnChain, USDC_DECIMALS)}`
    );
    console.log(
      `Total Platform Fees:     $${formatUnits(totalPlatformFeesOnChain, USDC_DECIMALS)}`
    );

    // =========================================================================
    // 4. CLAIMED FEES (Already Withdrawn)
    // =========================================================================
    console.log("\n🏦 PLATFORM FEES CLAIMED (Already Withdrawn)");
    console.log("-".repeat(60));

    const claimedLogs = await client.getLogs({
      address: CONTEXT_ROUTER_ADDRESS,
      event: PLATFORM_FEES_CLAIMED_EVENT,
      fromBlock: "earliest",
      toBlock: "latest",
    });

    let totalClaimed = 0n;
    for (const log of claimedLogs) {
      totalClaimed += log.args.amount as bigint;
    }

    console.log(`Total Claim Events: ${claimedLogs.length}`);
    console.log(
      `Total Claimed:      $${formatUnits(totalClaimed, USDC_DECIMALS)}`
    );

    // =========================================================================
    // 5. DATABASE COMPARISON
    // =========================================================================
    console.log("\n📋 DATABASE vs ON-CHAIN COMPARISON");
    console.log("-".repeat(60));

    // Get accumulated model costs from database
    const dbCosts = await sql`
      SELECT 
        SUM(accumulated_model_cost::numeric) as total_accumulated
      FROM "UserSettings"
      WHERE tier = 'convenience'
    `;
    const totalDbAccumulated = Number(dbCosts[0]?.total_accumulated ?? 0);

    // Get actual costs from history
    const dbHistory = await sql`
      SELECT 
        SUM(actual_cost::numeric) as total_actual
      FROM "ModelCostHistory"
    `;
    const totalDbActual = Number(dbHistory[0]?.total_actual ?? 0);

    console.log("\nDatabase Records:");
    console.log(
      `  Accumulated Model Costs:  $${totalDbAccumulated.toFixed(6)}`
    );
    console.log(`  History Sum (actual):     $${totalDbActual.toFixed(6)}`);

    console.log("\nOn-Chain Records:");
    const onChainModelCost = Number(
      formatUnits(totalModelCostOnChain, USDC_DECIMALS)
    );
    const onChainPlatformFees = Number(
      formatUnits(totalPlatformFeesOnChain, USDC_DECIMALS)
    );
    const onChainPlatformBalance = Number(
      formatUnits(platformBalance, USDC_DECIMALS)
    );
    console.log(`  Model Costs (events):     $${onChainModelCost.toFixed(6)}`);
    console.log(
      `  Platform Fees (10%):      $${onChainPlatformFees.toFixed(6)}`
    );
    console.log(
      `  Platform Balance (total): $${onChainPlatformBalance.toFixed(6)}`
    );
    console.log(
      `  Already Claimed:          $${Number(formatUnits(totalClaimed, USDC_DECIMALS)).toFixed(6)}`
    );

    // =========================================================================
    // 6. RECONCILIATION
    // =========================================================================
    console.log("\n✅ RECONCILIATION");
    console.log("-".repeat(60));

    // Expected platform balance = model costs + platform fees - claimed
    const expectedPlatformBalance =
      totalModelCostOnChain + totalPlatformFeesOnChain - totalClaimed;
    const platformBalanceDelta = platformBalance - expectedPlatformBalance;

    console.log(
      `Expected Platform Balance: $${formatUnits(expectedPlatformBalance, USDC_DECIMALS)}`
    );
    console.log(
      `Actual Platform Balance:   $${formatUnits(platformBalance, USDC_DECIMALS)}`
    );
    console.log(
      `Delta:                     $${formatUnits(platformBalanceDelta, USDC_DECIMALS)}`
    );

    // Compare DB accumulated vs on-chain model costs
    const dbVsOnChainDelta = totalDbAccumulated - onChainModelCost;
    console.log("\nDB Accumulated vs On-Chain Model Costs:");
    console.log(`  Database:   $${totalDbAccumulated.toFixed(6)}`);
    console.log(`  On-Chain:   $${onChainModelCost.toFixed(6)}`);
    console.log(`  Delta:      $${dbVsOnChainDelta.toFixed(6)}`);

    // =========================================================================
    // FINAL VERDICT
    // =========================================================================
    console.log(`\n${"=".repeat(60)}`);
    console.log("📋 FINAL VERDICT");
    console.log(`${"=".repeat(60)}`);

    const platformBalanceOk = Math.abs(Number(platformBalanceDelta)) < 1000; // < $0.001 tolerance
    const dbMatchesOnChain = Math.abs(dbVsOnChainDelta) < 0.01; // < $0.01 tolerance

    if (onChainModelCost === 0 && totalDbAccumulated > 0) {
      console.log(
        "\n⚠️  WARNING: Database shows accumulated costs but NO on-chain model cost events!"
      );
      console.log(
        "   This could mean convenience tier payments are NOT going on-chain."
      );
      console.log(
        "   Check if executeQueryWithModelCostFor is being called correctly."
      );
    } else if (platformBalanceOk) {
      console.log("\n✅ Platform balance reconciles correctly");
    } else {
      console.log(
        `\n⚠️  Platform balance mismatch: $${formatUnits(platformBalanceDelta, USDC_DECIMALS)}`
      );
    }

    if (dbMatchesOnChain) {
      console.log("✅ Database accumulated costs match on-chain events");
    } else {
      console.log(
        `⚠️  Database vs on-chain delta: $${dbVsOnChainDelta.toFixed(6)}`
      );
    }

    // Summary
    console.log("\n📊 SUMMARY FOR ADMIN:");
    console.log(
      `   Platform Balance Ready to Claim: $${onChainPlatformBalance.toFixed(6)}`
    );
    console.log("   Breakdown:");
    console.log(`     - Model Costs (100%):   $${onChainModelCost.toFixed(6)}`);
    console.log(
      `     - Tool Fees (10%):      $${onChainPlatformFees.toFixed(6)}`
    );
    console.log(
      `     - Already Claimed:      -$${Number(formatUnits(totalClaimed, USDC_DECIMALS)).toFixed(6)}`
    );

    console.log("\n");
  } catch (error) {
    console.error("❌ Audit failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
};

auditOnChainPayments()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
