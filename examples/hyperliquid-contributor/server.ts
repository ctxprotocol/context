import "dotenv/config";
import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";

const HYPERLIQUID_API_URL = "https://api.hyperliquid.xyz/info";

// Tool definitions with MCP-compatible JSON schemas including outputSchema (MCP 2025-06-18)
const TOOLS = [
  {
    name: "get_orderbook",
    description:
      "Get the Level 2 orderbook for a Hyperliquid perpetual or spot market. Returns bids and asks with price, size, and cumulative depth. Essential for analyzing market liquidity and depth.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description:
            'The coin/asset symbol (e.g., "HYPE", "BTC", "ETH"). Use list_markets to see all available symbols.',
        },
        nSigFigs: {
          type: "number",
          description:
            "Optional: Aggregate price levels to N significant figures (2-5). Use 2-3 for wider view, 4-5 for precision. Default is full precision.",
          minimum: 2,
          maximum: 5,
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description: "The coin symbol",
        },
        midPrice: {
          type: "number",
          description: "Mid price between best bid and best ask",
        },
        spread: {
          type: "number",
          description: "Spread between best bid and ask in basis points",
        },
        bids: {
          type: "array",
          description:
            "Bid levels (buy orders) sorted by price descending. First item is best bid (highest price buyers willing to pay).",
          items: {
            type: "object",
            properties: {
              price: { type: "number", description: "Price level" },
              size: { type: "number", description: "Size at this price" },
              numOrders: {
                type: "number",
                description: "Number of orders at this level",
              },
              cumulativeSize: {
                type: "number",
                description: "Cumulative size from best bid to this level",
              },
              cumulativeNotional: {
                type: "number",
                description:
                  "Cumulative notional value (USD) from best bid to this level",
              },
            },
          },
        },
        asks: {
          type: "array",
          description:
            "Ask levels (sell orders) sorted by price ascending. First item is best ask (lowest price sellers willing to accept).",
          items: {
            type: "object",
            properties: {
              price: { type: "number", description: "Price level" },
              size: { type: "number", description: "Size at this price" },
              numOrders: {
                type: "number",
                description: "Number of orders at this level",
              },
              cumulativeSize: {
                type: "number",
                description: "Cumulative size from best ask to this level",
              },
              cumulativeNotional: {
                type: "number",
                description:
                  "Cumulative notional value (USD) from best ask to this level",
              },
            },
          },
        },
        totalBidLiquidity: {
          type: "number",
          description: "Total bid-side liquidity in USD (visible depth)",
        },
        totalAskLiquidity: {
          type: "number",
          description: "Total ask-side liquidity in USD (visible depth)",
        },
        fetchedAt: {
          type: "string",
          description: "ISO timestamp of when data was fetched",
        },
      },
      required: [
        "coin",
        "midPrice",
        "spread",
        "bids",
        "asks",
        "totalBidLiquidity",
        "totalAskLiquidity",
        "fetchedAt",
      ],
    },
  },
  {
    name: "calculate_price_impact",
    description:
      "Calculate the price impact of selling or buying a specific amount of an asset. Walks through the orderbook to simulate execution and returns average fill price, slippage, and whether the order would clear the visible book. CRITICAL for analyzing if market can absorb large sell/buy flows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description: 'The coin/asset symbol (e.g., "HYPE", "BTC", "ETH")',
        },
        side: {
          type: "string",
          description:
            '"sell" to sell the asset (hits bids), "buy" to buy the asset (lifts asks)',
          enum: ["sell", "buy"],
        },
        size: {
          type: "number",
          description:
            "Size of the order in base asset units (e.g., 609108 for 609,108 HYPE)",
        },
        sizeInUsd: {
          type: "number",
          description:
            "Alternative: specify size in USD notional. If provided, size parameter is ignored.",
        },
      },
      required: ["coin", "side"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: "The coin symbol" },
        side: { type: "string", description: "sell or buy" },
        orderSize: {
          type: "number",
          description: "Order size in base asset units",
        },
        orderNotional: {
          type: "number",
          description: "Order size in USD at mid price",
        },
        midPrice: { type: "number", description: "Current mid price" },
        averageFillPrice: {
          type: "number",
          description:
            "Volume-weighted average price if order executed through visible book",
        },
        worstFillPrice: {
          type: "number",
          description:
            "The worst price level touched to fill the order (furthest from mid)",
        },
        priceImpactPercent: {
          type: "number",
          description:
            "Price impact as percentage from mid price. Negative means selling below mid.",
        },
        slippageBps: {
          type: "number",
          description: "Slippage in basis points (100 bps = 1%)",
        },
        filledSize: {
          type: "number",
          description: "How much was filled from visible orderbook",
        },
        filledPercent: {
          type: "number",
          description:
            "Percentage of order filled by visible book (100 = fully absorbed)",
        },
        remainingSize: {
          type: "number",
          description:
            "Size that CANNOT be filled by visible book (would need hidden liquidity or market makers)",
        },
        levelsConsumed: {
          type: "number",
          description: "Number of price levels consumed to fill",
        },
        canAbsorb: {
          type: "boolean",
          description:
            "TRUE if visible orderbook can fully absorb the order, FALSE if it would exhaust visible liquidity",
        },
        absorption: {
          type: "string",
          description:
            'Human-readable assessment: "easily absorbed", "absorbed with impact", "partially absorbed", "would exhaust book"',
        },
        fetchedAt: {
          type: "string",
          description: "ISO timestamp of when data was fetched",
        },
      },
      required: [
        "coin",
        "side",
        "orderSize",
        "orderNotional",
        "midPrice",
        "averageFillPrice",
        "priceImpactPercent",
        "slippageBps",
        "filledSize",
        "filledPercent",
        "canAbsorb",
        "absorption",
        "fetchedAt",
      ],
    },
  },
  {
    name: "list_markets",
    description:
      "List all available perpetual markets on Hyperliquid with their symbols, current prices, and basic info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        markets: {
          type: "array",
          description: "List of available perpetual markets",
          items: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Trading symbol" },
              name: { type: "string", description: "Full name" },
              markPrice: {
                type: "number",
                description: "Current mark price in USD",
              },
              szDecimals: {
                type: "number",
                description: "Size decimals for the asset",
              },
            },
          },
        },
        count: {
          type: "number",
          description: "Total number of available markets",
        },
        fetchedAt: {
          type: "string",
          description: "ISO timestamp of when data was fetched",
        },
      },
      required: ["markets", "count", "fetchedAt"],
    },
  },
  {
    name: "get_market_info",
    description:
      "Get detailed market information for a specific coin including price, 24h volume, open interest, funding rate, and market stats.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description:
            'The coin/asset symbol (e.g., "HYPE", "BTC", "ETH"). Use list_markets to see all available symbols.',
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: "The coin symbol" },
        markPrice: { type: "number", description: "Current mark price in USD" },
        midPrice: { type: "number", description: "Current mid price from orderbook" },
        indexPrice: { type: "number", description: "Index price from oracles" },
        openInterest: {
          type: "number",
          description: "Open interest in base asset units",
        },
        openInterestUsd: {
          type: "number",
          description: "Open interest in USD",
        },
        fundingRate: {
          type: "number",
          description:
            "Current funding rate (hourly). Positive = longs pay shorts.",
        },
        fundingRateAnnualized: {
          type: "number",
          description: "Annualized funding rate percentage",
        },
        volume24h: {
          type: "number",
          description: "24-hour trading volume in USD",
        },
        priceChange24h: {
          type: "number",
          description: "24-hour price change percentage",
        },
        premium: {
          type: "number",
          description:
            "Premium/discount of mark price vs index price (percentage)",
        },
        fetchedAt: {
          type: "string",
          description: "ISO timestamp of when data was fetched",
        },
      },
      required: [
        "coin",
        "markPrice",
        "fundingRate",
        "openInterest",
        "volume24h",
        "fetchedAt",
      ],
    },
  },
  {
    name: "get_recent_trades",
    description:
      "Get recent trades for a coin to analyze recent market activity, trade sizes, and execution patterns.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description:
            'The coin/asset symbol (e.g., "HYPE", "BTC", "ETH")',
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: "The coin symbol" },
        trades: {
          type: "array",
          description: "Recent trades sorted by time descending",
          items: {
            type: "object",
            properties: {
              price: { type: "number", description: "Trade price" },
              size: { type: "number", description: "Trade size in base asset" },
              notional: { type: "number", description: "Trade size in USD" },
              side: {
                type: "string",
                description: "Taker side: buy (lifted ask) or sell (hit bid)",
              },
              time: { type: "string", description: "Trade timestamp" },
            },
          },
        },
        summary: {
          type: "object",
          description: "Summary statistics of recent trades",
          properties: {
            totalVolume: { type: "number", description: "Total volume in base" },
            totalNotional: { type: "number", description: "Total volume in USD" },
            avgTradeSize: { type: "number", description: "Average trade size" },
            buyVolume: { type: "number", description: "Buy-side volume" },
            sellVolume: { type: "number", description: "Sell-side volume" },
            buyRatio: {
              type: "number",
              description: "Percentage of volume from buys",
            },
          },
        },
        fetchedAt: {
          type: "string",
          description: "ISO timestamp of when data was fetched",
        },
      },
      required: ["coin", "trades", "summary", "fetchedAt"],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: "hyperliquid-orderbook",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tools/call request
