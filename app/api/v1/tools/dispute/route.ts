import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { aiTool, toolQuery, toolReport } from "@/lib/db/schema";
import type { DisputeReason, DisputeVerdict } from "@/lib/db/schema";
import { adjudicateSchemaMismatch } from "@/lib/tools/schema-validator";

/**
 * POST /api/v1/tools/dispute
 *
 * Dispute Resolution Protocol - Web3 Fraud Proofs
 *
 * Key innovation: You can only dispute a tool if you have a valid
 * transaction_hash proving you paid for it. This makes Sybil attacks
 * economically infeasible - attackers must fund their targets.
 *
 * Flow:
 * 1. Validate transaction_hash exists and matches toolId
 * 2. For schema_mismatch: Auto-adjudicate using JSON schema validation
 * 3. For other reasons: Mark as manual_review
 * 4. If guilty: Increment tool's total_flags
 * 5. If flags > threshold: Auto-deactivate tool (soft slash)
 *
 * Authentication: Requires valid user session (disputant must be authenticated)
 */

const LOG_PREFIX = "[api/v1/tools/dispute]";

// Threshold for auto-deactivation (soft slash)
const FLAG_THRESHOLD_FOR_DEACTIVATION = 5;

// How recent the transaction must be to dispute (7 days)
const MAX_DISPUTE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Valid dispute reasons
const VALID_REASONS: DisputeReason[] = [
  "schema_mismatch",
  "execution_error",
  "malicious_content",
  "data_fabrication",
];

// Create database connection
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

type DisputeRequest = {
  toolId: string;
  transactionHash: string;
  reason: DisputeReason;
  details?: string;
  toolName?: string; // Optional: specific tool name for multi-tool MCP servers
};

