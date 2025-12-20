import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type FlowType,
  flowCostMultipliers,
  modelCostHistory,
} from "@/lib/db/schema";
import { chatModels } from "./models";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// Re-export FlowType for consumers
export type { FlowType } from "@/lib/db/schema";

/**
 * Default multipliers if no historical data exists
 * Conservative estimates to avoid undercharging
 *
 * These account for self-healing retries (up to 2 per execution):
 * - manual_simple: 1 AI call (direct chat, no tools)
 * - manual_tools: 2-5 AI calls (planning + self-healing retries + final response)
 * - auto_mode: 3-7 AI calls (discovery + planning + code retries + self-healing + final)
 * - auto_mode_no_tools: 2 AI calls (discovery + final response, AI determined no tools needed)
 */
const DEFAULT_MULTIPLIERS: Record<FlowType, number> = {
  manual_simple: 1.0, // Single AI call
  manual_tools: 3.0, // Planning + self-healing (0-2) + final response
  auto_mode: 5.0, // Discovery + planning + retries + self-healing + final
  auto_mode_no_tools: 2.0, // Discovery + final response (no tools selected)
};

/**
 * Minimum samples before we trust the learned multiplier
 */
const MIN_SAMPLES_FOR_CONFIDENCE = 10;

/**
 * Exponential moving average alpha (how fast to adapt)
 * Lower = more stable, Higher = faster adaptation
 */
const EMA_ALPHA = 0.1;

/**
 * Get the base cost estimate for a model (single AI call)
 */
export function getBaseModelCost(modelId: string): number {
  const model = chatModels.find((m) => m.id === modelId);
  return model?.estimatedCostPerQuery ?? 0.003; // Default to chat-model price
}

/**
 * Determine flow type based on context
 */
export function determineFlowType(
  isAutoMode: boolean,
  hasTools: boolean
): FlowType {
  if (isAutoMode) {
    return "auto_mode";
  }
  return hasTools ? "manual_tools" : "manual_simple";
}

/**
 * Get the cost multiplier for a specific model and flow type
 * Uses historical data if available, otherwise falls back to defaults
 */
export async function getFlowMultiplier(
  modelId: string,
  flowType: FlowType
): Promise<{ multiplier: number; confidence: "high" | "low" | "default" }> {
  try {
    const result = await db
      .select()
      .from(flowCostMultipliers)
      .where(
        and(
          eq(flowCostMultipliers.modelId, modelId),
          eq(flowCostMultipliers.flowType, flowType)
        )
      )
      .limit(1);

    if (result.length > 0) {
      const { multiplier, sampleCount } = result[0];
      const mult = Number(multiplier);

      if (sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
        return { multiplier: mult, confidence: "high" };
      }
      if (sampleCount > 0) {
        return { multiplier: mult, confidence: "low" };
      }
    }

    // No data, use defaults
    return {
      multiplier: DEFAULT_MULTIPLIERS[flowType],
      confidence: "default",
    };
  } catch (error) {
    console.error("[cost-estimation] Failed to get multiplier:", error);
    return {
      multiplier: DEFAULT_MULTIPLIERS[flowType],
      confidence: "default",
    };
  }
}

/**
 * Calculate the estimated cost for a query
 * This is what we charge the user upfront
 */
export async function estimateQueryCost(
  modelId: string,
  flowType: FlowType
): Promise<{
  baseCost: number;
  multiplier: number;
  estimatedCost: number;
  confidence: "high" | "low" | "default";
}> {
  const baseCost = getBaseModelCost(modelId);
  const { multiplier, confidence } = await getFlowMultiplier(modelId, flowType);
  const estimatedCost = baseCost * multiplier;

  return {
    baseCost,
    multiplier,
    estimatedCost,
    confidence,
  };
}

/**
 * Record actual cost and update the multiplier using EMA
 * Called after the agentic flow completes
 */
