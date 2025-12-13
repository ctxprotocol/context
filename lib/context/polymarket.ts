/**
 * Polymarket Context Builder
 *
 * Fetches portfolio data from Polymarket's public API.
 * No authentication required - blockchain data is public.
 *
 * Chain: Polygon (Chain ID 137)
 */

import type {
  PolymarketContext,
  PolymarketPosition,
  PolymarketOrder,
} from "@ctxprotocol/sdk";

const CLOB_API_URL = "https://clob.polymarket.com";

// Type for raw API response
interface RawPosition {
  market?: string;
  condition_id?: string;
  asset_id?: string;
  token_id?: string;
  outcome?: number;
  size?: string | number;
  avg_price?: string | number;
  title?: string;
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
 * This uses Polymarket's public API - no auth required
 */
export async function fetchPolymarketPositions(
  walletAddress: string
): Promise<PolymarketPosition[]> {
  try {
    const response = await fetch(
      `${CLOB_API_URL}/positions?user=${walletAddress.toLowerCase()}`,
      {
        headers: {
          Accept: "application/json",
        },
        // Cache for 30 seconds to avoid hammering the API
        next: { revalidate: 30 },
      }
    );

    if (!response.ok) {
      console.warn(
        `[polymarket-context] Failed to fetch positions: ${response.status}`
      );
      return [];
    }

    const positions: RawPosition[] = await response.json();

    if (!Array.isArray(positions)) {
      console.warn("[polymarket-context] Unexpected response format");
      return [];
    }

    return positions.map((p) => ({
      conditionId: p.market || p.condition_id || "",
      tokenId: p.asset_id || p.token_id || "",
      outcome: p.outcome === 0 ? "YES" : "NO",
      shares: Number(p.size || 0),
      avgEntryPrice: Number(p.avg_price || 0),
      marketTitle: p.title,
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

