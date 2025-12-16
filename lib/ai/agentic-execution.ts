/**
 * Shared Agentic Execution with Self-Healing
 *
 * This module provides a robust execution loop that handles:
 * 1. Runtime error correction (code crashed → fix → retry)
 * 2. Suspicious results reflection (code ran but bad data → fix → retry)
 * 3. Tool call history tracking for context
 *
 * Used by both Auto Mode and Manual Mode to ensure users get value
 * after payment - the system will try to self-heal before giving up.
 */

import type { UIMessageStreamWriter } from "ai";
import { generateText } from "ai";
import type { Session } from "next-auth";
import type { AllowedModule } from "@/lib/ai/code-executor";
import { executeSkillCode } from "@/lib/ai/code-executor";
import {
  errorCorrectionPrompt,
  formatToolCallHistory,
  reflectionPrompt,
  type ToolSchemaInfo,
} from "@/lib/ai/prompts";
import type {
  AllowedToolContext,
  ToolCallRecord,
} from "@/lib/ai/skills/runtime";
import type { ChatMessage } from "@/lib/types";

// Constants
const MAX_REFLECTION_RETRIES = 2;

/**
 * Result of code execution (mirrors executeSkillCode result)
 */
type ExecutionResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  logs: string[];
};

/**
 * Configuration for the agentic execution loop
 */
export type AgenticExecutionConfig = {
  /** Initial code to execute */
  initialCode: string;
  /** Modules allowed for execution */
  allowedModules: AllowedModule[];
  /** Allowed tools map (tool ID → context) */
  allowedTools: Map<string, AllowedToolContext>;
  /** Data stream for UI updates */
  dataStream: UIMessageStreamWriter<ChatMessage>;
  /** AI provider's language model function */
  getLanguageModel: () => ReturnType<
    typeof import("@/lib/ai/providers").myProvider.languageModel
  >;
  /** User session */
  session: Session;
  /** Chat ID for logging */
  chatId: string;
  /** Whether this is auto mode execution */
  isAutoMode: boolean;
};

/**
 * Result of the agentic execution loop
 */
export type AgenticExecutionResult = {
  /** Final execution result */
  execution: ExecutionResult;
  /** Final code (may differ from initial if fixed) */
  finalCode: string;
  /** Number of retry attempts made */
  attemptCount: number;
  /** Tool call history from execution */
  toolCallHistory: ToolCallRecord[];
};

/**
 * Check if execution data has non-empty meaningful content
 */
export function hasNonEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) {
    return false;
  }
  if (typeof data === "string") {
    return data.trim().length > 0;
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return true;
  }
  if (Array.isArray(data)) {
    return data.some(hasNonEmptyData);
  }
  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return false;
    }
    // Special case for error object: if the object has exactly one key `error`, treat it as "no data"
    if (keys.length === 1 && keys[0] === "error") {
      return false;
    }
    return Object.values(data as Record<string, unknown>).some(hasNonEmptyData);
  }
  return false;
}

/**
 * Detect suspicious execution results that might benefit from reflection
 *
 * A result is "suspicious" when:
 * 1. Execution succeeded (code ran without errors)
 * 2. Tool calls returned real data (toolCallHistory has results)
 * 3. But the final result has null/undefined values where data should exist
 *    OR the final result has empty arrays when tools returned non-empty arrays
 *
 * This pattern suggests the AI's data processing logic had a bug,
 * not that the tools failed.
 */
type SuspiciousResultCheck = {
  isSuspicious: boolean;
  reason?: string;
  nullPaths: string[];
  /** When tool returned data but post-processing filtered it to empty */
  filteredToEmpty?: {
    fieldName: string;
    toolDataCount: number;
    toolName: string;
  };
};

/**
 * Find ANY non-empty array in tool results, regardless of field name
 * Used for smarter filtered-to-empty detection when AI renames fields
 * (e.g., tool returns "opportunities" but AI code returns "picks")
 */
