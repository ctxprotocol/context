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
 * MCP tools that need user portfolio data MUST declare it using the
 * `_meta.contextRequirements` field. This is the MCP spec-compliant way
 * to add custom metadata to tools.
 *
 * @example
 * ```typescript
 * // In your MCP server tool definition:
 * {
 *   name: "analyze_my_positions",
 *   _meta: {
 *     contextRequirements: ["hyperliquid"]  // ← REQUIRED for portfolio tools
 *   },
 *   inputSchema: {
 *     type: "object",
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
 * WHY _meta?
 *   - `_meta` is part of the MCP specification for arbitrary tool metadata
 *   - The MCP SDK preserves `_meta` through transport
 *   - Custom inputSchema fields (like x-context-requirements) get stripped
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

// =============================================================================
// PROXY WALLET DISCOVERY
// =============================================================================

export {
  discoverProxyWallets,
  getWalletAddressesForProtocol,
  hasPolymarketProxy,
  type DiscoveredProxy,
  type ProxyDiscoveryResult,
} from "./proxy-discovery";