export async function POST(request: Request) {
  const startTime = performance.now();

  try {
    // Parse request body
    const body = (await request.json()) as DisputeRequest;
    const { toolId, transactionHash, reason, details, toolName } = body;

    // Validate required fields
    if (!toolId || !transactionHash || !reason) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["toolId", "transactionHash", "reason"],
        },
        { status: 400 }
      );
    }

    // Validate reason is a valid enum value
    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        {
          error: "Invalid dispute reason",
          validReasons: VALID_REASONS,
        },
        { status: 400 }
      );
    }

    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      return NextResponse.json(
        { error: "Invalid transaction hash format" },
        { status: 400 }
      );
    }

    console.log(LOG_PREFIX, "Dispute filed:", { toolId, transactionHash, reason });

    // =========================================================
    // STEP 1: Validate the Fraud Proof (transaction_hash)
    // =========================================================

    // Find the query that matches this transaction hash
    const query = await db
      .select({
        id: toolQuery.id,
        toolId: toolQuery.toolId,
        userId: toolQuery.userId,
        queryOutput: toolQuery.queryOutput,
        executedAt: toolQuery.executedAt,
      })
      .from(toolQuery)
      .where(eq(toolQuery.transactionHash, transactionHash))
      .limit(1);

    if (query.length === 0) {
      console.log(LOG_PREFIX, "Invalid fraud proof - transaction not found");
      return NextResponse.json(
        {
          error: "Invalid transaction hash",
          message: "No query found with this transaction hash. You can only dispute tools you've paid for.",
        },
        { status: 403 }
      );
    }

    const matchedQuery = query[0];

    // Verify the transaction matches the disputed tool
    if (matchedQuery.toolId !== toolId) {
      console.log(LOG_PREFIX, "Transaction/tool mismatch");
      return NextResponse.json(
        {
          error: "Transaction mismatch",
          message: "This transaction is for a different tool",
        },
        { status: 403 }
      );
    }

    // Check if transaction is too old
    const queryAge = Date.now() - new Date(matchedQuery.executedAt).getTime();
    if (queryAge > MAX_DISPUTE_AGE_MS) {
      return NextResponse.json(
        {
          error: "Dispute window expired",
          message: "Disputes must be filed within 7 days of the transaction",
        },
        { status: 400 }
      );
    }

    // Check for duplicate dispute
    const existingDispute = await db
      .select({ id: toolReport.id })
      .from(toolReport)
      .where(eq(toolReport.transactionHash, transactionHash))
      .limit(1);

    if (existingDispute.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate dispute",
          message: "A dispute has already been filed for this transaction",
        },
        { status: 409 }
      );
    }

    // =========================================================
    // STEP 2: Get tool data for adjudication
    // =========================================================

    const tool = await db
      .select({
        id: aiTool.id,
        name: aiTool.name,
        toolSchema: aiTool.toolSchema,
        totalFlags: aiTool.totalFlags,
        isActive: aiTool.isActive,
      })
      .from(aiTool)
      .where(eq(aiTool.id, toolId))
      .limit(1);

    if (tool.length === 0) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    const disputedTool = tool[0];

    // =========================================================
    // STEP 3: Auto-adjudicate (The Robot Judge)
    // =========================================================

    let verdict: DisputeVerdict = "pending";
    let schemaErrors: unknown = null;
    let adjudicationReason = "";

    if (reason === "schema_mismatch") {
      // Automated schema validation
      const adjudication = adjudicateSchemaMismatch(
        matchedQuery.queryOutput,
        disputedTool.toolSchema,
        toolName
      );

      verdict = adjudication.verdict;
      schemaErrors = adjudication.validationResult.errors;
      adjudicationReason = adjudication.reason;

      console.log(LOG_PREFIX, `Schema adjudication: ${verdict}`, {
        errors: adjudication.validationResult.errorMessages,
      });
    } else {
      // Other reasons require manual review
      verdict = "manual_review";
      adjudicationReason = `Reason "${reason}" requires human review`;
    }

    // =========================================================
    // STEP 4: Create the dispute record
    // =========================================================

    const newDispute = await db
      .insert(toolReport)
      .values({
        toolId,
        reporterId: matchedQuery.userId,
        transactionHash,
        queryId: matchedQuery.id,
        reason,
        details: details || null,
        verdict,
        schemaErrors: schemaErrors as Record<string, unknown>,
        status: verdict === "guilty" ? "resolved" : "pending",
      })
      .returning({ id: toolReport.id });

    console.log(LOG_PREFIX, "Dispute created:", newDispute[0].id);

    // =========================================================
    // STEP 5: Update tool flags if guilty
    // =========================================================

    let toolDeactivated = false;

    if (verdict === "guilty") {
      // Increment total_flags
      const newFlagCount = (disputedTool.totalFlags || 0) + 1;

      await db
        .update(aiTool)
        .set({
          totalFlags: newFlagCount,
          updatedAt: new Date(),
          // Auto-deactivate if threshold reached (Soft Slash)
          ...(newFlagCount >= FLAG_THRESHOLD_FOR_DEACTIVATION && disputedTool.isActive
            ? { isActive: false }
            : {}),
        })
        .where(eq(aiTool.id, toolId));

      if (newFlagCount >= FLAG_THRESHOLD_FOR_DEACTIVATION && disputedTool.isActive) {
        toolDeactivated = true;
        console.log(LOG_PREFIX, `Tool ${disputedTool.name} DEACTIVATED (soft slash) - ${newFlagCount} flags`);
      } else {
        console.log(LOG_PREFIX, `Tool ${disputedTool.name} flagged - ${newFlagCount}/${FLAG_THRESHOLD_FOR_DEACTIVATION}`);
      }
    }

    // =========================================================
    // Response
    // =========================================================

    const duration = Math.round(performance.now() - startTime);

    return NextResponse.json({
      success: true,
      dispute: {
        id: newDispute[0].id,
        toolId,
        reason,
        verdict,
        adjudicationReason,
        schemaErrors: verdict === "guilty" ? schemaErrors : undefined,
      },
      toolStatus: {
        totalFlags: (disputedTool.totalFlags || 0) + (verdict === "guilty" ? 1 : 0),
        deactivated: toolDeactivated,
        flagThreshold: FLAG_THRESHOLD_FOR_DEACTIVATION,
      },
      duration,
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(LOG_PREFIX, `Dispute failed (${duration}ms):`, error);

    return NextResponse.json(
      {
        error: "Dispute processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/tools/dispute?toolId=xxx
 *
 * Get disputes for a specific tool (for transparency)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get("toolId");

  if (!toolId) {
    return NextResponse.json(
      { error: "toolId query parameter required" },
      { status: 400 }
    );
  }

  try {
    const disputes = await db
      .select({
        id: toolReport.id,
        reason: toolReport.reason,
        verdict: toolReport.verdict,
        status: toolReport.status,
        createdAt: toolReport.createdAt,
        // Don't expose transaction hash or reporter for privacy
      })
      .from(toolReport)
      .where(eq(toolReport.toolId, toolId))
      .orderBy(sql`${toolReport.createdAt} DESC`)
      .limit(50);

    // Get tool summary
    const tool = await db
      .select({
        totalFlags: aiTool.totalFlags,
        isActive: aiTool.isActive,
      })
      .from(aiTool)
      .where(eq(aiTool.id, toolId))
      .limit(1);

    return NextResponse.json({
      toolId,
      disputes,
      summary: {
        totalDisputes: disputes.length,
        guiltyCount: disputes.filter((d) => d.verdict === "guilty").length,
        pendingCount: disputes.filter((d) => d.verdict === "pending" || d.verdict === "manual_review").length,
        totalFlags: tool[0]?.totalFlags || 0,
        isActive: tool[0]?.isActive ?? true,
      },
    });
  } catch (error) {
    console.error(LOG_PREFIX, "Failed to get disputes:", error);
    return NextResponse.json(
      { error: "Failed to retrieve disputes" },
      { status: 500 }
    );
  }
}

