/**
 * Context Requirements Detection
 *
 * Detects what user context (wallet/portfolio data) is required for MCP tools.
 *
 * HOW IT WORKS:
 * Tools that need user portfolio data MUST declare it explicitly:
 *
 *   {
 *     name: "analyze_my_positions",
 *     requirements: { context: ["hyperliquid"] },
 *     inputSchema: { ... }
 *   }
 *
 * WHY EXPLICIT ONLY?
 * - If a tool needs context injection, the developer must read the docs
 * - The docs explain how to receive injected context data
 * - The docs tell them to add `requirements.context`
 * - Therefore: no tool that needs context will be missing the declaration
 *
 * This enables the "in-chat wallet linking prompt" flow:
 * 1. User asks about their portfolio
 * 2. AI selects tools that need portfolio context
 * 3. System checks `requirements.context` on selected tools
 * 4. If user has no linked wallets → show linking prompt
 * 5. After linking → retry with portfolio data
 */

import type { ContextRequirementType } from "@/lib/types";

// Re-export type for convenience
export type { ContextRequirementType as ContextRequirement } from "@/lib/types";

/**
 * MCP tool info with requirements (from marketplace search results)
 */
type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  requirements?: { context?: ContextRequirementType[] };
};

/**
 * Tool metadata used for context detection.
 * Matches the shape of enrichedSelectedTools from the chat route.
 */
type ToolForDetection = {
  name?: string;
  description?: string;
  /** MCP tools contain the actual inputSchema for each method */
  mcpTools?: McpToolInfo[];
  /** The specific MCP method the AI selected (if specified) */
  mcpMethod?: string;
};

/**
 * Detect what context a tool requires by checking explicit `requirements.context`.
 *
 * @param tool - Tool metadata including mcpTools with their requirements
 * @returns Array of context requirements (empty if none declared)
 *
 * @example
 * ```ts
 * const reqs = detectContextRequirements({
 *   name: "Hyperliquid",
 *   mcpTools: [{
 *     name: "analyze_my_positions",
 *     requirements: { context: ["hyperliquid"] }
 *   }]
 * });
 * // Returns: ["hyperliquid"]
 * ```
 */
export function detectContextRequirements(
  tool: ToolForDetection
): ContextRequirementType[] {
  const requirements = new Set<ContextRequirementType>();
  const mcpTools = tool.mcpTools ?? [];

  // Determine which methods to check
  const methodsToCheck = tool.mcpMethod
    ? mcpTools.filter((t) => t.name === tool.mcpMethod)
    : mcpTools;

  for (const method of methodsToCheck) {
    if (method.requirements?.context) {
      for (const req of method.requirements.context) {
        requirements.add(req);
      }
    }
  }

  return [...requirements];
}

/**
 * Detect context requirements across multiple tools.
 * Deduplicates requirements and returns a unique set.
 *
 * @param tools - Array of tool metadata
 * @returns Set of unique context requirements
 */
export function detectContextRequirementsForTools(
  tools: ToolForDetection[]
): Set<ContextRequirementType> {
  const allRequirements = new Set<ContextRequirementType>();

  for (const tool of tools) {
    const reqs = detectContextRequirements(tool);
    for (const req of reqs) {
      allRequirements.add(req);
    }
  }

  return allRequirements;
}
