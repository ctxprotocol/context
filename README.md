<div align="center">
  
  # Context Protocol

  **The Monetization Layer for MCP.**
  
  [![License: BUSL 1.1](https://img.shields.io/badge/License-BUSL%201.1-blue.svg)](https://github.com/ctxprotocol/context/blob/main/LICENSE)
  [![Twitter Follow](https://img.shields.io/twitter/follow/ctxprotocol?style=social)](https://twitter.com/ctxprotocol)

<p align="center">
    Context is the decentralized marketplace for <a href="https://modelcontextprotocol.io">Model Context Protocol (MCP)</a> tools.
    Build a standard MCP server, paste your endpoint URL, set a price, and get paid in USDC every time an AI agent uses your tool.
</p>
</div>

---

## 🌟 The Ecosystem

Context is not just a chatbot; it is an economic engine for the AI era. We connect three distinct groups in a decentralized marketplace:

### 1. For Users: The "God Mode" Agent
Stop switching tabs. Context gives you an AI agent with real-time, read/write access to the world.
- **Auto Mode:** Ask "Find the best yield on Base," and the Agent autonomously searches the marketplace, buys the necessary data tools, analyzes the returns, and presents the answer.
- **One Wallet:** Pay for everything—from gas data to premium stock analysis—using a single USDC balance. No subscriptions, just pay-per-query.

### 2. For Tool Builders: The "App Store" for MCP
Monetize your data without building a frontend.
- **Build Once, Sell Everywhere:** Create a standard [MCP Server](https://modelcontextprotocol.io).
- **Zero UI Required:** You provide the API; our Agent provides the interface.
- **Instant Revenue:** Set a price (e.g., $0.01/query). Get paid in USDC instantly every time an Agent calls your tool.

### 3. For App Developers: The "Universal Adapter" (SDK)
Build your own agents using the Context Protocol as your infrastructure layer.
- **Stop Integrating APIs:** Instead of integrating CoinGecko, Tavily, and Weather APIs separately, just install `@ctxprotocol/sdk`.
- **Dynamic Discovery:** Your agent can search our marketplace at runtime: `client.discovery.search("gas prices")`.
- **Schema Inspection:** The API exposes full Input/Output schemas, allowing your LLM to self-construct arguments and execute tools it has never seen before.
- **Zero-Ops:** We host the connections. You just send JSON and get results.

> **"Context Protocol is npm for AI capabilities."**
> Just as `npm install` gives you code other people wrote, Context gives your Agent *capabilities* other people built.

## 🏗 Architecture

Context is built on a **Code Execution** paradigm. Instead of rigid "tool calling" schemas, the Agent writes and executes TypeScript code to interact with the world.

### 1. The Marketplace (Supply)

Developers register **Tools** (the paid product) powered by standard [Model Context Protocol](https://modelcontextprotocol.io) servers. Just paste your endpoint URL and we auto-discover your skills via `listTools()`.

### 💡 The "Data Broker" Standard

Context is not a text-based chat platform; it is a **Structured Data Marketplace**. We treat your tool like a financial API, not a conversational bot.

**Why `outputSchema` and `structuredContent` matter:**

The [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#output-schema) defines `outputSchema` and `structuredContent` as optional features for tools. Context *requires* them for all paid tools because structured data enables powerful marketplace features:

| Feature | Without Schema | With Schema |
|---------|----------------|-------------|
| **AI Code Generation** | Agent guesses response format | Agent writes precise parsing code |
| **Type Safety** | Runtime errors, broken parsing | Guaranteed structure |
| **Dispute Resolution** | Manual review required | Auto-adjudicated on-chain |
| **Trust Signal** | Unknown reliability | "Data Broker" verified |

While these fields are optional in vanilla MCP, Context requires them because:

  - **AI Agent Benefit:** The agent uses your `outputSchema` to write accurate TypeScript code that parses your response correctly.
  - **Payment Verification:** Our smart contracts can verify that your returned JSON matches your promised schema.
- **Dispute Resolution:** Schema mismatches can be auto-adjudicated on-chain without manual review.
  - **Result:** You are not just a "Prompt Engineer"; you are a **Data Broker** selling verifiable information on-chain.

> **Terminology:**
> - **Tool** = The paid marketplace listing (what users see in the sidebar)
> - **Skill** = The execution function (can be called multiple times per tool payment)
>
> **How It Works:**
> 1. You build an MCP server exposing your data/APIs
> 2. You register it as an "MCP Tool" on Context with a price (e.g., $0.01/query)
> 3. When users query the AI, it discovers and calls your skills via `callMcpSkill()`
> 4. You get paid instantly in USDC on Base

### 2. The Agent (Demand)

When a user asks a complex question (e.g., "Is it profitable to arb Uniswap vs Aave?"), the Agent:

1. **Discovers** relevant tools from the marketplace (or uses pre-selected ones)
2. **Plans** a solution using composability
3. **Writes Code** to invoke the necessary paid Tools via `callMcpSkill()`
4. **Executes** the code securely in our sandbox
5. **Pays** developers their fees instantly via `ContextRouter`
6. **Synthesizes** the answer

This **Composability** is the superpower of Context. Any frontier model can stitch together disparate tools into a coherent workflow, creating infinite new use cases from your single MCP server.

### 3. The Protocol (Settlement)

All value flows through `ContextRouter.sol` on Base. Payments are split instantly: 90% to the tool developer, 10% to the protocol treasury. When multiple tools are used, payments are batched into a single transaction.

**Staking System:** All tools (including free) require a minimum $10 USDC stake, enforced on-chain. For paid tools, the stake is 100x the query price if higher. This creates accountability and enables slashing for fraud. Stakes are fully refundable with a 7-day withdrawal delay.

### 4. Context Injection (Portfolio Data)

For tools that analyze user portfolios (e.g., "Analyze my Polymarket positions"), Context uses a **Context Injection** pattern:

| Step | Who | Action |
|------|-----|--------|
| 1 | User | Links external wallet in Settings > Portfolio Wallets |
| 2 | Context App | Checks tool's `x-context-requirements` in inputSchema |
| 3 | Context App | Fetches positions from protocol APIs (client-side) |
| 4 | Context App | Injects data as `portfolio` argument to tool |
| 5 | MCP Tool | Receives ready-to-analyze data, returns insights |

**Why this matters:**
- **No Auth Required**: Blockchain data is public - we fetch by wallet address, no API keys needed
- **Security**: MCP servers never see private keys or credentials
- **Simplicity**: Tool developers receive structured data, no blockchain expertise needed

**Currently Supported:**
- Polymarket (prediction market positions)
- Hyperliquid (perpetuals & spot balances)

#### Declaring Context Requirements

If your tool needs user portfolio data, declare it using the `x-context-requirements` extension in your `inputSchema`:

```typescript
{
  name: "analyze_my_positions",
  inputSchema: {
    type: "object",
    "x-context-requirements": ["hyperliquid"],  // or "polymarket", "wallet"
    properties: {
      portfolio: { type: "object" }
    },
    required: ["portfolio"]
  }
}
```

| Context Type | Description | Injected Data |
|--------------|-------------|---------------|
| `"hyperliquid"` | Hyperliquid perpetuals & spot | Positions, balances, account summary |
| `"polymarket"` | Polymarket prediction markets | Positions, orders, market data |
| `"wallet"` | Generic EVM wallet | Address, token balances |

> **Why `x-context-requirements`?** The MCP protocol only transmits standard fields. Custom properties like `requirements` get stripped. JSON Schema's `x-` extension properties are preserved through transport.

> 📖 **For MCP developers**: See [SDK Update Guide](./docs/SDK-UPDATE.md) and [Detection Architecture](./docs/wallet-linking-detection-architecture.md) for details.

## 🚀 Getting Started

### Run the App Locally

```bash
# 1. Clone the repo
git clone https://github.com/ctxprotocol/context.git

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.example .env.local
# (Fill in your keys for Privy, OpenAI/Anthropic, and Postgres)

# 4. Run the dev server
pnpm dev
```

### Contribute a Tool (MCP Tool)

Want to earn revenue from your data? Build an MCP server and register it as an MCP Tool.

1. **Build a Standard MCP Server:** Use the official **[@modelcontextprotocol/sdk](https://modelcontextprotocol.io)** to build your server. No special SDK required—just implement the [MCP structured output standard](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#output-schema):

   - **`outputSchema`** in your tool definitions (JSON Schema describing your response structure)
   - **`structuredContent`** in your responses (the machine-readable data matching your schema)

   ```typescript
   // MCP spec compliant server (see: modelcontextprotocol.io/specification)
   const TOOLS = [{
     name: "get_gas_price",
     inputSchema: { /* standard MCP input schema */ },
     outputSchema: {  // 👈 MCP spec feature (required by Context)
       type: "object",
       properties: { gasPrice: { type: "number" } },
       required: ["gasPrice"],
     },
   }];

   // In your tool handler
   return {
     content: [{ type: "text", text: JSON.stringify(data) }],  // Backward compat
     structuredContent: data,  // 👈 MCP spec feature (required by Context)
   };
   ```

   > **[See example MCP servers →](https://github.com/ctxprotocol/sdk/tree/main/examples/server)**

2. **Deploy Your Server:** Your server needs to be publicly accessible. We support both:
   - **HTTP Streaming** (recommended): `https://your-server.com/mcp`
   - **SSE (Server-Sent Events)**: `https://your-server.com/sse`

3. **Register in the App:** Go to `/contribute` in the running app:
   - Select **"MCP Tool"** (the default)
   - Paste your endpoint URL
   - We'll auto-discover your skills via `listTools()`

4. **Set a Price:** Choose your fee per query:
   - `$0.00` for free tools (great for adoption)
   - `$0.01+` for paid tools
   - **Note:** This fee is paid **once per chat turn**. The Agent can call your skills up to 100 times within that single paid turn via `callMcpSkill()`.
   - **Staking:** All tools require a minimum $10 USDC stake (or 100x query price if higher). This is enforced on-chain, fully refundable with 7-day withdrawal delay.

5. **Earn:** Your MCP Tool is now instantly available on the **decentralized marketplace**!

#### ⚠️ Schema Accuracy & Dispute Resolution

Your `outputSchema` isn't just documentation—it's a **contract**. Context uses automated schema validation as part of our crypto-native dispute resolution system:

1. **Users can dispute** tool outputs by providing their `transaction_hash` (proof of payment)
2. **Robot judge auto-adjudicates** by validating your actual output against your declared `outputSchema`
3. **If schema mismatches**, the dispute is resolved against you automatically
4. **Repeated violations** (5+ flags) lead to tool deactivation

```typescript
// ❌ BAD: Schema says number, but you return string
outputSchema: { temperature: { type: "number" } }
structuredContent: { temperature: "72" }  // GUILTY - schema mismatch!

// ✅ GOOD: Output matches schema exactly
outputSchema: { temperature: { type: "number" } }
structuredContent: { temperature: 72 }  // Valid
```

**Why this matters:** Unlike Web2 "star ratings" that can be gamed by bots, Context disputes require economic proof (you paid for the query). This protects honest developers from spam while ensuring bad actors face consequences.

### 🔒 Tool Safety Limits

Each tool invocation runs inside a sandboxed code-execution environment.

- **MCP Tools (via `callMcpSkill`)**
  - Enforced limit: `MAX_CALLS_PER_TURN = 100`
  - Every `callMcpSkill({ toolId, toolName, args })` increments an internal counter
  - Once `executionCount >= 100`, the platform throws an error for that turn
  - Fresh MCP connections are created per request for reliability
  - Code execution limited by VM timeout (default 5000ms) and platform limits

- **Economic Model**
  - Users pay **once per chat turn per Tool**
  - Free tools ($0.00 price) can be used immediately without payment
  - Paid tools require user authorization via the sidebar
  - Multiple paid tools = single batched transaction

## 📄 License

Context is open source but protected.
Licensed under **BUSL 1.1** (Business Source License). You can use, copy, and modify the code for non-commercial or personal use. Production use that competes directly with the Context marketplace is restricted.

See [LICENSE](./LICENSE) for details.