function findAnyToolArrayData(
  toolCallHistory: Array<{ toolName: string; result: unknown }>
): { count: number; toolName: string; fieldName: string } | null {
  // Priority fields to check first (most likely to contain main data)
  const priorityFields = [
    "opportunities",
    "results",
    "items",
    "data",
    "markets",
    "positions",
    "trades",
    "bets",
    "picks",
    "tokens",
    "chains",
  ];

  for (const call of toolCallHistory) {
    if (call.result && typeof call.result === "object") {
      const result = call.result as Record<string, unknown>;

      // Check priority fields first
      for (const fieldName of priorityFields) {
        if (Array.isArray(result[fieldName]) && result[fieldName].length > 0) {
          return {
            count: result[fieldName].length,
            toolName: call.toolName,
            fieldName,
          };
        }
      }

      // Then check any other array fields
      for (const [key, value] of Object.entries(result)) {
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          !priorityFields.includes(key)
        ) {
          return {
            count: value.length,
            toolName: call.toolName,
            fieldName: key,
          };
        }
      }
    }
  }
  return null;
}

function detectSuspiciousResults(
  executionData: unknown,
  toolCallHistory?: Array<{ toolName: string; result: unknown }>
): SuspiciousResultCheck {
  const nullPaths: string[] = [];

  // Only check if we have tool call history with actual data
  const hasToolData =
    toolCallHistory &&
    toolCallHistory.length > 0 &&
    toolCallHistory.some((call) => hasNonEmptyData(call.result));

  if (!hasToolData) {
    return { isSuspicious: false, nullPaths: [] };
  }

  // =============================================================
  // CHECK 1: Filtered to Empty Detection
  // Tool returned array with data, but final result has empty array
  // This now uses a smarter approach: find ANY empty array in result
  // and check if tool had ANY non-empty array (field names may differ)
  //
  // IMPORTANT: This is designed to work across ALL MCP tools, not just
  // specific ones. We use a threshold to avoid false positives:
  // - Only trigger if tool returned SIGNIFICANT data (10+ items)
  // - This prevents triggering when 3 items → 0 is legitimate filtering
  // =============================================================
  const FILTERED_TO_EMPTY_THRESHOLD = 10; // Only trigger if tool had 10+ items

  if (executionData && typeof executionData === "object" && toolCallHistory) {
    const data = executionData as Record<string, unknown>;

    // Fields to ignore when checking for empty arrays (metadata, not primary data)
    const ignoredFields = new Set([
      "metadata",
      "meta",
      "summary",
      "error",
      "errors",
      "warnings",
      "debug",
      "pagination",
    ]);

    // Find all empty arrays in the final result (excluding metadata fields)
    const emptyArrayFields: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (
        Array.isArray(value) &&
        value.length === 0 &&
        !ignoredFields.has(key.toLowerCase())
      ) {
        emptyArrayFields.push(key);
      }
    }

    // If we have empty arrays in the result, check if tool returned significant data
    if (emptyArrayFields.length > 0) {
      // Find any non-empty array in tool results
      const toolArrayData = findAnyToolArrayData(toolCallHistory);

      // Only trigger if tool returned SIGNIFICANT data (above threshold)
      // This prevents false positives when small datasets are legitimately filtered
      if (toolArrayData && toolArrayData.count >= FILTERED_TO_EMPTY_THRESHOLD) {
        console.log("[agentic-execution] Detected filtered-to-empty pattern", {
          emptyFields: emptyArrayFields,
          toolField: toolArrayData.fieldName,
          toolDataCount: toolArrayData.count,
          toolName: toolArrayData.toolName,
          threshold: FILTERED_TO_EMPTY_THRESHOLD,
        });
        return {
          isSuspicious: true,
          reason: `Tool "${toolArrayData.toolName}" returned ${toolArrayData.count} ${toolArrayData.fieldName}, but the final result has empty arrays (${emptyArrayFields.join(", ")}). The code's filter criteria may be too restrictive.`,
          nullPaths: emptyArrayFields,
          filteredToEmpty: {
            fieldName: toolArrayData.fieldName,
            toolDataCount: toolArrayData.count,
            toolName: toolArrayData.toolName,
          },
        };
      }
    }
  }

  // =============================================================
  // CHECK 2: Null Values Detection (existing logic)
  // =============================================================
  // Recursively find null values in the execution result
  function findNullPaths(obj: unknown, path: string): void {
    if (obj === null || obj === undefined) {
      nullPaths.push(path);
      return;
    }

    if (typeof obj === "object" && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>
      )) {
        // Skip metadata fields that are commonly null
        if (
          ["timestamp", "fetchedAt", "updatedAt", "createdAt"].includes(key)
        ) {
          continue;
        }
        findNullPaths(value, path ? `${path}.${key}` : key);
      }
    }
  }

  findNullPaths(executionData, "");

  // Suspicious if there are null values in the final result
  // but the raw tool data had values
  if (nullPaths.length > 0) {
    return {
      isSuspicious: true,
      reason: `Execution returned null values at: ${nullPaths.join(", ")} - but tool calls returned data. This suggests a data processing bug.`,
      nullPaths,
    };
  }

  return { isSuspicious: false, nullPaths: [] };
}

