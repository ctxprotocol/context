/**
 * Hyperliquid Context Builder
 *
 * Fetches portfolio data from Hyperliquid's public API.
 * No authentication required - just wallet address.
 *
 * Chain: Arbitrum (but API uses standard EVM addresses)
 */

import type {
  HyperliquidContext,
  HyperliquidPerpPosition,
  HyperliquidOrder,
  HyperliquidSpotBalance,
  HyperliquidAccountSummary,
} from "@ctxprotocol/sdk";

const HL_API_URL = "https://api.hyperliquid.xyz/info";

// Raw API response types
interface RawAssetPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    unrealizedPnl: string;
    liquidationPx: string;
    positionValue: string;
    marginUsed: string;
    leverage?: { type: string; value: number };
    returnOnEquity: string;
    cumFunding?: { allTime: string; sinceOpen: string };
  };
  type: string;
}

interface RawClearinghouseState {
  assetPositions?: RawAssetPosition[];
  marginSummary?: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  };
  crossMarginSummary?: {
    accountValue: string;
    totalMarginUsed: string;
  };
  withdrawable?: string;
}

interface RawOrder {
  oid: number;
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  origSz?: string;
  orderType?: string;
  reduceOnly?: boolean;
  isTrigger?: boolean;
  triggerPx?: string;
  timestamp: number;
}

interface RawSpotBalance {
  coin?: string;
  token?: string;
  total: string;
}

/**
 * Fetch Hyperliquid clearinghouse state (perp positions + account summary)
 */
export async function fetchHyperliquidClearinghouseState(
  walletAddress: string
): Promise<{
  positions: HyperliquidPerpPosition[];
  accountSummary: HyperliquidAccountSummary;
}> {
  try {
    const response = await fetch(HL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: walletAddress.toLowerCase(),
      }),
    });

    if (!response.ok) {
      console.warn(
        `[hyperliquid-context] Failed to fetch clearinghouse: ${response.status}`
      );
      return { positions: [], accountSummary: defaultAccountSummary() };
    }

    const data: RawClearinghouseState = await response.json();

    const positions: HyperliquidPerpPosition[] = (data.assetPositions || [])
      .filter((ap) => ap.position && Number(ap.position.szi) !== 0)
      .map((ap) => {
        const p = ap.position;
        return {
          coin: p.coin,
          size: Number(p.szi),
          entryPrice: Number(p.entryPx),
          markPrice: undefined, // Would need separate API call for live mark price
          unrealizedPnl: Number(p.unrealizedPnl),
          liquidationPrice: Number(p.liquidationPx),
          positionValue: Number(p.positionValue),
          leverage: {
            type: (p.leverage?.type || "cross") as "cross" | "isolated",
            value: Number(p.leverage?.value || 1),
          },
          marginUsed: Number(p.marginUsed),
          returnOnEquity: Number(p.returnOnEquity),
          cumFunding: {
            allTime: Number(p.cumFunding?.allTime || 0),
            sinceOpen: Number(p.cumFunding?.sinceOpen || 0),
          },
        };
      });

    const accountSummary: HyperliquidAccountSummary = {
      accountValue: Number(data.marginSummary?.accountValue || 0),
      totalMarginUsed: Number(data.marginSummary?.totalMarginUsed || 0),
      totalNotionalPosition: Number(data.marginSummary?.totalNtlPos || 0),
      withdrawable: Number(data.withdrawable || 0),
      crossMargin: {
        accountValue: Number(data.crossMarginSummary?.accountValue || 0),
        totalMarginUsed: Number(data.crossMarginSummary?.totalMarginUsed || 0),
      },
    };

    return { positions, accountSummary };
  } catch (error) {
    console.error("[hyperliquid-context] Error fetching clearinghouse:", error);
    return { positions: [], accountSummary: defaultAccountSummary() };
  }
}

/**
 * Fetch open orders
 */
