/**
 * Context Types for Portfolio Injection
 *
 * Re-exports types from @ctxprotocol/sdk to ensure type consistency
 * between the client app and MCP servers.
 *
 * =============================================================================
 * DECLARING CONTEXT REQUIREMENTS IN MCP TOOLS
 * =============================================================================
 *
 * Since the MCP protocol only transmits standard fields (name, description,
 * inputSchema, outputSchema), context requirements must be embedded in the
 * inputSchema using the "x-context-requirements" JSON Schema extension.
 *
 * @example
 * ```typescript
 * // In your MCP server tool definition:
 * {
 *   name: "analyze_my_positions",
 *   inputSchema: {
 *     type: "object",
 *     "x-context-requirements": ["hyperliquid"],  // ← REQUIRED for portfolio tools
 *     properties: {
 *       portfolio: { type: "object" }
 *     },
 *     required: ["portfolio"]
 *   }
 * }
 * ```
 *
 * Available context types:
 *   - "hyperliquid": User's Hyperliquid perp/spot positions
 *   - "polymarket": User's Polymarket prediction market positions
 *   - "wallet": Generic EVM wallet context (address, balances)
 *
 * =============================================================================
 */

// =============================================================================
// RE-EXPORT FROM SDK (Single Source of Truth)
// =============================================================================

export type {
  ERC20Context,
  ERC20TokenBalance,
  HyperliquidAccountSummary,
  // Hyperliquid types
  HyperliquidContext,
  HyperliquidOrder,
  HyperliquidPerpPosition,
  HyperliquidSpotBalance,
  // Polymarket types
  PolymarketContext,
  PolymarketOrder,
  PolymarketPosition,
  // Composite type
  UserContext,
  // Wallet types
  WalletContext,
} from "@ctxprotocol/sdk";

// =============================================================================
// DETECTION UTILITIES
// =============================================================================

export {
  type ContextRequirement,
  detectContextRequirements,
  detectContextRequirementsForTools,
} from "./detection";
