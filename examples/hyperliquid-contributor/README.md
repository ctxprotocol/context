# Hyperliquid Ultimate MCP Server v2.0

The world's most comprehensive Hyperliquid MCP server. Enables AI agents to analyze orderbook depth, simulate price impact, track funding rates, monitor staking flows, and answer complex questions like:

> "The HyperLiquid team sent 609,108 HYPE ($20.9M) to Flowdesk. Can the market absorb this sell pressure? By how much would the price drop?"

## 🚀 Features

### Orderbook & Liquidity Analysis
- **get_orderbook** - L2 orderbook with cumulative depth, liquidity scores, and volume context
- **calculate_price_impact** - Simulate order execution with TWAP duration estimates
- **analyze_large_order** - Comprehensive analysis for large orders (team unlocks, whale sells)

### Market Data
- **get_market_info** - Price, volume, OI, funding, max leverage, impact prices
- **list_markets** - All available perpetual markets
- **get_candles** - Historical OHLCV data for any interval

### Funding & Sentiment
- **get_funding_analysis** - Current and predicted funding rates across Binance, Bybit, Hyperliquid
- **get_open_interest_analysis** - OI analysis with liquidation risk assessment

### Staking & Flows
- **get_staking_summary** - Staking mechanics, lockup periods, APY info
- **get_user_delegations** - Query any wallet's staking delegations

### Trade Analysis
- **get_recent_trades** - Recent trades with whale detection
- **get_markets_at_oi_cap** - Markets at open interest capacity

## 📦 Setup

```bash
cd examples/hyperliquid-contributor
pnpm install
pnpm run dev
```

Server runs on `http://localhost:4002`.

## 🔌 Endpoints

- **SSE**: `http://localhost:4002/sse` - MCP connection
- **Health**: `http://localhost:4002/health` - Status check

## 💡 Example Questions This MCP Can Answer

### Market Absorption Analysis
> "Can the market absorb 609,000 HYPE being sold?"

Uses `analyze_large_order` to provide:
- % of daily volume the order represents
- Visible orderbook absorption capacity
- TWAP duration recommendation
- Reflexivity risk assessment
- Price impact estimates

### Funding Arbitrage
> "Is there a funding arbitrage opportunity between Hyperliquid and Binance for ETH?"

Uses `get_funding_analysis` to compare rates across venues.

### Staking Flow Analysis
> "The team unstaked 2.6M HYPE. When will it hit the market?"

Uses `get_staking_summary` to explain the 7-day unstaking queue.

### Liquidation Risk
> "Is HYPE at risk of liquidation cascades?"

Uses `get_open_interest_analysis` to assess OI/volume ratio and funding bias.

## 🎯 Key Improvements over v1.0

1. **Volume Context** - Every orderbook analysis includes comparison to 24h volume
2. **TWAP Estimation** - Recommends execution duration for minimal impact
3. **Hidden Liquidity Notes** - Explains that visible book ≠ total liquidity
4. **Funding Predictions** - Multi-venue funding rate comparison
5. **Staking Mechanics** - Full documentation of lockup/unstaking periods
6. **Comprehensive Analysis** - `analyze_large_order` combines 6+ data sources

## 📊 Output Schema

All tools return `structuredContent` for reliable AI parsing. Example:

```json
{
  "coin": "HYPE",
  "orderSummary": {
    "size": 609108,
    "notional": 20357607,
    "asPercentOfDailyVolume": 6.1
  },
  "marketImpact": {
    "immediateImpact": "severe - would exhaust visible liquidity",
    "visibleBookAbsorption": 1.1,
    "priceDropEstimate": "3-8% with market order, 1-3% with TWAP"
  },
  "executionRecommendation": {
    "recommendedStrategy": "TWAP recommended",
    "twapDuration": "4-8 hours",
    "otcRecommendation": "Optional - TWAP sufficient"
  },
  "reflexivityRisk": {
    "riskLevel": "moderate",
    "worstCaseImpact": "Add 5-8% to base estimate"
  },
  "conclusion": "This sell order is 6.1% of daily volume..."
}
```

## 🌐 Deploying to Production

Deploy to Railway, Fly.io, or Render:

```bash
# Railway
railway up

# Fly.io
fly launch
fly deploy
```

Then register on Context: `https://context.xyz/contribute`

## 📚 API Reference

Based on [Hyperliquid API Documentation](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api).

- L2 Book: 20 levels per side
- Funding: Hourly rate
- Candles: 1m to 1M intervals
- Delegations: Requires wallet address

## License

MIT
