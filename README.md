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

## 🌟 Vision

We believe the future of AI is not a single "Super App," but a collaborative network of specialized agents and data sources. MCP is the open standard that makes this possible—and Context is where you get paid.

- **For Developers:** Don't build a custom API integration. Build a standard **MCP Server**. Expose your unique data (crypto, stocks, weather, sports, anything) and get paid in USDC every time an AI agent uses it.
- **For Users:** Access a "God Mode" agent that has real-time access to the entire on-chain and off-chain world, without switching tabs. Enable "Auto Mode" to let the AI discover tools for you.
- **For The Future:** We are currently bootstrapping the economy with our own chat interface. Once liquidity is established, we will open the **Context Protocol API**, allowing *any* AI application to query our marketplace of MCP tools.

## 🏗 Architecture

Context is built on a **Code Execution** paradigm. Instead of rigid "tool calling" schemas, the Agent writes and executes TypeScript code to interact with the world.

### 1. The Marketplace (Supply)

Developers register **Tools** (the paid product) which are powered by:

- **MCP Tools (Recommended):** Standard [Model Context Protocol](https://modelcontextprotocol.io) servers. Just paste your SSE endpoint URL—we auto-discover your skills via `listTools()`. This is the primary integration path.
- **Native Tools:** Verified TypeScript modules running on our platform ("Serverless MCP"). For high-performance use cases where you need zero-latency execution. Requires a Pull Request.

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

1. **Build an MCP Server:** Follow the [Model Context Protocol spec](https://modelcontextprotocol.io). Use the official [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) or [Python SDK](https://github.com/modelcontextprotocol/python-sdk).

2. **Deploy with SSE Transport:** Your server needs to be publicly accessible via Server-Sent Events (SSE). Example endpoint: `https://your-server.com/sse`

3. **Register in the App:** Go to `/contribute` in the running app:
   - Select **"MCP Tool"** (the default)
   - Paste your SSE endpoint URL
   - We'll auto-discover your skills via `listTools()`

4. **Set a Price:** Choose your fee per query:
   - `$0.00` for free tools (great for adoption)
   - `$0.01+` for paid tools
   - **Note:** This fee is paid **once per chat turn**. The Agent can call your skills up to 100 times within that single paid turn via `callMcpSkill()`.

5. **Earn:** Your MCP Tool is now instantly available on the **decentralized marketplace**!

#### Example MCP Server (TypeScript)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new Server({
  name: "my-weather-server",
  version: "1.0.0",
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "get_weather",
    description: "Get current weather for a city",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" }
      },
      required: ["city"]
    },
    // Define output structure for reliable AI parsing (MCP 2025-06-18)
    outputSchema: {
      type: "object",
      properties: {
        temperature: { type: "number" },
        conditions: { type: "string" },
        humidity: { type: "number" }
      },
      required: ["temperature", "conditions"]
    }
  }]
}));

server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "get_weather") {
    const { city } = request.params.arguments;
    // Your API logic here
    const data = { temperature: 72, conditions: "Sunny", humidity: 45 };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      // Return flat data in structuredContent for reliable AI parsing
      structuredContent: data
    };
  }
});

// Start SSE server on port 3001
const transport = new SSEServerTransport("/sse", response);
await server.connect(transport);
```

> **Best Practice:** Always include `outputSchema` in your tool definitions and return data in `structuredContent`. This ensures AI agents can reliably access your data (e.g., `result.temperature` instead of guessing nested paths).

See the full [Blocknative example](./examples/blocknative-contributor) for a production-ready implementation.

### 🛠 Advanced: Native Skills Registry

For complex logic that requires maximum performance or verified execution, you can contribute directly to the core codebase via Pull Request.

**[View the Community Skills Registry](./lib/ai/skills/community/README.md)**

### 🔒 Tool Safety Limits

Each tool invocation runs inside a sandboxed code-execution environment.

- **MCP Tools (via `callMcpSkill`)**
  - Enforced limit: `MAX_CALLS_PER_TURN = 100`
  - Every `callMcpSkill({ toolId, toolName, args })` increments an internal counter
  - Once `executionCount >= 100`, the platform throws an error for that turn
  - Fresh MCP connections are created per request for reliability

- **Native Tools (custom skill functions in `lib/ai/skills/community/*`)**
  - Executed via `executeSkillCode` in `lib/ai/code-executor.ts`
  - No per-call counter, but limited by VM timeout (default 5000ms)
  - Underlying platform limits (Vercel function time, memory, etc.)

- **Economic Model**
  - Users pay **once per chat turn per Tool**
  - Free tools ($0.00 price) can be used immediately without payment
  - Paid tools require user authorization via the sidebar
  - Multiple paid tools = single batched transaction

## 📄 License

Context is open source but protected.
Licensed under **BUSL 1.1** (Business Source License). You can use, copy, and modify the code for non-commercial or personal use. Production use that competes directly with the Context marketplace is restricted.

See [LICENSE](./LICENSE) for details.