export async function recordActualCost(params: {
  userId: string;
  chatId: string;
  modelId: string;
  flowType: FlowType;
  estimatedCost: number;
  actualCost: number;
  aiCallCount: number;
}): Promise<void> {
  const {
    userId,
    chatId,
    modelId,
    flowType,
    estimatedCost,
    actualCost,
    aiCallCount,
  } = params;

  try {
    // 1. Record in history table
    await db.insert(modelCostHistory).values({
      userId,
      chatId,
      modelId,
      flowType,
      estimatedCost: String(estimatedCost),
      actualCost: String(actualCost),
      aiCallCount,
    });

    // 2. Calculate actual multiplier for this query
    const baseCost = getBaseModelCost(modelId);
    const actualMultiplier = baseCost > 0 ? actualCost / baseCost : 1;

    // 3. Update the flow multiplier using exponential moving average
    const existing = await db
      .select()
      .from(flowCostMultipliers)
      .where(
        and(
          eq(flowCostMultipliers.modelId, modelId),
          eq(flowCostMultipliers.flowType, flowType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const currentMultiplier = Number(existing[0].multiplier);
      const currentSampleCount = existing[0].sampleCount;

      // EMA: newValue = alpha * newSample + (1 - alpha) * oldValue
      const newMultiplier =
        EMA_ALPHA * actualMultiplier + (1 - EMA_ALPHA) * currentMultiplier;

      await db
        .update(flowCostMultipliers)
        .set({
          multiplier: String(newMultiplier),
          sampleCount: currentSampleCount + 1,
          lastUpdated: new Date(),
        })
        .where(
          and(
            eq(flowCostMultipliers.modelId, modelId),
            eq(flowCostMultipliers.flowType, flowType)
          )
        );

      console.log("[cost-estimation] Updated multiplier:", {
        modelId,
        flowType,
        previousMultiplier: currentMultiplier.toFixed(4),
        actualMultiplier: actualMultiplier.toFixed(4),
        newMultiplier: newMultiplier.toFixed(4),
        sampleCount: currentSampleCount + 1,
      });
    } else {
      // Insert new record
      await db.insert(flowCostMultipliers).values({
        modelId,
        flowType,
        multiplier: String(actualMultiplier),
        sampleCount: 1,
      });

      console.log("[cost-estimation] Created new multiplier:", {
        modelId,
        flowType,
        multiplier: actualMultiplier.toFixed(4),
      });
    }

    // 4. Log delta for monitoring
    const delta = actualCost - estimatedCost;
    const deltaPercent = estimatedCost > 0 ? (delta / estimatedCost) * 100 : 0;

    console.log("[cost-estimation] Cost tracking:", {
      modelId,
      flowType,
      estimated: `$${estimatedCost.toFixed(6)}`,
      actual: `$${actualCost.toFixed(6)}`,
      delta: `$${delta.toFixed(6)}`,
      deltaPercent: `${deltaPercent.toFixed(1)}%`,
      aiCalls: aiCallCount,
    });
  } catch (error) {
    console.error("[cost-estimation] Failed to record cost:", error);
    // Don't throw - this is a non-critical tracking operation
  }
}

/**
 * Get cost estimation stats for monitoring/admin
 */
export async function getCostEstimationStats(modelId?: string) {
  try {
    const baseQuery = db
      .select({
        modelId: modelCostHistory.modelId,
        flowType: modelCostHistory.flowType,
        avgEstimated: sql<number>`AVG(${modelCostHistory.estimatedCost}::numeric)`,
        avgActual: sql<number>`AVG(${modelCostHistory.actualCost}::numeric)`,
        avgDelta: sql<number>`AVG(${modelCostHistory.actualCost}::numeric - ${modelCostHistory.estimatedCost}::numeric)`,
        totalQueries: sql<number>`COUNT(*)`,
        avgAiCalls: sql<number>`AVG(${modelCostHistory.aiCallCount})`,
      })
      .from(modelCostHistory)
      .groupBy(modelCostHistory.modelId, modelCostHistory.flowType);

    if (modelId) {
      return baseQuery.where(eq(modelCostHistory.modelId, modelId));
    }

    return baseQuery;
  } catch (error) {
    console.error("[cost-estimation] Failed to get stats:", error);
    return [];
  }
}

/**
 * Get all flow multipliers for monitoring
 */
export async function getAllFlowMultipliers() {
  try {
    return await db.select().from(flowCostMultipliers);
  } catch (error) {
    console.error("[cost-estimation] Failed to get all multipliers:", error);
    return [];
  }
}

/**
 * Get default multiplier for a flow type (used by frontend)
 * This is synchronous and doesn't require database access
 */
export function getDefaultFlowMultiplier(flowType: FlowType): number {
  return DEFAULT_MULTIPLIERS[flowType];
}
