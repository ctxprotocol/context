import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits } from "viem";
import { auth } from "@/app/(auth)/auth";
import { getDisputeById } from "@/lib/db/queries";
import { contextRouterAbi } from "@/lib/generated";

/**
 * POST /api/admin/slash
 *
 * Prepare slash transaction data for on-chain execution.
 * Returns unsigned transaction data for admin wallet to sign client-side.
 *
 * Body:
 * - toolId: UUID of the tool to slash
 * - disputeId: UUID of the dispute triggering the slash
 * - amount: Amount in USDC to slash (e.g., "50.00")
 *
 * Response:
 * - Transaction data for the admin wallet to sign
 * - Tool and dispute info for confirmation
 */

const ADMIN_EMAILS = ["alex.r.macleod@gmail.com"];

const LOG_PREFIX = "[api/admin/slash]";

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
    const { toolId, disputeId, amount } = body;

    // Validate required fields
    if (!toolId || !amount) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["toolId", "amount"],
        },
        { status: 400 }
      );
    }

    // Validate amount format
    const amountNumber = Number.parseFloat(amount);
    if (Number.isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid amount - must be a positive number" },
        { status: 400 }
      );
    }

    // Get dispute info if provided
    let dispute = null;
    if (disputeId) {
      dispute = await getDisputeById(disputeId);
      if (!dispute) {
        return NextResponse.json(
          { error: "Dispute not found" },
          { status: 404 }
        );
      }
      // Verify dispute matches tool
      if (dispute.toolId !== toolId) {
        return NextResponse.json(
          { error: "Dispute does not match tool" },
          { status: 400 }
        );
      }
    }

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
    // Note: The contract uses uint256 toolId. We need to convert UUID to a compatible format.
    // For now, we'll hash the UUID to get a consistent number
    const toolIdNumeric = uuidToNumeric(toolId);

    // Convert amount to USDC wei (6 decimals)
    const amountWei = parseUnits(amount, 6);

    // Build reason string
    const reason = disputeId
      ? `Dispute ${disputeId}: ${dispute?.reason || "Admin action"}`
      : "Admin manual slash";

    // Encode the slash function call
    const callData = encodeFunctionData({
      abi: contextRouterAbi,
      functionName: "slash",
      args: [toolIdNumeric, amountWei, reason],
    });

    console.log(LOG_PREFIX, "Prepared slash transaction", {
      toolId,
      toolIdNumeric: toolIdNumeric.toString(),
      amount,
      amountWei: amountWei.toString(),
      reason,
    });

    return NextResponse.json({
      success: true,
      transaction: {
        to: routerAddress,
        data: callData,
        value: "0",
      },
      details: {
        toolId,
        toolIdNumeric: toolIdNumeric.toString(),
        amount,
        amountWei: amountWei.toString(),
        reason,
        disputeId: disputeId || null,
        toolName: dispute?.toolName || null,
        currentStake: dispute?.totalStaked || null,
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
 * Convert UUID to a numeric value for the contract.
 * Uses a simple hash approach - takes first 8 bytes of the UUID.
 */
function uuidToNumeric(uuid: string): bigint {
  // Remove dashes and take first 16 hex chars (8 bytes)
  const cleanUuid = uuid.replace(/-/g, "");
  const hexPart = cleanUuid.slice(0, 16);
  return BigInt(`0x${hexPart}`);
}
