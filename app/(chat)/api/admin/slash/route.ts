import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits } from "viem";
import { auth } from "@/app/(auth)/auth";
import { getAffectedUsersForTool, getAIToolById } from "@/lib/db/queries";
import { contextRouterAbi } from "@/lib/generated";

/**
 * POST /api/admin/slash
 *
 * Prepare slash transaction data for on-chain execution.
 * Returns unsigned transaction data for admin wallet to sign client-side.
 *
 * NEW: Uses slashAndCompensateAll() to refund ALL affected users + bounty to first reporter
 *
 * Body:
 * - toolId: UUID of the tool to slash
 * - slashAmount: Total amount in USDC to slash from stake (e.g., "50.00")
 *
 * Response:
 * - Transaction data for the admin wallet to sign
 * - Compensation preview (refunds, bounty, adjudication fee breakdown)
 * - Tool and affected users info for confirmation
 */

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

const LOG_PREFIX = "[api/admin/slash]";

// Bounty parameters (must match contract)
const BOUNTY_PERCENT = 20; // 20% of remaining goes to first reporter
const MINIMUM_BOUNTY = 1.0; // $1.00 minimum bounty

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin check
    const userEmail = session.user.email || "";
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { toolId, slashAmount } = body;

    // Validate required fields
    if (!toolId || !slashAmount) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["toolId", "slashAmount"],
        },
        { status: 400 }
      );
    }

    // Validate amount format
    const slashAmountNumber = Number.parseFloat(slashAmount);
    if (Number.isNaN(slashAmountNumber) || slashAmountNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid slashAmount - must be a positive number" },
        { status: 400 }
      );
    }

    // Get tool info
    const tool = await getAIToolById({ id: toolId });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Get all affected users for this tool
    const {
      affectedUsers,
      totalRefunds,
      firstReporterWallet,
      userCount,
    } = await getAffectedUsersForTool(toolId);

    if (userCount === 0 || !firstReporterWallet) {
      return NextResponse.json(
        {
          error: "No affected users found",
          message: "There must be at least one dispute with a valid user wallet to slash",
        },
        { status: 400 }
      );
    }

    // Validate slash amount covers refunds
    const totalRefundsNumber = Number.parseFloat(totalRefunds);
    if (slashAmountNumber < totalRefundsNumber) {
      return NextResponse.json(
        {
          error: "Slash amount insufficient",
          message: `Slash amount ($${slashAmountNumber.toFixed(2)}) must cover all refunds ($${totalRefundsNumber.toFixed(2)})`,
          required: totalRefundsNumber,
        },
        { status: 400 }
      );
    }

    // Calculate compensation breakdown
    const remaining = slashAmountNumber - totalRefundsNumber;
    let bounty = (remaining * BOUNTY_PERCENT) / 100;
    
    // Enforce minimum bounty
    if (bounty < MINIMUM_BOUNTY && remaining >= MINIMUM_BOUNTY) {
      bounty = MINIMUM_BOUNTY;
    }
    // Cap bounty at remaining
    if (bounty > remaining) {
      bounty = remaining;
    }
    
    const adjudicationFee = remaining - bounty;

    // Get contract address
    const routerAddress = process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS;
    if (!routerAddress) {
      console.error(LOG_PREFIX, "Router address not configured");
      return NextResponse.json(
        { error: "Contract not configured" },
        { status: 500 }
      );
    }

    // Convert toolId UUID to numeric for contract call
    const toolIdNumeric = uuidToNumeric(toolId);

    // Convert amounts to USDC wei (6 decimals)
    const slashAmountWei = parseUnits(slashAmount, 6);
    
    // Build arrays for contract call
    const recipients = affectedUsers.map((u) => u.wallet as `0x${string}`);
    const refundAmountsWei = affectedUsers.map((u) =>
      parseUnits(u.amountPaid, 6)
    );

    // Build reason string
    const reason = `Slash for ${userCount} affected user(s). Total refunds: $${totalRefundsNumber.toFixed(2)}, Bounty: $${bounty.toFixed(2)}`;

    // Encode the slashAndCompensateAll function call
    const callData = encodeFunctionData({
      abi: contextRouterAbi,
      functionName: "slashAndCompensateAll",
      args: [
        toolIdNumeric,
        slashAmountWei,
        recipients,
        refundAmountsWei,
        firstReporterWallet as `0x${string}`,
        reason,
      ],
    });

    console.log(LOG_PREFIX, "Prepared slashAndCompensateAll transaction", {
      toolId,
      toolIdNumeric: toolIdNumeric.toString(),
      slashAmount,
      userCount,
      totalRefunds,
      bounty: bounty.toFixed(2),
      adjudicationFee: adjudicationFee.toFixed(2),
      firstReporter: firstReporterWallet,
    });

    return NextResponse.json({
      success: true,
      transaction: {
        to: routerAddress,
        data: callData,
        value: "0",
      },
      compensation: {
        totalSlash: slashAmountNumber.toFixed(2),
        totalRefunds: totalRefundsNumber.toFixed(2),
        bounty: bounty.toFixed(2),
        adjudicationFee: adjudicationFee.toFixed(2),
        firstReporterWallet,
        userCount,
      },
      affectedUsers: affectedUsers.map((u) => ({
        wallet: u.wallet,
        refund: u.amountPaid,
        isFirstReporter: u.isFirstReporter,
        disputeId: u.disputeId,
      })),
      details: {
        toolId,
        toolIdNumeric: toolIdNumeric.toString(),
        toolName: tool.name,
        currentStake: tool.totalStaked,
        slashAmount,
        slashAmountWei: slashAmountWei.toString(),
        reason,
      },
    });
  } catch (error) {
    console.error(LOG_PREFIX, "Failed to prepare slash transaction:", error);
    return NextResponse.json(
      { error: "Failed to prepare slash transaction" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/slash?toolId=xxx
 *
 * Get compensation preview for a tool before slashing.
 * Used by the admin UI to show the breakdown before confirming.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin check
    const userEmail = session.user.email || "";
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("toolId");

    if (!toolId) {
      return NextResponse.json(
        { error: "toolId query parameter required" },
        { status: 400 }
      );
    }

    // Get tool info
    const tool = await getAIToolById({ id: toolId });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Get all affected users
    const {
      affectedUsers,
      totalRefunds,
      firstReporterWallet,
      userCount,
    } = await getAffectedUsersForTool(toolId);

    // Calculate compensation preview using full stake
    const stakeAmount = Number.parseFloat(tool.totalStaked ?? "0");
    const totalRefundsNumber = Number.parseFloat(totalRefunds);
    const remaining = Math.max(0, stakeAmount - totalRefundsNumber);
    
    let bounty = (remaining * BOUNTY_PERCENT) / 100;
    if (bounty < MINIMUM_BOUNTY && remaining >= MINIMUM_BOUNTY) {
      bounty = MINIMUM_BOUNTY;
    }
    if (bounty > remaining) {
      bounty = remaining;
    }
    
    const adjudicationFee = remaining - bounty;

    return NextResponse.json({
      tool: {
        id: tool.id,
        name: tool.name,
        stake: tool.totalStaked,
        pricePerQuery: tool.pricePerQuery,
        isActive: tool.isActive,
      },
      compensation: {
        totalSlash: stakeAmount.toFixed(2),
        totalRefunds: totalRefundsNumber.toFixed(2),
        bounty: bounty.toFixed(2),
        adjudicationFee: adjudicationFee.toFixed(2),
        firstReporterWallet,
        userCount,
      },
      affectedUsers: affectedUsers.map((u) => ({
        wallet: u.wallet,
        refund: u.amountPaid,
        isFirstReporter: u.isFirstReporter,
        disputeId: u.disputeId,
      })),
      canSlash: userCount > 0 && stakeAmount >= totalRefundsNumber,
      insufficientStake: stakeAmount < totalRefundsNumber,
    });
  } catch (error) {
    console.error(LOG_PREFIX, "Failed to get slash preview:", error);
    return NextResponse.json(
      { error: "Failed to get slash preview" },
      { status: 500 }
    );
  }
}

/**
 * Convert UUID to a numeric value for the contract.
 * Uses a simple hash approach - takes first 8 bytes of the UUID.
 */
function uuidToNumeric(uuid: string): bigint {
  // Remove dashes and take first 16 hex chars (8 bytes)
  const cleanUuid = uuid.replace(/-/g, "");
  const hexPart = cleanUuid.slice(0, 16);
  return BigInt(`0x${hexPart}`);
}
