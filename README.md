<div align="center">
  <img alt="Context Protocol" src="app/(chat)/opengraph-image.png" width="100%" style="border-radius: 12px; margin-bottom: 24px;" />
  
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

- **For Developers:** Don't build another chat UI. Build a **Skill**. Expose your unique data (crypto prices, prediction markets, proprietary analysis) and get paid in USDC every time an AI agent uses it.
- **For Users:** Access a "God Mode" agent that has real-time access to the entire on-chain and off-chain world, without switching tabs.

## 🏗 Architecture

Context is built on a **Code Execution** paradigm. Instead of rigid "tool calling" schemas, our Agent writes and executes TypeScript code to interact with the world.

### 1. The Marketplace (Supply)
Developers contribute **Skills** to the protocol.
- **HTTP Tools:** Simple endpoints that return JSON. Permissionless and hosted by you.
- **Native Skills:** Verified TypeScript modules that run inside our secure sandbox for high-performance logic.

### 2. The Agent (Demand)
Users chat with the Context Agent. When a query requires specialized knowledge (e.g., "What's the gas price on Base?"), the Agent:
1. **Plans** a solution.
2. **Writes Code** to invoke the necessary paid Skills.
3. **Executes** the code securely.
4. **Pays** the developer via the `ContextRouter` smart contract.
5. **Synthesizes** the answer.

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

1. **Build an HTTP Endpoint:** It just needs to accept JSON and return JSON.
2. **Register in the App:** Go to `/contribute` in the running app.
3. **Set a Price:** Choose your fee per query (e.g., $0.01 USDC).
4. **Earn:** Your tool is now instantly available to the global Context Agent.

## 🛠 Advanced: Native Skills Registry

For complex logic that requires high performance or verified execution, you can contribute directly to the core codebase.

**[View the Community Skills Registry](./lib/ai/skills/community/README.md)**

## 📄 License

Context is open source but protected.
Licensed under **BUSL 1.1** (Business Source License). You can use, copy, and modify the code for non-commercial or personal use. Production use that competes directly with the Context marketplace is restricted.

See [LICENSE](./LICENSE) for details.