/**
 * Build tool schema info from allowed tools map
 * Used to provide context for error correction and reflection
 */
export function buildToolSchemaInfo(
  allowedTools: Map<string, AllowedToolContext>
): ToolSchemaInfo[] {
  return Array.from(allowedTools.entries()).map(([toolId, ctx]) => {
    const toolSchema = ctx.tool.toolSchema as Record<string, unknown> | null;
    const mcpTools = toolSchema?.tools as
      | Array<{
          name: string;
          description?: string;
          inputSchema?: unknown;
          outputSchema?: unknown;
        }>
      | undefined;
    return {
      toolId,
      name: ctx.tool.name,
      mcpTools: mcpTools?.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      })),
    };
  });
}

/**
 * Build tool schemas string for reflection prompt
 */
function buildReflectionToolSchemas(
  allowedTools: Map<string, AllowedToolContext>
): string {
  return Array.from(allowedTools.entries())
    .map(([, ctx]) => {
      const toolSchema = ctx.tool.toolSchema as Record<string, unknown> | null;
      const mcpTools = toolSchema?.tools as
        | Array<{
            name: string;
            description?: string;
            inputSchema?: unknown;
            outputSchema?: unknown;
          }>
        | undefined;
      if (!mcpTools) {
        return "";
      }
      return mcpTools
        .map(
          (t) => `### ${ctx.tool.name} → ${t.name}
**Input Schema (valid parameters):** \`\`\`json
${JSON.stringify(t.inputSchema, null, 2) || "{}"}
\`\`\`
**Output Schema (response structure):** \`\`\`json
${JSON.stringify(t.outputSchema, null, 2) || "unknown"}
\`\`\``
        )
        .join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Format execution data for display
 */
function formatExecutionData(data: unknown, maxLength = 1200) {
  try {
    const json = JSON.stringify(data, null, 2) ?? "null";
    if (json.length <= maxLength) {
      return json;
    }
    return `${json.slice(0, maxLength)}…`;
  } catch {
    return String(data);
  }
}

/**
 * Extract code block from AI response
 */
const CODE_BLOCK_REGEX = /```(?:\w+)?\s*([\s\S]*?)```/i;

function extractCodeBlock(text: string) {
  const match = CODE_BLOCK_REGEX.exec(text);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

/**
 * Execute code with self-healing retry loop
 *
 * This function implements the agentic execution pattern:
 * 1. Execute the code
 * 2. If it crashes (runtime error), generate a fix and retry
 * 3. If it succeeds but has suspicious nulls, reflect and retry
 * 4. Continue until success or max retries
 *
 * @param config - Execution configuration
 * @returns Execution result with final code and attempt count
 */
export async function executeWithSelfHealing(
  config: AgenticExecutionConfig
): Promise<AgenticExecutionResult> {
  const {
    initialCode,
    allowedModules,
    allowedTools,
    dataStream,
    getLanguageModel,
    session,
    chatId,
    isAutoMode,
  } = config;

  let currentCode = initialCode;
  let toolCallHistory: ToolCallRecord[] = [];
  let finalExecution: ExecutionResult | null = null;
  let finalAttemptCount = 0;

  for (let attempt = 0; attempt <= MAX_REFLECTION_RETRIES; attempt++) {
    finalAttemptCount = attempt;
    const isRetry = attempt > 0;

    if (isRetry) {
      console.log("[agentic-execution] Self-Heal: retry attempt", {
        chatId,
        attempt,
        reason: "previous attempt failed or had suspicious results",
      });

      dataStream.write({
        type: "data-toolStatus",
        data: { status: "reflecting" },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Create runtime with tool call history
    // On retries, pass existing history so the AI has context
    const executionRuntime = {
      session,
      dataStream,
      requestId: chatId,
      chatId,
      isAutoMode,
      allowedTools,
      toolCallHistory: isRetry ? toolCallHistory : [],
    };

    // Execute the code
    const execution = await executeSkillCode({
      code: currentCode,
      allowedModules,
      runtime: executionRuntime,
    });

    // Capture tool call history from this execution
    if (executionRuntime.toolCallHistory.length > 0) {
      toolCallHistory = executionRuntime.toolCallHistory;
    }

    finalExecution = execution;

    // =============================================================
    // SELF-HEALING: Handle Runtime Errors (code crashed)
    // =============================================================
    if (!execution.ok && attempt < MAX_REFLECTION_RETRIES) {
      console.log(
        "[agentic-execution] Self-Heal: execution crashed, attempting fix",
        {
          chatId,
          attempt,
          error: execution.error,
        }
      );

      dataStream.write({
        type: "data-toolStatus",
        data: { status: "fixing" },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Build tool schema info for error context
      const toolSchemaInfo = buildToolSchemaInfo(allowedTools);

      // Generate a fix for the runtime error
      const errorFixResult = await generateText({
        model: getLanguageModel(),
        system: errorCorrectionPrompt({
          code: currentCode,
          error: execution.error,
          logs: execution.logs,
          toolCallHistory:
            toolCallHistory.length > 0 ? toolCallHistory : undefined,
          toolSchemas: toolSchemaInfo,
        }),
        messages: [
          {
            role: "user",
            content:
              "The previous code crashed. Fix the error and output the corrected code block.",
          },
        ],
      });

      const fixedCode = extractCodeBlock(errorFixResult.text);

      if (fixedCode && fixedCode !== currentCode) {
        console.log(
          "[agentic-execution] Self-Heal: AI provided fix for crash",
          {
            chatId,
            attempt,
            errorFixed: execution.error.slice(0, 100),
          }
        );
        currentCode = fixedCode;
        continue; // Retry with fixed code
      }

      console.log(
        "[agentic-execution] Self-Heal: could not generate fix, giving up",
        {
          chatId,
        }
      );
      // Fall through to break - can't fix this error
    }

    // =============================================================
    // REFLECTION: Handle Suspicious Results (code ran but bad data)
    // =============================================================
    if (
      execution.ok &&
      attempt < MAX_REFLECTION_RETRIES &&
      toolCallHistory.length > 0
    ) {
      const suspiciousCheck = detectSuspiciousResults(
        execution.data,
        toolCallHistory
      );

      if (suspiciousCheck.isSuspicious) {
        console.log(
          "[agentic-execution] Reflection: suspicious results detected",
          {
            chatId,
            attempt,
            reason: suspiciousCheck.reason,
            nullPaths: suspiciousCheck.nullPaths,
            filteredToEmpty: suspiciousCheck.filteredToEmpty,
          }
        );

        // Build tool schema section for reflection context
        const reflectionToolSchemas = buildReflectionToolSchemas(allowedTools);

        // Build reflection prompt - customize for filtered-to-empty case
        let reflectionSystemPrompt: string;

        if (suspiciousCheck.filteredToEmpty) {
          // Special prompt for when post-processing filtered everything out
          const { fieldName, toolDataCount, toolName } =
            suspiciousCheck.filteredToEmpty;
          reflectionSystemPrompt = `${reflectionPrompt}

## CRITICAL ISSUE: Over-Filtering Detected
The tool "${toolName}" returned ${toolDataCount} ${fieldName}, but your code filtered them ALL out.
This means the user's criteria don't match what's available in the market right now.

## What You Should Do Instead
1. DO NOT return an empty array - that's unhelpful
2. INSTEAD: Return the CLOSEST matches to what the user wanted
3. Sort by proximity to user's criteria and return top N results
4. Include a "note" field explaining these are the closest available matches

## Your Original Code (with over-aggressive filtering)
\`\`\`ts
${currentCode}
\`\`\`

## Your Result (empty - BAD)
\`\`\`json
${formatExecutionData(execution.data)}
\`\`\`

## Raw Tool Output (${toolDataCount} items available!)
${formatToolCallHistory(toolCallHistory)}

## Tool Schemas
${reflectionToolSchemas || "(No schemas available)"}

Now write CORRECTED code that:
1. Removes the hard filter that eliminated all results
2. Instead SORTS by proximity to user's criteria  
3. Returns top 5-10 closest matches
4. Adds a "note" field like: "No exact matches found. Showing closest available options."

Example fix pattern:
\`\`\`ts
// BAD: Hard filter that might return empty
const filtered = opportunities.filter(o => o.price >= 0.50 && o.price <= 0.70);
return { opportunities: filtered }; // Could be empty!

// GOOD: Sort by closeness, always return something useful
const targetMin = 0.50;
const targetMax = 0.70;
const sorted = opportunities.sort((a, b) => {
  const aInRange = a.price >= targetMin && a.price <= targetMax;
  const bInRange = b.price >= targetMin && b.price <= targetMax;
  if (aInRange && !bInRange) return -1;
  if (!aInRange && bInRange) return 1;
  // Sort by distance from target range
  const aDist = Math.min(Math.abs(a.price - targetMin), Math.abs(a.price - targetMax));
  const bDist = Math.min(Math.abs(b.price - targetMin), Math.abs(b.price - targetMax));
  return aDist - bDist;
});
return { 
  opportunities: sorted.slice(0, 5),
  note: sorted.length > 0 && sorted[0].price < targetMin 
    ? "No bets in requested range. Showing closest alternatives."
    : undefined
};
\`\`\``;
        } else {
          // Standard reflection prompt for null values
          reflectionSystemPrompt = `${reflectionPrompt}

## Your Original Code
\`\`\`ts
${currentCode}
\`\`\`

## Your Result (with suspicious nulls)
\`\`\`json
${formatExecutionData(execution.data)}
\`\`\`

## Null Values Found At
${suspiciousCheck.nullPaths.map((p) => `- \`${p}\``).join("\n")}

## Raw Tool Outputs (what the APIs actually returned)
${formatToolCallHistory(toolCallHistory)}

## Tool Schemas (REFERENCE - use correct params and access correct properties!)
${reflectionToolSchemas || "(No schemas available)"}

Now write ONLY the corrected code block. Fix the bug that caused the null values.
HINT: Check that you're accessing the correct property names from the Output Schema above.`;
        }

        // Ask AI to reflect and fix
        const reflectionResult = await generateText({
          model: getLanguageModel(),
          system: reflectionSystemPrompt,
          messages: [
            {
              role: "user",
              content: suspiciousCheck.filteredToEmpty
                ? "Your filtering was too aggressive. Rewrite the code to return the closest matches instead of an empty array."
                : "Fix the code to correctly process the tool outputs. Output only the corrected TypeScript code block.",
            },
          ],
        });

        const fixedCode = extractCodeBlock(reflectionResult.text);

        if (fixedCode && fixedCode !== currentCode) {
          console.log(
            "[agentic-execution] Reflection: AI provided fixed code",
            {
              chatId,
              attempt,
              wasFilteredToEmpty: Boolean(suspiciousCheck.filteredToEmpty),
              codePreview: fixedCode.slice(0, 200),
            }
          );
          currentCode = fixedCode;
          // Continue to next iteration with fixed code
          continue;
        }

        console.log(
          "[agentic-execution] Reflection: no fix generated, using original result",
          {
            chatId,
            attempt,
          }
        );
      }
    }

    // No suspicious results or max retries reached - exit loop
    break;
  }

  // finalExecution is guaranteed to be set because the loop always runs at least once
  // (attempt starts at 0 and MAX_REFLECTION_RETRIES >= 0)
  // But we add a safety check for TypeScript
  if (!finalExecution) {
    throw new Error("Unexpected: no execution result after retry loop");
  }

  return {
    execution: finalExecution,
    finalCode: currentCode,
    attemptCount: finalAttemptCount,
    toolCallHistory,
  };
}

/**
 * Check if final result was filtered to empty despite tool having data
 * Returns info about the filtering if detected
 * Uses smarter detection: finds ANY empty array in result and ANY non-empty array in tool data
 */
function detectFilteredToEmpty(
  executionData: unknown,
  toolCallHistory: ToolCallRecord[]
): {
  wasFiltered: boolean;
  fieldName?: string;
  toolDataCount?: number;
  toolName?: string;
  sampleData?: unknown[];
  emptyFields?: string[];
} {
  // Use same threshold as detectSuspiciousResults for consistency
  const FILTERED_TO_EMPTY_THRESHOLD = 10;

  if (
    !executionData ||
    typeof executionData !== "object" ||
    toolCallHistory.length === 0
  ) {
    return { wasFiltered: false };
  }

  const data = executionData as Record<string, unknown>;

  // Fields to ignore when checking for empty arrays (metadata, not primary data)
  const ignoredFields = new Set([
    "metadata",
    "meta",
    "summary",
    "error",
    "errors",
    "warnings",
    "debug",
    "pagination",
  ]);

  // Find all empty arrays in the final result (excluding metadata fields)
  const emptyArrayFields: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (
      Array.isArray(value) &&
      value.length === 0 &&
      !ignoredFields.has(key.toLowerCase())
    ) {
      emptyArrayFields.push(key);
    }
  }

  // If no empty arrays in result, nothing was filtered to empty
  if (emptyArrayFields.length === 0) {
    return { wasFiltered: false };
  }

  // Check if tool returned significant data (above threshold)
  const toolData = findAnyToolArrayData(toolCallHistory);
  if (toolData && toolData.count >= FILTERED_TO_EMPTY_THRESHOLD) {
    // Find sample data from the tool result
    let sampleData: unknown[] = [];
    for (const call of toolCallHistory) {
      if (call.result && typeof call.result === "object") {
        const result = call.result as Record<string, unknown>;
        const fieldValue = result[toolData.fieldName];
        if (Array.isArray(fieldValue)) {
          sampleData = fieldValue.slice(0, 3) as unknown[];
          break;
        }
      }
    }

    return {
      wasFiltered: true,
      fieldName: toolData.fieldName,
      toolDataCount: toolData.count,
      toolName: toolData.toolName,
      sampleData,
      emptyFields: emptyArrayFields,
    };
  }

  return { wasFiltered: false };
}

/**
 * Options for building mediator text
 */
type MediatorTextOptions = {
  execution: ExecutionResult;
  attemptCount: number;
  allowedModules: AllowedModule[];
  hasData: boolean;
  toolCallHistory?: ToolCallRecord[];
};

/**
 * Build a mediator message summarizing the execution result
 * Used to inform the final AI response about what happened
 */
export function buildMediatorText(options: MediatorTextOptions): string {
  const { execution, attemptCount, allowedModules, hasData, toolCallHistory } =
    options;
  // Build retry info for transparency
  const retryInfo =
    attemptCount > 0
      ? `\nRETRIES: ${attemptCount} (self-healed from ${attemptCount === 1 ? "an error" : "errors"})`
      : "";

  // For failed executions, show last few logs (most relevant)
  const truncatedFailureLogs =
    execution.logs.length > 5
      ? `...(${execution.logs.length - 5} earlier logs)\n${execution.logs.slice(-5).join("\n")}`
      : execution.logs.join("\n");

  if (execution.ok) {
    // Check if data was filtered to empty despite tool returning data
    const filterCheck = toolCallHistory
      ? detectFilteredToEmpty(execution.data, toolCallHistory)
      : { wasFiltered: false };

    if (filterCheck.wasFiltered) {
      // Special case: tool had data but post-processing filtered it all out
      return `Tool execution succeeded but filtering returned empty results.${retryInfo}
HAS_DATA: false (filtered to empty)
STATUS: success
FILTERED_TO_EMPTY: true
FILTER_INFO: Tool "${filterCheck.toolName}" returned ${filterCheck.toolDataCount} ${filterCheck.fieldName}, but the code filtered them all out.
Modules used: ${allowedModules.join(", ")}

IMPORTANT: The tool DID return data. The user's criteria may not match what's available.
Consider presenting what IS available instead of an empty result.

Raw tool data sample (first 3 items):
${formatExecutionData(filterCheck.sampleData)}

Final (empty) result:
${formatExecutionData(execution.data)}`;
    }

    return `Tool execution succeeded.${retryInfo}
HAS_DATA: ${hasData}
STATUS: success
Modules used: ${allowedModules.join(", ")}
Result JSON:
${formatExecutionData(execution.data)}`;
  }

  return `Tool execution failed after ${attemptCount > 0 ? `${attemptCount + 1} attempts (${attemptCount} auto-fix retries)` : "1 attempt"}.
ERROR: ${execution.error}
HAS_DATA: false
STATUS: failed
RECENT_LOGS:
${truncatedFailureLogs || "(no logs)"}`;
}
