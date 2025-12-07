import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";
import { calculateRequiredStake } from "@/lib/constants";
import { aiTool } from "@/lib/db/schema";
import { uuidToUint256 } from "@/lib/utils";

/**
 * CRON: Stake Sync (Level 3 - Economic Security)
 * 
 * Syncs on-chain stake amounts from the ContextRouter contract to the database.
 * Runs daily to keep totalStaked in sync with actual on-chain state.
 * 
 * ALL tools require staking now (minimum $1 or 100x query price).
 * 
 * Process:
 * 1. Fetch ALL tools from the database
 * 2. For each tool, read getStake(toolId) from the contract
 * 3. Update totalStaked in the database
 * 4. Auto-activate tools when stake requirement is met
 * 
 * Authorization: Vercel Cron uses CRON_SECRET environment variable
 */

const LOG_PREFIX = "[cron/sync-stakes]";

// Create database connection
const connectionString = process.env.POSTGRES_URL ?? "";
const client = postgres(connectionString);
const db = drizzle(client);

// Contract ABI for stake reading
const CONTEXT_ROUTER_ABI = parseAbi([
  "function getStake(uint256 toolId) external view returns (uint256)",
]);

// Determine chain based on environment
const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
const chain = isProduction ? base : baseSepolia;
const routerAddress = (
  isProduction 
    ? process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS 
    : process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA || process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS
) as `0x${string}` | undefined;

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log(LOG_PREFIX, "Unauthorized request - missing or invalid CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if contract address is configured
  if (!routerAddress) {
    console.log(LOG_PREFIX, "Contract address not configured, skipping stake sync");
    return NextResponse.json({ 
      success: true, 
      skipped: true,
      reason: "NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS not configured" 
    });
  }

  const startTime = performance.now();
  console.log(LOG_PREFIX, `Starting stake sync on ${chain.name}`);

  try {
    // Create viem client for reading contract state
    const publicClient = createPublicClient({
      chain,
      transport: http(process.env.BASE_RPC_URL || chain.rpcUrls.default.http[0]),
    });

    // Fetch ALL tools - all tools require staking now (minimum $1)
    const toolsToSync = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        pricePerQuery: aiTool.pricePerQuery,
        currentStaked: aiTool.totalStaked,
        isActive: aiTool.isActive,
      })
      .from(aiTool);

    console.log(LOG_PREFIX, `Found ${toolsToSync.length} tools to sync`);

    const results = {
      synced: 0,
      unchanged: 0,
      errors: 0,
      autoActivated: 0,
    };

    // Sync each tool's stake
    for (const tool of toolsToSync) {
      try {
        const toolIdBigInt = uuidToUint256(tool.id);
        
        // Read stake from contract
        const onChainStake = await publicClient.readContract({
          address: routerAddress,
          abi: CONTEXT_ROUTER_ABI,
          functionName: "getStake",
          args: [toolIdBigInt],
        });

        // Convert from USDC units (6 decimals) to decimal string
        const stakeInUsdc = (Number(onChainStake) / 1_000_000).toFixed(6);
        const currentInUsdc = tool.currentStaked ?? "0";

        // Only update if different
        if (stakeInUsdc !== currentInUsdc) {
          await db
            .update(aiTool)
            .set({
              totalStaked: stakeInUsdc,
              updatedAt: new Date(),
            })
            .where(eq(aiTool.id, tool.id));
          
          results.synced++;
          console.log(LOG_PREFIX, `✓ ${tool.name}: ${currentInUsdc} → ${stakeInUsdc} USDC`);
        } else {
          results.unchanged++;
        }

        // Auto-activate tool if stake requirement is now met and tool is inactive
        // ALL tools start inactive until staked (minimum $1 or 100x price)
        const priceValue = Number.parseFloat(tool.pricePerQuery) || 0;
        const requiredStake = calculateRequiredStake(priceValue);
        const stakeValue = Number.parseFloat(stakeInUsdc);

        if (!tool.isActive && stakeValue >= requiredStake) {
          await db
            .update(aiTool)
            .set({
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(aiTool.id, tool.id));
          
          results.autoActivated++;
          console.log(LOG_PREFIX, `✓ ${tool.name}: Auto-activated (stake $${stakeValue.toFixed(2)} >= required $${requiredStake.toFixed(2)})`);
        }
      } catch (error) {
        results.errors++;
        console.error(LOG_PREFIX, `✗ ${tool.name} sync failed:`, error);
      }
    }

    const duration = Math.round(performance.now() - startTime);
    console.log(LOG_PREFIX, `Stake sync complete (${duration}ms):`, results);

    return NextResponse.json({
      success: true,
      duration,
      chain: chain.name,
      results,
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(LOG_PREFIX, `Stake sync failed (${duration}ms):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Export config for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for cron




