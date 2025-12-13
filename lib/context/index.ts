/**
 * Context Types for Portfolio Injection
 *
 * Re-exports types from @ctxprotocol/sdk to ensure type consistency
 * between the client app and MCP servers.
 */

// =============================================================================
// RE-EXPORT FROM SDK (Single Source of Truth)
// =============================================================================

export type {
  // Wallet types
  WalletContext,
  ERC20Context,
  ERC20TokenBalance,
  // Polymarket types
  PolymarketContext,
  PolymarketPosition,
  PolymarketOrder,
  // Hyperliquid types
  HyperliquidContext,
  HyperliquidPerpPosition,
  HyperliquidOrder,
  HyperliquidSpotBalance,
  HyperliquidAccountSummary,
  // Composite type
  UserContext,
} from "@ctxprotocol/sdk";

