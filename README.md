<div align="center">
  
  # Context Protocol

  **The decentralized marketplace for AI context.**
  
  [![License: BUSL 1.1](https://img.shields.io/badge/License-BUSL%201.1-blue.svg)](https://github.com/ctxprotocol/context/blob/main/LICENSE)
  [![Twitter Follow](https://img.shields.io/twitter/follow/ctxprotocol?style=social)](https://twitter.com/ctxprotocol)

<p align="center">
    Context is an AI-native protocol that enables developers to monetize their data and APIs directly through LLM interactions.
    We are replacing the fragmented world of "AI Wrappers" with a unified, permissionless marketplace where agents pay for the skills they need.
</p>
</div>

---

## 🌟 Vision

We believe the future of AI is not a single "Super App," but a collaborative network of specialized agents and data sources.

- **For Developers:** Don't build another chat UI. Build a **Skill**. Expose your unique data (crypto, stocks, weather, sports, anything) and get paid in USDC every time an AI agent uses it.
- **For Users:** Access a "God Mode" agent that has real-time access to the entire on-chain and off-chain world, without switching tabs.
- **For The Future:** We are currently bootstrapping the economy with our own chat interface. Once liquidity is established, we will open the **Context Protocol API**, allowing *any* AI application to query our marketplace of tools.

## 🏗 Architecture

Context is built on a **Code Execution** paradigm. Instead of rigid "tool calling" schemas, the Agent writes and executes TypeScript code to interact with the world.

### 1. The Marketplace (Supply)
Developers register **Tools** (the paid product) which are powered by either:
- **HTTP Tools:** Remote API endpoints hosted by you. You provide JSON examples so the Agent knows the wire format.
- **Native Skills:** Verified TypeScript modules running on our platform. The Agent reads your code signatures directly.

### 2. The Agent (Demand)
When a user asks a complex question (e.g., "Is it profitable to arb Uniswap vs Aave?"), the Agent:
1. **Plans** a solution using composability.
2. **Writes Code** to invoke the necessary paid Tools (e.g., calling functions from the `uniswap` and `aave` modules).
3. **Executes** the code securely in our sandbox.
4. **Pays** both developers their respective fees instantly via `ContextRouter`.
5. **Synthesizes** the answer.

This **Composability** is the superpower of Context. Any frontier model can stitch together disparate tools into a coherent workflow, creating infinite new use cases from your single API.

### 3. The Protocol (Settlement)
All value flows through `ContextRouter.sol` on Base. Payments are split instantly between the tool developer and the protocol treasury.

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

### Contribute a Tool

Want to earn revenue from your API?

1. **Build an HTTP Endpoint:** It just needs to accept JSON and return JSON. You can use our [Context SDK](https://github.com/ctxprotocol/sdk) for a type-safe experience.
2. **Register in the App:** Go to `/contribute` in the running app.
3. **Set a Price:** Choose your fee per query (e.g., $0.01 USDC).
4. **Earn:** Your tool is now instantly available on the **decentralized marketplace**, accessible by the Context chat app and eventually the public API.

#### 🛠 Advanced: Native Skills Registry

For complex logic that requires high performance or verified execution, you can contribute directly to the core codebase via Pull Request.

**[View the Community Skills Registry](./lib/ai/skills/community/README.md)**

### 🔒 HTTP Tool Safety Limits

Each paid tool invocation runs inside a sandboxed code-execution environment.
To protect contributors from abuse, HTTP-based tools are limited to a small
number of upstream requests per turn (currently **100 HTTP calls per paid
query**). Tool authors should design their APIs and examples so the agent can
do useful work within that budget (e.g. 1 discovery call plus a handful of
detail lookups), and the planner prompt will encourage efficient patterns.

## 📄 License

Context is open source but protected.
Licensed under **BUSL 1.1** (Business Source License). You can use, copy, and modify the code for non-commercial or personal use. Production use that competes directly with the Context marketplace is restricted.

See [LICENSE](./LICENSE) for details.
