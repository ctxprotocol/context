/**
 * Context Requirements Detection
 *
 * Detects what user context (wallet/portfolio data) is required for MCP tools.
 *
 * HOW IT WORKS:
 * Tools that need user portfolio data declare it in their _meta field:
 *
 *   {
 *     name: "analyze_my_positions",
 *     _meta: {
 *       contextRequirements: ["hyperliquid"]  // ← Read from here
 *     },
 *     inputSchema: { ... }
 *   }
 *
 * WHY _meta?
 * - `_meta` is part of the MCP specification for arbitrary tool metadata
 * - The MCP SDK preserves `_meta` through transport (unlike custom inputSchema fields)
 * - JSON Schema extension properties like `x-*` get stripped by the SDK
 * - `_meta` is the spec-compliant way to add custom tool metadata
 */

import type { ContextRequirementType } from "@/lib/types";

// Re-export type for convenience
export type { ContextRequirementType as ContextRequirement } from "@/lib/types";

/**
 * MCP tool info with _meta (from marketplace search results)
 */
type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  _meta?: {
    contextRequirements?: string[];
    [key: string]: unknown;
  };
};

/**
 * Tool metadata used for context detection.
 * Matches the shape of enrichedSelectedTools from the chat route.
 */
type ToolForDetection = {
  name?: string;
  description?: string;
  /** MCP tools contain the _meta field for each method */
  mcpTools?: McpToolInfo[];
  /** The specific MCP method the AI selected (if specified) */
  mcpMethod?: string;
};

/**
 * Extract context requirements from a tool's _meta field.
 * Looks for the "contextRequirements" array in _meta.
 */
function getContextRequirementsFromMeta(
  meta: McpToolInfo["_meta"]
): ContextRequirementType[] {
  if (!meta?.contextRequirements) {
    return [];
  }

  const requirements = meta.contextRequirements;

  if (Array.isArray(requirements)) {
    return requirements.filter((r): r is ContextRequirementType => {
      return r === "polymarket" || r === "hyperliquid" || r === "wallet";
    });
  }

  return [];
}

/**
 * Detect what context a tool requires by checking _meta.contextRequirements.
 *
 * @param tool - Tool metadata including mcpTools with their _meta
 * @returns Array of context requirements (empty if none declared)
 *
 * @example
 * ```ts
 * const reqs = detectContextRequirements({
 *   name: "Hyperliquid",
 *   mcpTools: [{
 *     name: "analyze_my_positions",
 *     _meta: {
 *       contextRequirements: ["hyperliquid"]
 *     }
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
    const metaRequirements = getContextRequirementsFromMeta(method._meta);
    for (const req of metaRequirements) {
      requirements.add(req);
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