export async function fetchHyperliquidOrders(
  walletAddress: string
): Promise<HyperliquidOrder[]> {
  try {
    const response = await fetch(HL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "openOrders",
        user: walletAddress.toLowerCase(),
      }),
    });

    if (!response.ok) {
      return [];
    }

    const orders: RawOrder[] = await response.json();

    return (orders || []).map((o) => ({
      oid: o.oid,
      coin: o.coin,
      side: o.side as "B" | "A",
      limitPrice: Number(o.limitPx),
      size: Number(o.sz),
      originalSize: Number(o.origSz || o.sz),
      orderType: (o.orderType || "Limit") as
        | "Limit"
        | "Market"
        | "Stop"
        | "TakeProfit",
      reduceOnly: o.reduceOnly || false,
      isTrigger: o.isTrigger || false,
      triggerPrice: o.triggerPx ? Number(o.triggerPx) : undefined,
      timestamp: o.timestamp,
    }));
  } catch (error) {
    console.debug("[hyperliquid-context] Could not fetch orders:", error);
    return [];
  }
}

/**
 * Fetch spot balances
 */
export async function fetchHyperliquidSpotBalances(
  walletAddress: string
): Promise<HyperliquidSpotBalance[]> {
  try {
    const response = await fetch(HL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "spotClearinghouseState",
        user: walletAddress.toLowerCase(),
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { balances?: RawSpotBalance[] };

    // Parse spot balances from response
    const balances: HyperliquidSpotBalance[] = (data.balances || [])
      .filter((b) => Number(b.total) > 0)
      .map((b) => ({
        token: b.coin || b.token || "UNKNOWN",
        balance: Number(b.total),
        usdValue: undefined,
      }));

    return balances;
  } catch (error) {
    console.debug(
      "[hyperliquid-context] Could not fetch spot balances:",
      error
    );
    return [];
  }
}

/**
 * Build complete Hyperliquid context for a single wallet
 */
export async function buildHyperliquidContextForWallet(
  walletAddress: string
): Promise<HyperliquidContext> {
  const [clearinghouse, openOrders, spotBalances] = await Promise.all([
    fetchHyperliquidClearinghouseState(walletAddress),
    fetchHyperliquidOrders(walletAddress),
    fetchHyperliquidSpotBalances(walletAddress),
  ]);

  return {
    walletAddress,
    perpPositions: clearinghouse.positions,
    openOrders,
    spotBalances,
    accountSummary: clearinghouse.accountSummary,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Build Hyperliquid context for all linked wallets
 */
export async function buildHyperliquidContext(
  walletAddresses: string[]
): Promise<HyperliquidContext> {
  if (walletAddresses.length === 0) {
    return {
      walletAddress: "",
      perpPositions: [],
      openOrders: [],
      spotBalances: [],
      accountSummary: defaultAccountSummary(),
      fetchedAt: new Date().toISOString(),
    };
  }

  const contexts = await Promise.all(
    walletAddresses.map((addr) => buildHyperliquidContextForWallet(addr))
  );

  // Merge all contexts
  return {
    walletAddress: walletAddresses.join(","),
    perpPositions: contexts.flatMap((c) => c.perpPositions),
    openOrders: contexts.flatMap((c) => c.openOrders),
    spotBalances: contexts.flatMap((c) => c.spotBalances),
    accountSummary: {
      accountValue: contexts.reduce(
        (sum, c) => sum + c.accountSummary.accountValue,
        0
      ),
      totalMarginUsed: contexts.reduce(
        (sum, c) => sum + c.accountSummary.totalMarginUsed,
        0
      ),
      totalNotionalPosition: contexts.reduce(
        (sum, c) => sum + c.accountSummary.totalNotionalPosition,
        0
      ),
      withdrawable: contexts.reduce(
        (sum, c) => sum + c.accountSummary.withdrawable,
        0
      ),
      crossMargin: {
        accountValue: contexts.reduce(
          (sum, c) => sum + c.accountSummary.crossMargin.accountValue,
          0
        ),
        totalMarginUsed: contexts.reduce(
          (sum, c) => sum + c.accountSummary.crossMargin.totalMarginUsed,
          0
        ),
      },
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Check if a wallet has any Hyperliquid positions
 */
export async function hasHyperliquidPositions(
  walletAddress: string
): Promise<boolean> {
  const { positions } =
    await fetchHyperliquidClearinghouseState(walletAddress);
  return positions.length > 0;
}

function defaultAccountSummary(): HyperliquidAccountSummary {
  return {
    accountValue: 0,
    totalMarginUsed: 0,
    totalNotionalPosition: 0,
    withdrawable: 0,
    crossMargin: { accountValue: 0, totalMarginUsed: 0 },
  };
}