server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_orderbook": {
          const coin = args?.coin as string;
          if (!coin) {
            return errorResult("coin parameter is required");
          }
          const nSigFigs = args?.nSigFigs as number | undefined;

          const bookData = await fetchL2Book(coin, nSigFigs);
          const structuredData = parseOrderbook(bookData, coin);

          return {
            content: [
              { type: "text", text: JSON.stringify(structuredData, null, 2) },
            ],
            structuredContent: structuredData,
          };
        }

        case "calculate_price_impact": {
          const coin = args?.coin as string;
          const side = args?.side as "sell" | "buy";
          let size = args?.size as number | undefined;
          const sizeInUsd = args?.sizeInUsd as number | undefined;

          if (!coin) {
            return errorResult("coin parameter is required");
          }
          if (!side || !["sell", "buy"].includes(side)) {
            return errorResult('side parameter must be "sell" or "buy"');
          }

          // Fetch orderbook
          const bookData = await fetchL2Book(coin);
          const parsed = parseOrderbook(bookData, coin);

          // If size in USD provided, convert to base units
          if (sizeInUsd && !size) {
            size = sizeInUsd / parsed.midPrice;
          }

          if (!size || size <= 0) {
            return errorResult(
              "Either size or sizeInUsd parameter is required and must be positive"
            );
          }

          const impact = calculatePriceImpact(parsed, side, size);

          return {
            content: [
              { type: "text", text: JSON.stringify(impact, null, 2) },
            ],
            structuredContent: impact,
          };
        }

        case "list_markets": {
          const metaData = await fetchMeta();
          const mids = await fetchAllMids();
          const structuredData = parseMarkets(metaData, mids);

          return {
            content: [
              { type: "text", text: JSON.stringify(structuredData, null, 2) },
            ],
            structuredContent: structuredData,
          };
        }

        case "get_market_info": {
          const coin = args?.coin as string;
          if (!coin) {
            return errorResult("coin parameter is required");
          }

          const [metaAndCtx, bookData, mids] = await Promise.all([
            fetchMetaAndAssetCtxs(),
            fetchL2Book(coin),
            fetchAllMids(),
          ]);

          const structuredData = parseMarketInfo(
            metaAndCtx,
            bookData,
            mids,
            coin
          );

          return {
            content: [
              { type: "text", text: JSON.stringify(structuredData, null, 2) },
            ],
            structuredContent: structuredData,
          };
        }

        case "get_recent_trades": {
          const coin = args?.coin as string;
          if (!coin) {
            return errorResult("coin parameter is required");
          }

          const trades = await fetchRecentTrades(coin);
          const structuredData = parseRecentTrades(trades, coin);

          return {
            content: [
              { type: "text", text: JSON.stringify(structuredData, null, 2) },
            ],
            structuredContent: structuredData,
          };
        }

        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return errorResult(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ============ API Fetch Functions ============

async function hyperliquidPost(body: object): Promise<unknown> {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Hyperliquid API error (${response.status}): ${text.slice(0, 200)}`
    );
  }

  return response.json();
}

async function fetchL2Book(
  coin: string,
  nSigFigs?: number
): Promise<L2BookResponse> {
  const body: Record<string, unknown> = { type: "l2Book", coin };
  if (nSigFigs) {
    body.nSigFigs = nSigFigs;
  }
  return hyperliquidPost(body) as Promise<L2BookResponse>;
}

async function fetchMeta(): Promise<MetaResponse> {
  return hyperliquidPost({ type: "meta" }) as Promise<MetaResponse>;
}

async function fetchAllMids(): Promise<AllMidsResponse> {
  return hyperliquidPost({ type: "allMids" }) as Promise<AllMidsResponse>;
}

async function fetchMetaAndAssetCtxs(): Promise<MetaAndAssetCtxsResponse> {
  return hyperliquidPost({
    type: "metaAndAssetCtxs",
  }) as Promise<MetaAndAssetCtxsResponse>;
}

async function fetchRecentTrades(coin: string): Promise<RecentTradesResponse> {
  return hyperliquidPost({
    type: "recentTrades",
    coin,
  }) as Promise<RecentTradesResponse>;
}

// ============ Type Definitions ============

interface L2Level {
  px: string;
  sz: string;
  n: number;
}

interface L2BookResponse {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]]; // [bids, asks]
}

interface MetaResponse {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
  }>;
}

interface AllMidsResponse {
  [coin: string]: string;
}

interface AssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium?: string;
  oraclePx?: string;
  markPx?: string;
}

interface MetaAndAssetCtxsResponse {
  0: MetaResponse;
  1: AssetCtx[];
}

interface RecentTradesResponse {
  coin: string;
  side: string;
  px: string;
  sz: string;
  time: number;
  hash: string;
}

// ============ Parsed Output Types ============

interface OrderbookLevel {
  price: number;
  size: number;
  numOrders: number;
  cumulativeSize: number;
  cumulativeNotional: number;
}

interface ParsedOrderbook {
  coin: string;
  midPrice: number;
  spread: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  totalBidLiquidity: number;
  totalAskLiquidity: number;
  fetchedAt: string;
}

interface PriceImpactResult {
  coin: string;
  side: string;
  orderSize: number;
  orderNotional: number;
  midPrice: number;
  averageFillPrice: number;
  worstFillPrice: number;
  priceImpactPercent: number;
  slippageBps: number;
  filledSize: number;
  filledPercent: number;
  remainingSize: number;
  levelsConsumed: number;
  canAbsorb: boolean;
  absorption: string;
  fetchedAt: string;
}

// ============ Parsing Functions ============

function parseOrderbook(data: L2BookResponse, coin: string): ParsedOrderbook {
  const [rawBids, rawAsks] = data.levels;

  // Parse and calculate cumulative values for bids
  let cumBidSize = 0;
  let cumBidNotional = 0;
  const bids: OrderbookLevel[] = rawBids.map((level) => {
    const price = Number(level.px);
    const size = Number(level.sz);
    cumBidSize += size;
    cumBidNotional += size * price;
    return {
      price,
      size,
      numOrders: level.n,
      cumulativeSize: cumBidSize,
      cumulativeNotional: cumBidNotional,
    };
  });

  // Parse and calculate cumulative values for asks
  let cumAskSize = 0;
  let cumAskNotional = 0;
  const asks: OrderbookLevel[] = rawAsks.map((level) => {
    const price = Number(level.px);
    const size = Number(level.sz);
    cumAskSize += size;
    cumAskNotional += size * price;
    return {
      price,
      size,
      numOrders: level.n,
      cumulativeSize: cumAskSize,
      cumulativeNotional: cumAskNotional,
    };
  });

  const bestBid = bids.at(0)?.price ?? 0;
  const bestAsk = asks.at(0)?.price ?? 0;
  const midPrice = (bestBid + bestAsk) / 2;
  const spread = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10000 : 0; // bps

  return {
    coin,
    midPrice,
    spread: Number(spread.toFixed(2)),
    bids,
    asks,
    totalBidLiquidity: cumBidNotional,
    totalAskLiquidity: cumAskNotional,
    fetchedAt: new Date().toISOString(),
  };
}

function calculatePriceImpact(
  book: ParsedOrderbook,
  side: "sell" | "buy",
  size: number
): PriceImpactResult {
  const levels = side === "sell" ? book.bids : book.asks;
  const midPrice = book.midPrice;

  let remainingSize = size;
  let totalFilled = 0;
  let totalNotional = 0;
  let levelsConsumed = 0;
  let worstPrice = midPrice;

  for (const level of levels) {
    if (remainingSize <= 0) break;

    const fillSize = Math.min(remainingSize, level.size);
    totalFilled += fillSize;
    totalNotional += fillSize * level.price;
    remainingSize -= fillSize;
    levelsConsumed++;
    worstPrice = level.price;
  }

  const avgFillPrice = totalFilled > 0 ? totalNotional / totalFilled : midPrice;
  const priceImpact = ((avgFillPrice - midPrice) / midPrice) * 100;
  const slippageBps = Math.abs(priceImpact) * 100;
  const filledPercent = (totalFilled / size) * 100;
  const canAbsorb = remainingSize <= 0;

  // Determine absorption quality
  let absorption: string;
  if (!canAbsorb) {
    absorption = "would exhaust visible book";
  } else if (slippageBps < 10) {
    absorption = "easily absorbed";
  } else if (slippageBps < 50) {
    absorption = "absorbed with minor impact";
  } else if (slippageBps < 200) {
    absorption = "absorbed with moderate impact";
  } else {
    absorption = "absorbed with significant impact";
  }

  return {
    coin: book.coin,
    side,
    orderSize: size,
    orderNotional: size * midPrice,
    midPrice,
    averageFillPrice: Number(avgFillPrice.toFixed(6)),
    worstFillPrice: worstPrice,
    priceImpactPercent: Number(priceImpact.toFixed(4)),
    slippageBps: Number(slippageBps.toFixed(2)),
    filledSize: totalFilled,
    filledPercent: Number(filledPercent.toFixed(2)),
    remainingSize,
    levelsConsumed,
    canAbsorb,
    absorption,
    fetchedAt: new Date().toISOString(),
  };
}

function parseMarkets(
  meta: MetaResponse,
  mids: AllMidsResponse
): { markets: Array<{ symbol: string; name: string; markPrice: number; szDecimals: number }>; count: number; fetchedAt: string } {
  const markets = meta.universe.map((asset) => ({
    symbol: asset.name,
    name: asset.name,
    markPrice: Number(mids[asset.name] || 0),
    szDecimals: asset.szDecimals,
  }));

  return {
    markets,
    count: markets.length,
    fetchedAt: new Date().toISOString(),
  };
}

function parseMarketInfo(
  metaAndCtx: MetaAndAssetCtxsResponse,
  bookData: L2BookResponse,
  mids: AllMidsResponse,
  coin: string
): Record<string, unknown> {
  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];

  // Find index of coin
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    throw new Error(`Coin ${coin} not found in Hyperliquid markets`);
  }

  const ctx = ctxs[idx];
  const midPrice = Number(mids[coin] || 0);
  const markPrice = Number(ctx.markPx || mids[coin] || 0);
  const indexPrice = Number(ctx.oraclePx || 0);
  const openInterest = Number(ctx.openInterest || 0);
  const fundingRate = Number(ctx.funding || 0);
  const prevDayPx = Number(ctx.prevDayPx || 0);
  const volume24h = Number(ctx.dayNtlVlm || 0);
  const premium = Number(ctx.premium || 0);

  const priceChange24h =
    prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;

  // Parse orderbook for best bid/ask
  const parsed = parseOrderbook(bookData, coin);

  return {
    coin,
    markPrice,
    midPrice: parsed.midPrice,
    indexPrice,
    openInterest,
    openInterestUsd: openInterest * markPrice,
    fundingRate,
    fundingRateAnnualized: fundingRate * 24 * 365 * 100, // Convert hourly to annual %
    volume24h,
    priceChange24h: Number(priceChange24h.toFixed(2)),
    premium: Number((premium * 100).toFixed(4)),
    spread: parsed.spread,
    bestBid: parsed.bids.at(0)?.price,
    bestAsk: parsed.asks.at(0)?.price,
    fetchedAt: new Date().toISOString(),
  };
}

function parseRecentTrades(
  trades: RecentTradesResponse[] | RecentTradesResponse,
  coin: string
): Record<string, unknown> {
  // API might return array or single object
  const tradesArray = Array.isArray(trades) ? trades : [trades];

  let totalVolume = 0;
  let totalNotional = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  const parsedTrades = tradesArray.slice(0, 50).map((t) => {
    const price = Number(t.px);
    const size = Number(t.sz);
    const notional = price * size;
    const side = t.side.toLowerCase() as "buy" | "sell";

    totalVolume += size;
    totalNotional += notional;
    if (side === "buy") {
      buyVolume += size;
    } else {
      sellVolume += size;
    }

    return {
      price,
      size,
      notional: Number(notional.toFixed(2)),
      side,
      time: new Date(t.time).toISOString(),
    };
  });

  return {
    coin,
    trades: parsedTrades,
    summary: {
      totalVolume,
      totalNotional: Number(totalNotional.toFixed(2)),
      avgTradeSize:
        parsedTrades.length > 0 ? totalVolume / parsedTrades.length : 0,
      buyVolume,
      sellVolume,
      buyRatio:
        totalVolume > 0
          ? Number(((buyVolume / totalVolume) * 100).toFixed(2))
          : 50,
    },
    fetchedAt: new Date().toISOString(),
  };
}

// ============ Express Server Setup ============

const app = express();
app.use(express.json());

// Store SSE transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "hyperliquid-orderbook",
    version: "1.0.0",
    tools: TOOLS.map((t) => t.name),
  });
});

// SSE endpoint for MCP connections
app.get("/sse", async (_req: Request, res: Response) => {
  console.log("New SSE connection established");

  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    console.log(`SSE connection closed: ${transport.sessionId}`);
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

// Message endpoint for SSE transport
app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({ error: "No transport found for sessionId" });
  }
});

// Start server
const port = Number(process.env.PORT || 4002);
app.listen(port, () => {
  console.log(`Hyperliquid MCP server listening on http://localhost:${port}`);
  console.log(`SSE endpoint: http://localhost:${port}/sse`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log("\nAvailable tools:");
  for (const tool of TOOLS) {
    console.log(`  - ${tool.name}: ${tool.description.slice(0, 80)}...`);
  }
});

