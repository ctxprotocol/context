import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { type Request, type Response } from "express";

const HYPERLIQUID_API_URL = "https://api.hyperliquid.xyz/info";

// ============================================================================
// TOOL DEFINITIONS - The world's most comprehensive Hyperliquid MCP
// ============================================================================

const TOOLS = [
  // ==================== ORDERBOOK & LIQUIDITY ====================
  {
    name: "get_orderbook",
    description:
      "Get the Level 2 orderbook for a Hyperliquid perpetual market. Returns bids/asks with cumulative depth, liquidity metrics, and volume context for understanding market absorption capacity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description: 'The coin symbol (e.g., "HYPE", "BTC", "ETH")',
        },
        nSigFigs: {
          type: "number",
          description:
            "Aggregate price levels to N significant figures (2-5). Lower = wider view.",
          minimum: 2,
          maximum: 5,
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        midPrice: { type: "number" },
        spread: { type: "number", description: "Spread in basis points" },
        bids: {
          type: "array",
          description: "Bid levels with cumulative depth",
        },
        asks: {
          type: "array",
          description: "Ask levels with cumulative depth",
        },
        totalBidLiquidity: {
          type: "number",
          description: "Total bid liquidity in USD",
        },
        totalAskLiquidity: {
          type: "number",
          description: "Total ask liquidity in USD",
        },
        liquidityContext: {
          type: "object",
          description: "Context comparing orderbook to daily volume",
          properties: {
            bidLiquidityAsPercentOfDailyVolume: { type: "number" },
            askLiquidityAsPercentOfDailyVolume: { type: "number" },
            volume24h: { type: "number" },
            liquidityScore: {
              type: "string",
              description: "deep, moderate, thin, or very thin",
            },
          },
        },
        note: {
          type: "string",
          description: "Important context about visible vs hidden liquidity",
        },
        fetchedAt: { type: "string" },
      },
      required: [
        "coin",
        "midPrice",
        "bids",
        "asks",
        "totalBidLiquidity",
        "totalAskLiquidity",
      ],
    },
  },

  {
    name: "calculate_price_impact",
    description:
      "Calculate the price impact of selling or buying a specific amount. Simulates execution through the orderbook, estimates TWAP duration for minimal impact, and provides absorption analysis. CRITICAL for analyzing large order flows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: 'Coin symbol (e.g., "HYPE")' },
        side: {
          type: "string",
          enum: ["sell", "buy"],
          description: "sell hits bids, buy lifts asks",
        },
        size: { type: "number", description: "Size in base asset units" },
        sizeInUsd: {
          type: "number",
          description: "Alternative: size in USD (overrides size)",
        },
      },
      required: ["coin", "side"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        side: { type: "string" },
        orderSize: { type: "number" },
        orderNotional: { type: "number" },
        midPrice: { type: "number" },
        averageFillPrice: { type: "number" },
        worstFillPrice: { type: "number" },
        priceImpactPercent: { type: "number" },
        slippageBps: { type: "number" },
        filledSize: { type: "number" },
        filledPercent: { type: "number" },
        remainingSize: { type: "number" },
        levelsConsumed: { type: "number" },
        canAbsorb: { type: "boolean" },
        absorption: { type: "string" },
        volumeContext: {
          type: "object",
          properties: {
            orderAsPercentOfDailyVolume: { type: "number" },
            volume24h: { type: "number" },
            estimatedTwapDuration: {
              type: "string",
              description: "Recommended TWAP duration for minimal impact",
            },
            twapImpactEstimate: { type: "string" },
          },
        },
        hiddenLiquidityNote: { type: "string" },
        fetchedAt: { type: "string" },
      },
      required: [
        "coin",
        "side",
        "orderSize",
        "canAbsorb",
        "absorption",
        "volumeContext",
      ],
    },
  },

  // ==================== MARKET DATA ====================
  {
    name: "get_market_info",
    description:
      "Get comprehensive market information: price, volume, open interest, funding rate, max leverage, and market health metrics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description: 'Coin symbol (e.g., "HYPE", "BTC")',
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        markPrice: { type: "number" },
        indexPrice: { type: "number" },
        midPrice: { type: "number" },
        premium: {
          type: "number",
          description: "Premium/discount vs index (%)",
        },
        spread: { type: "number", description: "Spread in bps" },
        openInterest: { type: "number", description: "OI in base units" },
        openInterestUsd: { type: "number" },
        fundingRate: { type: "number", description: "Hourly funding rate" },
        fundingRateAnnualized: {
          type: "number",
          description: "Annualized funding %",
        },
        volume24h: { type: "number" },
        priceChange24h: { type: "number" },
        maxLeverage: { type: "number" },
        impactPrices: {
          type: "object",
          description: "Impact bid/ask for $100k orders",
        },
        fetchedAt: { type: "string" },
      },
      required: [
        "coin",
        "markPrice",
        "fundingRate",
        "openInterest",
        "volume24h",
      ],
    },
  },

  {
    name: "list_markets",
    description:
      "List all available perpetual markets on Hyperliquid with prices and basic info.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    outputSchema: {
      type: "object" as const,
      properties: {
        markets: { type: "array" },
        count: { type: "number" },
        fetchedAt: { type: "string" },
      },
      required: ["markets", "count"],
    },
  },

  // ==================== FUNDING ANALYSIS ====================
  {
    name: "get_funding_analysis",
    description:
      "Get comprehensive funding rate analysis including current rates, predicted rates across venues (Binance, Bybit, Hyperliquid), and arbitrage opportunities. Essential for understanding market sentiment and carry trades.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: {
          type: "string",
          description: 'Coin symbol (e.g., "HYPE", "BTC")',
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        currentFunding: {
          type: "object",
          properties: {
            rate: { type: "number" },
            annualized: { type: "number" },
            sentiment: {
              type: "string",
              description: "bullish (longs pay) or bearish (shorts pay)",
            },
          },
        },
        predictedFundings: {
          type: "array",
          description: "Predicted funding rates across venues",
          items: {
            type: "object",
            properties: {
              venue: { type: "string" },
              rate: { type: "number" },
              nextFundingTime: { type: "string" },
            },
          },
        },
        fundingArbitrage: {
          type: "object",
          description: "Funding arbitrage opportunities between venues",
        },
        fetchedAt: { type: "string" },
      },
      required: ["coin", "currentFunding"],
    },
  },

  // ==================== STAKING & DELEGATION ====================
  {
    name: "get_staking_summary",
    description:
      "Get Hyperliquid staking statistics: total HYPE staked, staking APY, validator count, and delegation info. Essential for understanding HYPE token dynamics and potential sell pressure from unstaking.",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeValidators: {
          type: "boolean",
          description: "Include list of top validators (default: false)",
        },
      },
      required: [],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        totalStaked: { type: "number", description: "Total HYPE staked" },
        totalStakedUsd: { type: "number" },
        stakingApy: { type: "number", description: "Current staking APY %" },
        validatorCount: { type: "number" },
        delegationLockup: {
          type: "string",
          description: "Delegation lockup period",
        },
        unstakingQueue: {
          type: "string",
          description: "Unstaking queue period",
        },
        stakingMechanics: {
          type: "object",
          properties: {
            minSelfDelegation: { type: "number" },
            rewardDistribution: { type: "string" },
          },
        },
        validators: {
          type: "array",
          description: "Top validators if requested",
        },
        fetchedAt: { type: "string" },
      },
      required: [
        "totalStaked",
        "stakingApy",
        "delegationLockup",
        "unstakingQueue",
      ],
    },
  },

  {
    name: "get_user_delegations",
    description: "Get staking delegations for a specific wallet address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        address: { type: "string", description: "Wallet address (0x...)" },
      },
      required: ["address"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        address: { type: "string" },
        delegations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              validator: { type: "string" },
              amount: { type: "number" },
              lockedUntil: { type: "string" },
            },
          },
        },
        totalDelegated: { type: "number" },
        fetchedAt: { type: "string" },
      },
      required: ["address", "delegations", "totalDelegated"],
    },
  },

  // ==================== OPEN INTEREST ANALYSIS ====================
  {
    name: "get_open_interest_analysis",
    description:
      "Analyze open interest for a coin: current OI, OI changes, long/short ratio estimation, and OI caps. Useful for understanding market positioning and potential liquidation cascades.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: 'Coin symbol (e.g., "HYPE")' },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        openInterest: { type: "number" },
        openInterestUsd: { type: "number" },
        oiAsPercentOfMarketCap: { type: "number" },
        oiToVolumeRatio: { type: "number", description: "OI/24h volume ratio" },
        fundingImpliedBias: {
          type: "string",
          description: "Long-biased, short-biased, or neutral based on funding",
        },
        atOpenInterestCap: { type: "boolean" },
        liquidationRisk: {
          type: "string",
          description: "Assessment of liquidation cascade risk",
        },
        fetchedAt: { type: "string" },
      },
      required: ["coin", "openInterest", "openInterestUsd"],
    },
  },

  // ==================== HISTORICAL DATA ====================
  {
    name: "get_candles",
    description:
      "Get historical OHLCV candle data for technical analysis. Supports intervals from 1m to 1M.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: 'Coin symbol (e.g., "HYPE")' },
        interval: {
          type: "string",
          enum: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"],
          description: "Candle interval",
        },
        limit: {
          type: "number",
          description: "Number of candles (default 100, max 500)",
        },
      },
      required: ["coin", "interval"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        interval: { type: "string" },
        candles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              time: { type: "string" },
              open: { type: "number" },
              high: { type: "number" },
              low: { type: "number" },
              close: { type: "number" },
              volume: { type: "number" },
            },
          },
        },
        summary: {
          type: "object",
          properties: {
            periodHigh: { type: "number" },
            periodLow: { type: "number" },
            priceChange: { type: "number" },
            totalVolume: { type: "number" },
          },
        },
        fetchedAt: { type: "string" },
      },
      required: ["coin", "interval", "candles"],
    },
  },

  // ==================== RECENT TRADES ====================
  {
    name: "get_recent_trades",
    description:
      "Get recent trades with whale detection. Identifies large trades and calculates buy/sell pressure.",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: 'Coin symbol (e.g., "HYPE")' },
        whaleThresholdUsd: {
          type: "number",
          description: "USD threshold for whale trades (default: $100,000)",
        },
      },
      required: ["coin"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        trades: { type: "array" },
        whaleTrades: {
          type: "array",
          description: "Trades above whale threshold",
        },
        summary: {
          type: "object",
          properties: {
            totalVolume: { type: "number" },
            totalNotional: { type: "number" },
            buyVolume: { type: "number" },
            sellVolume: { type: "number" },
            buyRatio: { type: "number" },
            whaleTradeCount: { type: "number" },
            whaleBuyVolume: { type: "number" },
            whaleSellVolume: { type: "number" },
          },
        },
        fetchedAt: { type: "string" },
      },
      required: ["coin", "trades", "summary"],
    },
  },

  // ==================== COMPREHENSIVE ANALYSIS ====================
  {
    name: "analyze_large_order",
    description:
      "COMPREHENSIVE analysis for large order scenarios (like team unlocks, whale sells). Combines orderbook depth, volume context, funding sentiment, and OI analysis to assess market impact. Perfect for questions like 'can the market absorb X sell pressure?'",
    inputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string", description: 'Coin symbol (e.g., "HYPE")' },
        side: { type: "string", enum: ["sell", "buy"] },
        size: { type: "number", description: "Order size in base units" },
        sizeInUsd: { type: "number", description: "Alternative: size in USD" },
        executionStrategy: {
          type: "string",
          enum: ["market", "twap", "otc"],
          description: "How the order would be executed (default: market)",
        },
      },
      required: ["coin", "side"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        coin: { type: "string" },
        orderSummary: {
          type: "object",
          properties: {
            size: { type: "number" },
            notional: { type: "number" },
            side: { type: "string" },
            asPercentOfDailyVolume: { type: "number" },
            asPercentOfOpenInterest: { type: "number" },
          },
        },
        marketImpact: {
          type: "object",
          properties: {
            immediateImpact: { type: "string" },
            visibleBookAbsorption: {
              type: "number",
              description: "% fillable by visible book",
            },
            estimatedSlippage: { type: "number" },
            priceDropEstimate: { type: "string" },
          },
        },
        executionRecommendation: {
          type: "object",
          properties: {
            recommendedStrategy: { type: "string" },
            twapDuration: { type: "string" },
            expectedImpactWithTwap: { type: "string" },
            otcRecommendation: { type: "string" },
          },
        },
        marketContext: {
          type: "object",
          properties: {
            currentPrice: { type: "number" },
            volume24h: { type: "number" },
            openInterest: { type: "number" },
            fundingSentiment: { type: "string" },
            bidLiquidity: { type: "number" },
            askLiquidity: { type: "number" },
          },
        },
        reflexivityRisk: {
          type: "object",
          description: "Risk of cascading effects from other traders",
          properties: {
            riskLevel: { type: "string" },
            potentialCascade: { type: "string" },
            worstCaseImpact: { type: "string" },
          },
        },
        conclusion: { type: "string" },
        fetchedAt: { type: "string" },
      },
      required: [
        "coin",
        "orderSummary",
        "marketImpact",
        "executionRecommendation",
        "conclusion",
      ],
    },
  },

  // ==================== PERPS AT OI CAP ====================
  {
    name: "get_markets_at_oi_cap",
    description:
      "Get list of perpetual markets currently at their open interest caps. These markets have limited capacity for new positions.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    outputSchema: {
      type: "object" as const,
      properties: {
        marketsAtCap: { type: "array", items: { type: "string" } },
        count: { type: "number" },
        note: { type: "string" },
        fetchedAt: { type: "string" },
      },
      required: ["marketsAtCap", "count"],
    },
  },
];

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

