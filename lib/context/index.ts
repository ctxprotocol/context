/**
 * Context Types for Portfolio Injection
 *
 * Re-exports types from @ctxprotocol/sdk to ensure type consistency
 * between the client app and MCP servers.
 *
 * =============================================================================
 * DECLARING CONTEXT REQUIREMENTS
 * =============================================================================
 *
 * If your MCP tool needs user portfolio data, you MUST declare it explicitly:
 *
 * @example
 * ```typescript
 * {
 *   name: "analyze_my_positions",
 *   requirements: { context: ["hyperliquid"] },  // REQUIRED
 *   inputSchema: {
 *     type: "object",
 *     properties: {
 *       portfolio: { type: "object" }  // Receives HyperliquidContext
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
 * See ToolRequirements in lib/types.ts for the full type definition.
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
