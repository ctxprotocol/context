/**
 * Context Requirements Detection
 *
 * Detects what user context (wallet/portfolio data) is required for MCP tools.
 *
 * HOW IT WORKS:
 * Tools that need user portfolio data declare it in their inputSchema:
 *
 *   {
 *     name: "analyze_my_positions",
 *     inputSchema: {
 *       type: "object",
 *       "x-context-requirements": ["hyperliquid"],  // ← Read from here
 *       properties: { portfolio: { type: "object" } }
 *     }
 *   }
 *
 * WHY IN inputSchema?
 * - MCP protocol only transmits: name, description, inputSchema, outputSchema
 * - Custom fields like `requirements` get stripped by MCP SDK
 * - JSON Schema allows custom "x-" extension properties
 * - inputSchema is preserved end-to-end through MCP transport
 */

import type { ContextRequirementType } from "@/lib/types";

// Re-export type for convenience
export type { ContextRequirementType as ContextRequirement } from "@/lib/types";

/**
 * MCP tool info with schema (from marketplace search results)
 */
type McpToolInfo = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
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
 * Extract context requirements from a tool's inputSchema.
 * Looks for the "x-context-requirements" JSON Schema extension.
 */
function getContextRequirementsFromSchema(
  inputSchema: Record<string, unknown> | undefined
): ContextRequirementType[] {
  if (!inputSchema) {
    return [];
  }

  // Check for x-context-requirements extension
  const requirements = inputSchema["x-context-requirements"];

  if (Array.isArray(requirements)) {
    return requirements.filter((r): r is ContextRequirementType => {
      return r === "polymarket" || r === "hyperliquid" || r === "wallet";
    });
  }

  return [];
}

/**
 * Detect what context a tool requires by checking inputSchema["x-context-requirements"].
 *
 * @param tool - Tool metadata including mcpTools with their inputSchemas
 * @returns Array of context requirements (empty if none declared)
 *
 * @example
 * ```ts
 * const reqs = detectContextRequirements({
 *   name: "Hyperliquid",
 *   mcpTools: [{
 *     name: "analyze_my_positions",
 *     inputSchema: {
 *       type: "object",
 *       "x-context-requirements": ["hyperliquid"]
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
    const schemaRequirements = getContextRequirementsFromSchema(
      method.inputSchema
    );
    for (const req of schemaRequirements) {
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