const server = new Server(
  { name: "hyperliquid-ultimate", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_orderbook":
          return await handleGetOrderbook(args);
        case "calculate_price_impact":
          return await handleCalculatePriceImpact(args);
        case "get_market_info":
          return await handleGetMarketInfo(args);
        case "list_markets":
          return await handleListMarkets();
        case "get_funding_analysis":
          return await handleGetFundingAnalysis(args);
        case "get_staking_summary":
          return await handleGetStakingSummary(args);
        case "get_user_delegations":
          return await handleGetUserDelegations(args);
        case "get_open_interest_analysis":
          return await handleGetOpenInterestAnalysis(args);
        case "get_candles":
          return await handleGetCandles(args);
        case "get_recent_trades":
          return await handleGetRecentTrades(args);
        case "analyze_large_order":
          return await handleAnalyzeLargeOrder(args);
        case "get_markets_at_oi_cap":
          return await handleGetMarketsAtOiCap();
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

function successResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

async function handleGetOrderbook(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  if (!coin) {
    return errorResult("coin parameter is required");
  }

  const nSigFigs = args?.nSigFigs as number | undefined;
  const [bookData, metaAndCtx] = await Promise.all([
    fetchL2Book(coin, nSigFigs),
    fetchMetaAndAssetCtxs(),
  ]);

  const parsed = parseOrderbook(bookData, coin);
  const volume24h = getVolume24h(metaAndCtx, coin);

  const bidLiquidityPercent =
    volume24h > 0 ? (parsed.totalBidLiquidity / volume24h) * 100 : 0;
  const askLiquidityPercent =
    volume24h > 0 ? (parsed.totalAskLiquidity / volume24h) * 100 : 0;

  let liquidityScore: string;
  if (bidLiquidityPercent > 5) {
    liquidityScore = "deep";
  } else if (bidLiquidityPercent > 1) {
    liquidityScore = "moderate";
  } else if (bidLiquidityPercent > 0.1) {
    liquidityScore = "thin";
  } else {
    liquidityScore = "very thin";
  }

  return successResult({
    ...parsed,
    liquidityContext: {
      bidLiquidityAsPercentOfDailyVolume: Number(
        bidLiquidityPercent.toFixed(4)
      ),
      askLiquidityAsPercentOfDailyVolume: Number(
        askLiquidityPercent.toFixed(4)
      ),
      volume24h,
      liquidityScore,
    },
    note: "Visible orderbook only shows ~20 levels. Hidden liquidity, market makers, and OTC desks provide additional absorption capacity not reflected here.",
  });
}

async function handleCalculatePriceImpact(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  const side = args?.side as "sell" | "buy";
  let size = args?.size as number | undefined;
  const sizeInUsd = args?.sizeInUsd as number | undefined;

  if (!coin) {
    return errorResult("coin parameter is required");
  }
  if (!side || !["sell", "buy"].includes(side)) {
    return errorResult("side must be 'sell' or 'buy'");
  }

  const [bookData, metaAndCtx] = await Promise.all([
    fetchL2Book(coin),
    fetchMetaAndAssetCtxs(),
  ]);

  const parsed = parseOrderbook(bookData, coin);
  const volume24h = getVolume24h(metaAndCtx, coin);

  if (sizeInUsd && !size) {
    size = sizeInUsd / parsed.midPrice;
  }
  if (!size || size <= 0) {
    return errorResult("size or sizeInUsd required");
  }

  const impact = calculatePriceImpact(parsed, side, size);
  const orderNotional = size * parsed.midPrice;
  const orderAsPercentOfVolume =
    volume24h > 0 ? (orderNotional / volume24h) * 100 : 0;

  // Estimate TWAP duration for minimal impact
  let twapDuration: string;
  let twapImpact: string;
  if (orderAsPercentOfVolume < 1) {
    twapDuration = "1-2 hours";
    twapImpact = "minimal (<0.1%)";
  } else if (orderAsPercentOfVolume < 5) {
    twapDuration = "4-8 hours";
    twapImpact = "low (0.1-0.5%)";
  } else if (orderAsPercentOfVolume < 15) {
    twapDuration = "12-24 hours";
    twapImpact = "moderate (0.5-2%)";
  } else {
    twapDuration = "2-5 days or OTC recommended";
    twapImpact = "significant (2%+) even with TWAP";
  }

  return successResult({
    ...impact,
    volumeContext: {
      orderAsPercentOfDailyVolume: Number(orderAsPercentOfVolume.toFixed(2)),
      volume24h,
      estimatedTwapDuration: twapDuration,
      twapImpactEstimate: twapImpact,
    },
    hiddenLiquidityNote:
      "Visible book capacity is limited. Professional market makers (like Flowdesk) use TWAP/algorithmic execution to minimize impact. OTC desks can absorb large blocks without market impact.",
  });
}

async function handleGetMarketInfo(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  if (!coin) {
    return errorResult("coin parameter is required");
  }

  const [metaAndCtx, bookData, mids] = await Promise.all([
    fetchMetaAndAssetCtxs(),
    fetchL2Book(coin),
    fetchAllMids(),
  ]);

  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    throw new Error(`Coin ${coin} not found`);
  }

  const asset = meta.universe[idx];
  const ctx = ctxs[idx];
  const parsed = parseOrderbook(bookData, coin);

  const markPrice = Number(ctx.markPx || mids[coin] || 0);
  const indexPrice = Number(ctx.oraclePx || 0);
  const openInterest = Number(ctx.openInterest || 0);
  const fundingRate = Number(ctx.funding || 0);
  const volume24h = Number(ctx.dayNtlVlm || 0);
  const prevDayPx = Number(ctx.prevDayPx || 0);
  const premium = Number(ctx.premium || 0);
  const impactPxs = (ctx as unknown as { impactPxs?: string[] }).impactPxs;

  return successResult({
    coin,
    markPrice,
    indexPrice,
    midPrice: parsed.midPrice,
    premium: Number((premium * 100).toFixed(4)),
    spread: parsed.spread,
    openInterest,
    openInterestUsd: openInterest * markPrice,
    fundingRate,
    fundingRateAnnualized: fundingRate * 24 * 365 * 100,
    volume24h,
    priceChange24h:
      prevDayPx > 0
        ? Number((((markPrice - prevDayPx) / prevDayPx) * 100).toFixed(2))
        : 0,
    maxLeverage: asset.maxLeverage,
    impactPrices: impactPxs
      ? { impactBid: Number(impactPxs[0]), impactAsk: Number(impactPxs[1]) }
      : null,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleListMarkets(): Promise<CallToolResult> {
  const [meta, mids] = await Promise.all([fetchMeta(), fetchAllMids()]);

  const markets = meta.universe.map((asset) => ({
    symbol: asset.name,
    markPrice: Number(mids[asset.name] || 0),
    maxLeverage: asset.maxLeverage,
    szDecimals: asset.szDecimals,
  }));

  return successResult({
    markets,
    count: markets.length,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetFundingAnalysis(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  if (!coin) {
    return errorResult("coin parameter is required");
  }

  const [metaAndCtx, predictedFundings] = await Promise.all([
    fetchMetaAndAssetCtxs(),
    fetchPredictedFundings(),
  ]);

  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    throw new Error(`Coin ${coin} not found`);
  }

  const ctx = ctxs[idx];
  const fundingRate = Number(ctx.funding || 0);
  const annualized = fundingRate * 24 * 365 * 100;

  // Find predicted fundings for this coin
  const coinPredictions = predictedFundings.find(
    (p: [string, unknown[]]) => p[0] === coin
  );
  const predictions: Array<{
    venue: string;
    rate: number;
    nextFundingTime: string;
  }> = [];

  if (coinPredictions && Array.isArray(coinPredictions[1])) {
    for (const pred of coinPredictions[1]) {
      const [venue, data] = pred as [
        string,
        { fundingRate: string; nextFundingTime: number },
      ];
      predictions.push({
        venue,
        rate: Number(data.fundingRate),
        nextFundingTime: new Date(data.nextFundingTime).toISOString(),
      });
    }
  }

  // Calculate arbitrage opportunities
  const hlRate =
    predictions.find((p) => p.venue === "HlPerp")?.rate ?? fundingRate;
  const binRate = predictions.find((p) => p.venue === "BinPerp")?.rate;
  // Calculate arbitrage opportunities between venues
  let arbitrageOpportunity: {
    strategy: string;
    annualizedSpread: string;
  } | null = null;

  if (binRate !== undefined) {
    const diff = (binRate - hlRate) * 24 * 365 * 100;
    if (Math.abs(diff) > 5) {
      arbitrageOpportunity = {
        strategy:
          diff > 0 ? "Long HL, Short Binance" : "Short HL, Long Binance",
        annualizedSpread: `${Math.abs(diff).toFixed(2)}%`,
      };
    }
  }

  return successResult({
    coin,
    currentFunding: {
      rate: fundingRate,
      annualized: Number(annualized.toFixed(2)),
      sentiment:
        fundingRate > 0
          ? "bullish (longs pay shorts)"
          : fundingRate < 0
            ? "bearish (shorts pay longs)"
            : "neutral",
    },
    predictedFundings: predictions,
    fundingArbitrage: arbitrageOpportunity,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetStakingSummary(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  // Note: Hyperliquid staking stats aren't directly available via public API
  // This provides the mechanics and known info
  const includeValidators = (args?.includeValidators as boolean) ?? false;

  // Get HYPE price for USD conversion
  const mids = await fetchAllMids();
  const hypePrice = Number(mids.HYPE || 0);

  return successResult({
    stakingMechanics: {
      delegationLockup: "1 day",
      unstakingQueue: "7 days",
      minValidatorSelfDelegation: 10_000,
      rewardDistribution:
        "Accrued every minute, distributed daily, auto-redelegated",
      rewardFormula: "Inversely proportional to sqrt(total HYPE staked)",
    },
    currentHypePrice: hypePrice,
    note: "Staking stats are not directly available via public API. Use app.hyperliquid.xyz/staking for current totals. Unstaking takes 7 days - monitor for large unstakes as potential sell pressure.",
    validators: includeValidators
      ? "Use https://stake.nansen.ai/stake/hyperliquid or https://hypurrscan.io/staking for validator list"
      : null,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetUserDelegations(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const address = args?.address as string;
  if (!address) {
    return errorResult("address parameter is required");
  }

  const delegations = await fetchDelegations(address);

  const parsed = delegations.map(
    (d: {
      validator: string;
      amount: string;
      lockedUntilTimestamp: number;
    }) => ({
      validator: d.validator,
      amount: Number(d.amount),
      lockedUntil: new Date(d.lockedUntilTimestamp).toISOString(),
    })
  );

  const totalDelegated = parsed.reduce(
    (sum: number, d: { amount: number }) => sum + d.amount,
    0
  );

  return successResult({
    address,
    delegations: parsed,
    totalDelegated,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetOpenInterestAnalysis(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  if (!coin) {
    return errorResult("coin parameter is required");
  }

  const [metaAndCtx, marketsAtCap] = await Promise.all([
    fetchMetaAndAssetCtxs(),
    fetchPerpsAtOiCap(),
  ]);

  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    throw new Error(`Coin ${coin} not found`);
  }

  const ctx = ctxs[idx];
  const openInterest = Number(ctx.openInterest || 0);
  const markPrice = Number(ctx.markPx || 0);
  const volume24h = Number(ctx.dayNtlVlm || 0);
  const fundingRate = Number(ctx.funding || 0);
  const oiUsd = openInterest * markPrice;

  const oiToVolumeRatio = volume24h > 0 ? oiUsd / volume24h : 0;
  const atCap = marketsAtCap.includes(coin);

  let fundingBias: string;
  if (fundingRate > 0.0001) {
    fundingBias = "heavily long-biased";
  } else if (fundingRate > 0) {
    fundingBias = "slightly long-biased";
  } else if (fundingRate < -0.0001) {
    fundingBias = "heavily short-biased";
  } else if (fundingRate < 0) {
    fundingBias = "slightly short-biased";
  } else {
    fundingBias = "neutral";
  }

  let liquidationRisk: string;
  if (oiToVolumeRatio > 3) {
    liquidationRisk = "high - large OI relative to volume could cause cascades";
  } else if (oiToVolumeRatio > 1.5) {
    liquidationRisk = "moderate - significant OI concentration";
  } else {
    liquidationRisk = "low - healthy OI/volume ratio";
  }

  return successResult({
    coin,
    openInterest,
    openInterestUsd: oiUsd,
    oiToVolumeRatio: Number(oiToVolumeRatio.toFixed(2)),
    fundingImpliedBias: fundingBias,
    atOpenInterestCap: atCap,
    liquidationRisk,
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetCandles(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  const interval = args?.interval as string;
  const limit = Math.min((args?.limit as number) || 100, 500);

  if (!coin) {
    return errorResult("coin parameter is required");
  }
  if (!interval) {
    return errorResult("interval parameter is required");
  }

  const now = Date.now();
  const intervalMs = getIntervalMs(interval);
  const startTime = now - intervalMs * limit;

  const candles = await fetchCandleSnapshot(coin, interval, startTime, now);

  const parsed = candles.map(
    (c: {
      t: number;
      o: string;
      h: string;
      l: string;
      c: string;
      v: string;
    }) => ({
      time: new Date(c.t).toISOString(),
      open: Number(c.o),
      high: Number(c.h),
      low: Number(c.l),
      close: Number(c.c),
      volume: Number(c.v),
    })
  );

  const highs = parsed.map((c: { high: number }) => c.high);
  const lows = parsed.map((c: { low: number }) => c.low);
  const volumes = parsed.map((c: { volume: number }) => c.volume);
  const firstClose = parsed.at(0)?.close ?? 0;
  const lastClose = parsed.at(-1)?.close ?? 0;

  return successResult({
    coin,
    interval,
    candles: parsed,
    summary: {
      periodHigh: Math.max(...highs),
      periodLow: Math.min(...lows),
      priceChange:
        firstClose > 0
          ? Number((((lastClose - firstClose) / firstClose) * 100).toFixed(2))
          : 0,
      totalVolume: volumes.reduce((a: number, b: number) => a + b, 0),
    },
    fetchedAt: new Date().toISOString(),
  });
}

async function handleGetRecentTrades(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  const whaleThreshold = (args?.whaleThresholdUsd as number) || 100_000;

  if (!coin) {
    return errorResult("coin parameter is required");
  }

  const trades = await fetchRecentTrades(coin);
  const tradesArray = Array.isArray(trades) ? trades : [trades];

  let totalVolume = 0;
  let totalNotional = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let whaleBuyVolume = 0;
  let whaleSellVolume = 0;
  const whaleTrades: Record<string, unknown>[] = [];

  const parsed = tradesArray.slice(0, 100).map((t) => {
    const price = Number(t.px);
    const size = Number(t.sz);
    const notional = price * size;
    const side = t.side.toLowerCase() === "b" ? "buy" : "sell";

    totalVolume += size;
    totalNotional += notional;
    if (side === "buy") {
      buyVolume += size;
    } else {
      sellVolume += size;
    }

    const trade = {
      price,
      size,
      notional: Number(notional.toFixed(2)),
      side,
      time: new Date(t.time).toISOString(),
      isWhale: notional >= whaleThreshold,
    };

    if (notional >= whaleThreshold) {
      whaleTrades.push(trade);
      if (side === "buy") {
        whaleBuyVolume += size;
      } else {
        whaleSellVolume += size;
      }
    }

    return trade;
  });

  return successResult({
    coin,
    trades: parsed,
    whaleTrades,
    summary: {
      totalVolume,
      totalNotional: Number(totalNotional.toFixed(2)),
      buyVolume,
      sellVolume,
      buyRatio:
        totalVolume > 0
          ? Number(((buyVolume / totalVolume) * 100).toFixed(2))
          : 50,
      whaleTradeCount: whaleTrades.length,
      whaleBuyVolume,
      whaleSellVolume,
      whaleNetFlow: whaleBuyVolume - whaleSellVolume,
    },
    fetchedAt: new Date().toISOString(),
  });
}

async function handleAnalyzeLargeOrder(
  args: Record<string, unknown> | undefined
): Promise<CallToolResult> {
  const coin = args?.coin as string;
  const side = args?.side as "sell" | "buy";
  let size = args?.size as number | undefined;
  const sizeInUsd = args?.sizeInUsd as number | undefined;
  const _strategy = (args?.executionStrategy as string) || "market";

  if (!coin) {
    return errorResult("coin parameter is required");
  }
  if (!side) {
    return errorResult("side parameter is required");
  }

  const [bookData, metaAndCtx] = await Promise.all([
    fetchL2Book(coin),
    fetchMetaAndAssetCtxs(),
  ]);

  const parsed = parseOrderbook(bookData, coin);
  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    throw new Error(`Coin ${coin} not found`);
  }

  const ctx = ctxs[idx];
  const volume24h = Number(ctx.dayNtlVlm || 0);
  const openInterest = Number(ctx.openInterest || 0);
  const fundingRate = Number(ctx.funding || 0);
  const markPrice = Number(ctx.markPx || parsed.midPrice);

  if (sizeInUsd && !size) {
    size = sizeInUsd / parsed.midPrice;
  }
  if (!size || size <= 0) {
    return errorResult("size or sizeInUsd required");
  }

  const orderNotional = size * parsed.midPrice;
  const impact = calculatePriceImpact(parsed, side, size);

  const asPercentOfVolume =
    volume24h > 0 ? (orderNotional / volume24h) * 100 : 0;
  const asPercentOfOI = openInterest > 0 ? (size / openInterest) * 100 : 0;

  // Determine immediate impact
  let immediateImpact: string;
  if (impact.canAbsorb && impact.slippageBps < 50) {
    immediateImpact =
      "manageable - visible book can absorb with minor slippage";
  } else if (impact.canAbsorb) {
    immediateImpact = "significant - would move price but book absorbs";
  } else {
    immediateImpact = "severe - would exhaust visible liquidity";
  }

  // Estimate realistic price drop
  let priceDropEstimate: string;
  if (asPercentOfVolume < 2) {
    priceDropEstimate = "1-3% with market order, <0.5% with TWAP";
  } else if (asPercentOfVolume < 10) {
    priceDropEstimate = "3-8% with market order, 1-3% with TWAP";
  } else if (asPercentOfVolume < 30) {
    priceDropEstimate = "8-15% with market order, 3-5% with TWAP";
  } else {
    priceDropEstimate = "15%+ likely, recommend OTC";
  }

  // Execution recommendation
  let recommendedStrategy: string;
  let twapDuration: string;
  let twapImpact: string;
  let otcRec: string;

  if (asPercentOfVolume < 1) {
    recommendedStrategy = "Market order acceptable";
    twapDuration = "Not necessary";
    twapImpact = "N/A";
    otcRec = "Not needed for this size";
  } else if (asPercentOfVolume < 5) {
    recommendedStrategy = "TWAP recommended";
    twapDuration = "4-8 hours";
    twapImpact = "<1% expected";
    otcRec = "Optional - TWAP sufficient";
  } else if (asPercentOfVolume < 15) {
    recommendedStrategy = "Extended TWAP or split execution";
    twapDuration = "12-24 hours";
    twapImpact = "1-3% expected";
    otcRec = "Consider for portion of order";
  } else {
    recommendedStrategy = "OTC strongly recommended";
    twapDuration = "2-5 days if on-exchange";
    twapImpact = "3-5%+ even with long TWAP";
    otcRec = "Highly recommended - contact Flowdesk, Wintermute, or similar";
  }

  // Reflexivity risk
  let reflexivityRisk: string;
  let cascadePotential: string;
  let worstCase: string;

  if (asPercentOfVolume < 5 && fundingRate > 0) {
    reflexivityRisk = "low";
    cascadePotential = "Unlikely to trigger panic selling";
    worstCase = "Add 2-3% to base estimate";
  } else if (asPercentOfVolume < 15) {
    reflexivityRisk = "moderate";
    cascadePotential = "May trigger some copycat selling and long liquidations";
    worstCase = "Add 5-8% to base estimate";
  } else {
    reflexivityRisk = "high";
    cascadePotential =
      "Could trigger significant liquidation cascade and panic";
    worstCase = "Double the base estimate possible";
  }

  // Generate conclusion
  const conclusion = generateConclusion({
    side,
    volumePercent: asPercentOfVolume,
    visibleAbsorption: impact.filledPercent,
    strategy: recommendedStrategy,
    funding: fundingRate,
  });

  return successResult({
    coin,
    orderSummary: {
      size,
      notional: orderNotional,
      side,
      asPercentOfDailyVolume: Number(asPercentOfVolume.toFixed(2)),
      asPercentOfOpenInterest: Number(asPercentOfOI.toFixed(2)),
    },
    marketImpact: {
      immediateImpact,
      visibleBookAbsorption: impact.filledPercent,
      estimatedSlippage: impact.slippageBps,
      priceDropEstimate,
    },
    executionRecommendation: {
      recommendedStrategy,
      twapDuration,
      expectedImpactWithTwap: twapImpact,
      otcRecommendation: otcRec,
    },
    marketContext: {
      currentPrice: markPrice,
      volume24h,
      openInterest,
      openInterestUsd: openInterest * markPrice,
      fundingSentiment:
        fundingRate > 0
          ? "longs paying (bullish bias)"
          : "shorts paying (bearish bias)",
      bidLiquidity: parsed.totalBidLiquidity,
      askLiquidity: parsed.totalAskLiquidity,
    },
    reflexivityRisk: {
      riskLevel: reflexivityRisk,
      potentialCascade: cascadePotential,
      worstCaseImpact: worstCase,
    },
    conclusion,
    fetchedAt: new Date().toISOString(),
  });
}

function generateConclusion(opts: {
  side: string;
  volumePercent: number;
  visibleAbsorption: number;
  strategy: string;
  funding: number;
}): string {
  const { side, volumePercent, visibleAbsorption, strategy, funding } = opts;
  const sideWord = side === "sell" ? "sell" : "buy";

  if (volumePercent < 2) {
    return `This ${sideWord} order represents only ${volumePercent.toFixed(1)}% of daily volume and can be executed on-exchange with minimal impact. ${strategy}.`;
  }

  if (volumePercent < 10) {
    return `This ${sideWord} order is ${volumePercent.toFixed(1)}% of daily volume. The visible orderbook can only absorb ${visibleAbsorption.toFixed(1)}%, but with proper TWAP execution over several hours, impact can be minimized to 1-3%. ${funding > 0 ? "Positive funding suggests long-biased market which may amplify sell impact." : ""}`;
  }

  if (volumePercent < 30) {
    return `Significant ${sideWord} pressure at ${volumePercent.toFixed(1)}% of daily volume. Visible book absorption is only ${visibleAbsorption.toFixed(1)}%. Extended TWAP (12-24h) or partial OTC execution recommended. Expect 3-8% price impact even with careful execution. Reflexive selling from other participants could compound the move.`;
  }

  return `Very large ${sideWord} order at ${volumePercent.toFixed(1)}% of daily volume. This would severely impact the market if executed on-exchange. OTC execution strongly recommended. If executed on-exchange, expect double-digit percentage impact with high risk of liquidation cascades and reflexive panic ${side === "sell" ? "selling" : "buying"}.`;
}

async function handleGetMarketsAtOiCap(): Promise<CallToolResult> {
  const markets = await fetchPerpsAtOiCap();

  return successResult({
    marketsAtCap: markets,
    count: markets.length,
    note: "Markets at OI cap have limited capacity for new positions. This can create supply/demand imbalances.",
    fetchedAt: new Date().toISOString(),
  });
}

// ============================================================================
// API FETCH FUNCTIONS
// ============================================================================

async function hyperliquidPost(body: object): Promise<unknown> {
  const response = await fetch(HYPERLIQUID_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Hyperliquid API error (${response.status}): ${text.slice(0, 200)}`
    );
  }

  return response.json();
}

function fetchL2Book(coin: string, nSigFigs?: number): Promise<L2BookResponse> {
  const body: Record<string, unknown> = { type: "l2Book", coin };
  if (nSigFigs) {
    body.nSigFigs = nSigFigs;
  }
  return hyperliquidPost(body) as Promise<L2BookResponse>;
}

function fetchMeta(): Promise<MetaResponse> {
  return hyperliquidPost({ type: "meta" }) as Promise<MetaResponse>;
}

function fetchAllMids(): Promise<AllMidsResponse> {
  return hyperliquidPost({ type: "allMids" }) as Promise<AllMidsResponse>;
}

function fetchMetaAndAssetCtxs(): Promise<MetaAndAssetCtxsResponse> {
  return hyperliquidPost({
    type: "metaAndAssetCtxs",
  }) as Promise<MetaAndAssetCtxsResponse>;
}

function fetchRecentTrades(coin: string): Promise<RecentTradesResponse[]> {
  return hyperliquidPost({ type: "recentTrades", coin }) as Promise<
    RecentTradesResponse[]
  >;
}

function fetchPredictedFundings(): Promise<[string, unknown[]][]> {
  return hyperliquidPost({ type: "predictedFundings" }) as Promise<
    [string, unknown[]][]
  >;
}

function fetchDelegations(
  user: string
): Promise<
  Array<{ validator: string; amount: string; lockedUntilTimestamp: number }>
> {
  return hyperliquidPost({ type: "delegations", user }) as Promise<
    Array<{ validator: string; amount: string; lockedUntilTimestamp: number }>
  >;
}

function fetchPerpsAtOiCap(): Promise<string[]> {
  return hyperliquidPost({ type: "perpsAtOpenInterestCaps" }) as Promise<
    string[]
  >;
}

function fetchCandleSnapshot(
  coin: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<
  Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>
> {
  return hyperliquidPost({
    type: "candleSnapshot",
    req: { coin, interval, startTime, endTime },
  }) as Promise<
    Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>
  >;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type L2Level = {
  px: string;
  sz: string;
  n: number;
};

type L2BookResponse = {
  coin: string;
  time: number;
  levels: [L2Level[], L2Level[]];
};

type MetaResponse = {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
  }>;
};

type AllMidsResponse = {
  [coin: string]: string;
};

type AssetCtx = {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium?: string;
  oraclePx?: string;
  markPx?: string;
};

type MetaAndAssetCtxsResponse = {
  0: MetaResponse;
  1: AssetCtx[];
};

type RecentTradesResponse = {
  coin: string;
  side: string;
  px: string;
  sz: string;
  time: number;
  hash: string;
};

type OrderbookLevel = {
  price: number;
  size: number;
  numOrders: number;
  cumulativeSize: number;
  cumulativeNotional: number;
};

type ParsedOrderbook = {
  coin: string;
  midPrice: number;
  spread: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  totalBidLiquidity: number;
  totalAskLiquidity: number;
  fetchedAt: string;
};

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

function parseOrderbook(data: L2BookResponse, coin: string): ParsedOrderbook {
  const [rawBids, rawAsks] = data.levels;

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
  const spread = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10_000 : 0;

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
): {
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
} {
  const levels = side === "sell" ? book.bids : book.asks;
  const midPrice = book.midPrice;

  let remainingSize = size;
  let totalFilled = 0;
  let totalNotional = 0;
  let levelsConsumed = 0;
  let worstPrice = midPrice;

  for (const level of levels) {
    if (remainingSize <= 0) {
      break;
    }
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

function getVolume24h(
  metaAndCtx: MetaAndAssetCtxsResponse,
  coin: string
): number {
  const meta = metaAndCtx[0];
  const ctxs = metaAndCtx[1];
  const idx = meta.universe.findIndex((u) => u.name === coin);
  if (idx === -1) {
    return 0;
  }
  return Number(ctxs[idx].dayNtlVlm || 0);
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
  };
  return map[interval] || 60 * 60 * 1000;
}

// ============================================================================
// EXPRESS SERVER
// ============================================================================

const app = express();
app.use(express.json());

const transports: Record<string, SSEServerTransport> = {};

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "hyperliquid-ultimate",
    version: "2.0.0",
    tools: TOOLS.map((t) => t.name),
    description: "The world's most comprehensive Hyperliquid MCP server",
  });
});

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

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({ error: "No transport found for sessionId" });
  }
});

const port = Number(process.env.PORT || 4002);
app.listen(port, () => {
  console.log("\n🚀 Hyperliquid Ultimate MCP Server v2.0.0");
  console.log(`   The world's most comprehensive Hyperliquid MCP\n`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
  console.log(`💚 Health check: http://localhost:${port}/health\n`);
  console.log(`🛠️  Available tools (${TOOLS.length}):`);
  for (const tool of TOOLS) {
    console.log(`   • ${tool.name}`);
  }
  console.log("");
});
