# Hyperliquid Orderbook MCP Server

This MCP server provides tools for analyzing Hyperliquid perpetual markets, orderbook depth, and price impact. It's designed to help answer questions like:

> "Can the market absorb a $20M sell order for HYPE without significant slippage?"

## Use Case

When the HyperLiquid team unstaked 2.6M $HYPE ($89.2M) and sent 609,108 HYPE ($20.9M) to Flowdesk, this server can analyze:

1. **Current orderbook depth** - How much bid liquidity exists at each price level?
2. **Price impact simulation** - If 609K HYPE were sold, what would be the average fill price and slippage?
3. **Market absorption capacity** - Can the visible orderbook absorb this flow, or would it exhaust liquidity?

## Tools

### `get_orderbook`
Get the L2 orderbook with bid/ask levels, cumulative depth, and liquidity metrics.

### `calculate_price_impact`
**The key tool** - Simulate selling/buying a specific amount and get:
- Average fill price
- Price impact percentage
- Slippage in basis points
- Whether visible book can absorb the order
- Human-readable absorption assessment

### `list_markets`
List all available perpetual markets on Hyperliquid.

### `get_market_info`
Get detailed market info: mark price, funding rate, open interest, 24h volume.

### `get_recent_trades`
Analyze recent trades for volume and buy/sell patterns.

## Setup

```bash
cd examples/hyperliquid-contributor
pnpm install
pnpm run dev
```

The server runs on `http://localhost:4002` by default.

## Endpoints

- **SSE**: `http://localhost:4002/sse` - MCP connection endpoint
- **Health**: `http://localhost:4002/health` - Health check with available tools

## Example: Analyzing HYPE Sell Pressure

With Context, you can ask:

> "The HyperLiquid team is sending 609,108 HYPE ($20.9M) to Flowdesk. Using the Hyperliquid orderbook data, can the market effectively absorb this sell flow? If not, by how much would the price rerate lower?"

The agent will:
1. Call `get_orderbook` for HYPE to see current liquidity
2. Call `calculate_price_impact` with `side: "sell"` and `size: 609108`
3. Call `get_market_info` for additional context (volume, open interest)
4. Synthesize the data to answer your question

## Technical Details

- **No API key required** - Hyperliquid's public API is used
- **Real-time data** - Each call fetches live orderbook state
- **Price impact calculation** - Walks through orderbook levels to simulate execution

## Output Schema

All tools return structured JSON with `outputSchema` defined for reliable AI parsing. Example price impact response:

```json
{
  "coin": "HYPE",
  "side": "sell",
  "orderSize": 609108,
  "orderNotional": 20912808,
  "midPrice": 34.35,
  "averageFillPrice": 34.12,
  "worstFillPrice": 33.85,
  "priceImpactPercent": -0.67,
  "slippageBps": 67,
  "filledSize": 609108,
  "filledPercent": 100,
  "remainingSize": 0,
  "levelsConsumed": 24,
  "canAbsorb": true,
  "absorption": "absorbed with moderate impact"
}
```

## Contributing to Context

To add this MCP server to the Context marketplace:

1. Deploy your server publicly (Railway, Fly.io, AWS, etc.)
2. Go to [Context Contribute](https://context.xyz/contribute)
3. Select "MCP Tool"
4. Enter your SSE endpoint URL
5. Skills are auto-discovered via `listTools()`

## License

MIT

