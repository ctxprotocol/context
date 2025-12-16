/**
 * Polymarket Context Builder
 *
 * Fetches portfolio data from Polymarket's public APIs.
 * No authentication required - blockchain data is public.
 *
 * APIs:
 * - Data API (data-api.polymarket.com): User positions, trades, analytics
 * - CLOB API (clob.polymarket.com): Trading operations, orderbooks, prices
 * - Gamma API (gamma-api.polymarket.com): Market discovery, events, search
 *
 * Chain: Polygon (Chain ID 137)
 */

import type {
  PolymarketContext,
  PolymarketPosition,
  PolymarketOrder,
} from "@ctxprotocol/sdk";

// Data API for user positions and analytics
const DATA_API_URL = "https://data-api.polymarket.com";
// CLOB API for trading operations (orders, prices)
const CLOB_API_URL = "https://clob.polymarket.com";

// Type for Data API position response
// See: https://data-api.polymarket.com/positions
interface RawPosition {
  // Position identifiers
  proxyWallet?: string;
  asset?: string; // token_id
  conditionId?: string;
  // Position data
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  cashPnl?: number;
  percentPnl?: number;
  totalBought?: number;
  realizedPnl?: number;
  curPrice?: number;
  // Market info
  title?: string;
  outcome?: string; // "Yes" or "No"
  outcomeIndex?: number; // 0 for Yes, 1 for No
  endDate?: string;
  // Status flags
  redeemable?: boolean;
  mergeable?: boolean;
}

interface RawOrder {
  id?: string;
  order_id?: string;
  market?: string;
  condition_id?: string;
  side?: string;
  outcome?: number;
  price?: string | number;
  size?: string | number;
  filled?: string | number;
}

/**
 * Fetch Polymarket positions for a wallet address
 * Uses the Data API which handles both EOA and proxy wallet lookups
 * See: https://data-api.polymarket.com/positions
 */
export async function fetchPolymarketPositions(
  walletAddress: string
): Promise<PolymarketPosition[]> {
  // Data API endpoint for user positions
  // The API accepts EOA addresses and maps them to proxy wallets internally
  const url = `${DATA_API_URL}/positions?user=${walletAddress.toLowerCase()}&sizeThreshold=0.01`;
  console.log("[polymarket-context] Fetching positions from Data API:", {
    url,
    walletAddress: walletAddress.toLowerCase(),
  });

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      // Cache for 30 seconds to avoid hammering the API
      next: { revalidate: 30 },
    });

    console.log("[polymarket-context] Data API response:", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      // Try to get the response body for debugging
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        errorBody = "(could not read body)";
      }
      console.warn(
        `[polymarket-context] Failed to fetch positions: ${response.status}`,
        { errorBody: errorBody.slice(0, 500) }
      );
      return [];
    }

    const positions: RawPosition[] = await response.json();

    if (!Array.isArray(positions)) {
      console.warn("[polymarket-context] Unexpected response format:", typeof positions);
      return [];
    }

    console.log("[polymarket-context] Positions found:", {
      count: positions.length,
      preview: positions.slice(0, 2).map((p) => ({
        title: p.title?.slice(0, 50),
        outcome: p.outcome,
        size: p.size,
      })),
    });

    // Map Data API response format to our PolymarketPosition type
    return positions.map((p) => ({
      conditionId: p.conditionId || "",
      tokenId: p.asset || "",
      // Data API returns "Yes"/"No" as strings, normalize to uppercase
      outcome: (p.outcome?.toUpperCase() || (p.outcomeIndex === 0 ? "YES" : "NO")) as "YES" | "NO",
      shares: Number(p.size || 0),
      avgEntryPrice: Number(p.avgPrice || 0),
      marketTitle: p.title,
      // Include additional useful data from Data API
      currentPrice: p.curPrice,
      unrealizedPnL: p.cashPnl,
      unrealizedPnLPercent: p.percentPnl,
    }));
  } catch (error) {
    console.error("[polymarket-context] Error fetching positions:", error);
    return [];
  }
}

/**
 * Fetch open orders for a wallet address
 */
export async function fetchPolymarketOrders(
  walletAddress: string
): Promise<PolymarketOrder[]> {
  try {
    const response = await fetch(
      `${CLOB_API_URL}/orders?user=${walletAddress.toLowerCase()}&status=open`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      // Orders endpoint may require auth - don't log as error
      return [];
    }

    const orders: RawOrder[] = await response.json();

    if (!Array.isArray(orders)) {
      return [];
    }

    return orders.map((o) => ({
      orderId: o.id || o.order_id || "",
      conditionId: o.market || o.condition_id || "",
      side: (o.side?.toUpperCase() || "BUY") as "BUY" | "SELL",
      outcome: o.outcome === 0 ? "YES" : "NO",
      price: Number(o.price || 0),
      size: Number(o.size || 0),
      filled: Number(o.filled || 0),
    }));
  } catch (error) {
    // Orders endpoint may require auth - silently fail
    console.debug("[polymarket-context] Could not fetch orders:", error);
    return [];
  }
}

/**
 * Build complete Polymarket context for a single wallet
 */
export async function buildPolymarketContextForWallet(
  walletAddress: string
): Promise<PolymarketContext> {
  const [positions, openOrders] = await Promise.all([
    fetchPolymarketPositions(walletAddress),
    fetchPolymarketOrders(walletAddress),
  ]);

  // Calculate total value using entry prices (rough estimate)
  const totalValue = positions.reduce(
    (sum, p) => sum + p.shares * p.avgEntryPrice,
    0
  );

  return {
    walletAddress,
    positions,
    openOrders,
    totalValue,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Build complete Polymarket context for all linked wallets
 * Merges positions from multiple wallets into a single context
 */
export async function buildPolymarketContext(
  walletAddresses: string[]
): Promise<PolymarketContext> {
  if (walletAddresses.length === 0) {
    return {
      walletAddress: "",
      positions: [],
      openOrders: [],
      totalValue: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  // Fetch from all linked wallets in parallel
  const contexts = await Promise.all(
    walletAddresses.map((address) => buildPolymarketContextForWallet(address))
  );

  // Merge all positions and orders
  const allPositions = contexts.flatMap((ctx) => ctx.positions);
  const allOrders = contexts.flatMap((ctx) => ctx.openOrders);
  const totalValue = contexts.reduce((sum, ctx) => sum + (ctx.totalValue || 0), 0);

  return {
    walletAddress: walletAddresses.join(","),
    positions: allPositions,
    openOrders: allOrders,
    totalValue,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Check if a wallet has any Polymarket positions
 * Useful for quick checks without fetching full context
 */
export async function hasPolymarketPositions(
  walletAddress: string
): Promise<boolean> {
  const positions = await fetchPolymarketPositions(walletAddress);
  return positions.length > 0;
}

