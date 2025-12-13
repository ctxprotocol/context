/**
 * Context Types for Portfolio Injection
 *
 * These types define the structure of user context that gets injected into MCP tools.
 * Eventually these will live in @ctxprotocol/sdk, but for now they're defined here.
 */

// =============================================================================
// WALLET CONTEXT
// =============================================================================

/**
 * Base wallet context - address and chain info
 */
export interface WalletContext {
  /** Wallet address (checksummed) */
  address: string;
  /** Chain ID (137 for Polygon, 1 for Ethereum, etc.) */
  chainId: number;
  /** Native token balance in wei (string for precision) */
  nativeBalance?: string;
}

/**
 * ERC20 token holdings
 */
export interface ERC20TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  /** Balance in smallest unit (string for precision) */
  balance: string;
}

export interface ERC20Context {
  tokens: ERC20TokenBalance[];
}

// =============================================================================
// POLYMARKET CONTEXT
// =============================================================================

/**
 * A single Polymarket position
 */
export interface PolymarketPosition {
  /** The market's condition ID */
  conditionId: string;
  /** The specific outcome token ID */
  tokenId: string;
  /** Which outcome this position is for */
  outcome: "YES" | "NO";
  /** Number of shares held */
  shares: number;
  /** Average entry price (0-1 scale) */
  avgEntryPrice: number;
  /** Market question/title for display */
  marketTitle?: string;
}

/**
 * An open order on Polymarket
 */
export interface PolymarketOrder {
  orderId: string;
  conditionId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  /** Limit price (0-1 scale) */
  price: number;
  /** Order size in shares */
  size: number;
  /** Amount already filled */
  filled: number;
}

/**
 * Complete Polymarket portfolio context
 * This is what gets passed to MCP tools
 */
export interface PolymarketContext {
  /** The wallet address(es) this context is for */
  walletAddress: string;
  /** All open positions */
  positions: PolymarketPosition[];
  /** All open orders */
  openOrders: PolymarketOrder[];
  /** Total portfolio value in USD (sum of position values) */
  totalValue?: number;
  /** When this context was fetched */
  fetchedAt: string;
}

// =============================================================================
// HYPERLIQUID CONTEXT
// =============================================================================

/**
 * Hyperliquid Perpetual Position
 */
export interface HyperliquidPerpPosition {
  /** Asset symbol (e.g., "ETH", "BTC") */
  coin: string;
  /** Position size (positive = long, negative = short) */
  size: number;
  /** Entry price */
  entryPrice: number;
  /** Current mark price */
  markPrice?: number;
  /** Unrealized PnL in USD */
  unrealizedPnl: number;
  /** Liquidation price */
  liquidationPrice: number;
  /** Position value in USD */
  positionValue: number;
  /** Leverage info */
  leverage: {
    type: "cross" | "isolated";
    value: number;
  };
  /** Margin used for this position */
  marginUsed: number;
  /** Return on equity percentage */
  returnOnEquity: number;
  /** Cumulative funding paid/received */
  cumFunding: {
    allTime: number;
    sinceOpen: number;
  };
}

/**
 * Hyperliquid Open Order
 */
export interface HyperliquidOrder {
  /** Order ID */
  oid: number;
  /** Asset symbol */
  coin: string;
  /** Order side: "B" = Buy, "A" = Ask/Sell */
  side: "B" | "A";
  /** Limit price */
  limitPrice: number;
  /** Order size */
  size: number;
  /** Original order size */
  originalSize: number;
  /** Order type */
  orderType: "Limit" | "Market" | "Stop" | "TakeProfit";
  /** Is reduce-only order */
  reduceOnly: boolean;
  /** Is trigger order */
  isTrigger: boolean;
  /** Trigger price (if trigger order) */
  triggerPrice?: number;
  /** Order timestamp */
  timestamp: number;
}

/**
 * Hyperliquid Spot Balance
 */
export interface HyperliquidSpotBalance {
  /** Token symbol */
  token: string;
  /** Token balance */
  balance: number;
  /** USD value */
  usdValue?: number;
}

/**
 * Hyperliquid Account Summary
 */
export interface HyperliquidAccountSummary {
  /** Total account value in USD */
  accountValue: number;
  /** Total margin used */
  totalMarginUsed: number;
  /** Total notional position value */
  totalNotionalPosition: number;
  /** Withdrawable amount */
  withdrawable: number;
  /** Cross margin summary */
  crossMargin: {
    accountValue: number;
    totalMarginUsed: number;
  };
}

/**
 * Complete Hyperliquid portfolio context
 */
export interface HyperliquidContext {
  /** The wallet address this context is for */
  walletAddress: string;
  /** Perpetual positions */
  perpPositions: HyperliquidPerpPosition[];
  /** Open orders */
  openOrders: HyperliquidOrder[];
  /** Spot balances */
  spotBalances: HyperliquidSpotBalance[];
  /** Account summary */
  accountSummary: HyperliquidAccountSummary;
  /** When this context was fetched */
  fetchedAt: string;
}

// =============================================================================
// COMPOSITE USER CONTEXT
// =============================================================================

/**
 * Combined user context for tools that need multiple data sources
 */
export interface UserContext {
  wallet?: WalletContext;
  erc20?: ERC20Context;
  polymarket?: PolymarketContext;
  hyperliquid?: HyperliquidContext;
  // Future protocols:
  // aave?: AaveContext;
}

