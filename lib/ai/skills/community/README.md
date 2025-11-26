# Community Skills Registry

This directory contains **Verified Native Skills** submitted by the community.

Native Skills are essentially **"Serverless MCP"**—we host the code, but the interface follows the same patterns as the Model Context Protocol. They run in-process with zero network latency.

## ⚡️ MCP Servers vs. Native Tools

| Feature | MCP Servers | Native Tools |
| :--- | :--- | :--- |
| **Hosting** | You host it (your server) | We host it (Context Protocol) |
| **Protocol** | Standard MCP over SSE | Direct TypeScript execution |
| **Latency** | Network dependent (~50-200ms) | Zero-latency (runs in-process) |
| **Language** | Any language with MCP SDK | TypeScript only |
| **Verification** | Instant (auto-discovery) | Requires Pull Request Review |
| **Best For** | Most use cases, existing APIs | High-performance aggregators, complex logic |

> **Recommendation:** For most developers, building an **MCP Server** is easier and faster. You can use any language, deploy anywhere, and get instant integration. Use Native Tools only when you need:
> - Maximum performance (sub-millisecond execution)
> - Complex multi-step logic that benefits from running in-process
> - Direct access to other Native Tools without network overhead

## 🚀 Quick Start: MCP Server (Recommended)

For most use cases, just build a standard MCP server:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const server = new Server({ name: "my-data-server", version: "1.0.0" });

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "get_data",
    description: "Fetch my proprietary data",
    inputSchema: { type: "object", properties: { query: { type: "string" } } }
  }]
}));

server.setRequestHandler("tools/call", async (request) => {
  // Your data fetching logic
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

Then register at `/contribute` → paste your SSE endpoint → done!

See the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) for full documentation.

---

## 👩‍💻 How to Contribute a Native Skill

Only use this path if you need the performance benefits of in-process execution.

1. **Fork** the [Context repository](https://github.com/ctxprotocol/context).

2. **Duplicate** the `template.ts` file in this directory.

3. **Rename** it to your skill name (e.g., `uniswap-quoter.ts`).

4. **Implement** your logic:
   - Define input schemas using `zod`
   - Write clean, safe TypeScript code
   - **No `eval()`:** Arbitrary code execution is strictly forbidden
   - **Verified APIs Only:** Network calls must be to reputable, public endpoints. We review every URL during the PR process.

5. **Register your export:** Open `index.ts` in this directory and add:
   ```typescript
   export * as uniswap from "./uniswap-quoter";
   ```
   **Crucial:** If you skip this step, the AI agent won't be able to find your code!

6. **Submit a Pull Request** to the main repository.

## 💰 How to Monetize Your Skill

Just submitting code doesn't get you paid. You must also create a **Marketplace Listing**.

1. **Submit the PR** with your code (as described above)
2. **Register the Tool:** Go to the `/contribute` page in the Context App
3. **Select "Native Tool":** Choose this option instead of "MCP Server"
4. **Link Your Code:** Enter the module path (e.g., `@/lib/ai/skills/community/your-skill-name`)
5. **Set Your Price:** Choose your fee per query (e.g., $0.01 USDC)

Once your PR is merged and your Tool is registered, the two will be linked. Users will see your tool in the sidebar, and when they pay to use it, the Agent will execute your high-performance code.

## 📝 The Description Field

This is the **Instruction Manual** for the LLM. It reads this during the "Planning" phase to decide if and how to use your tool.

**For Native Skills:**
Since your code is the documentation, your description should focus on **intent** and **functionality**.

*Bad:* "Runs code."

*Good:* "Exports `getGasPrice` and `getOracles`. Use `getGasPrice` with a `chainId` to fetch estimates. Use `getOracles` to find active feeds."

## 🧩 The Power of Composability

Because Context uses **Code Execution**, your skill can be composed with any other skill in the marketplace.

- An Agent might combine your **Prediction Market** skill with a **Weather** skill to forecast crop futures
- Your tiny, specific utility (like `wei-converter`) might be used thousands of times inside larger workflows
- You get paid every time your function is imported and run

## 🚦 The Verification Process

Unlike MCP Servers which are live instantly, Native Skills require a 2-step verification for security:

1. **Code Review:** The Context team reviews your PR on GitHub to ensure the code is safe and high-quality
2. **Link Verification:** After merging, we verify that your Marketplace Listing points to the correct module path
3. **Go Live:** Once both checks pass, an Admin clicks "Verify" and your tool becomes active

## 🔄 Bundling Multiple Functions

If you are a large data provider with many endpoints, you do **not** need to register separate tools.

1. **Register ONE Tool:** Call it "Coingecko Pro" ($0.01)
2. **Submit ONE Native Skill Module:** `lib/ai/skills/community/coingecko.ts`
3. **Export Multiple Functions:**
   ```typescript
   export async function getPrice(...) { ... }
   export async function getHistory(...) { ... }
   export async function getMarketChart(...) { ... }
   ```
4. **The Result:** The Agent sees all these functions attached to the "Coingecko Pro" tool. When a user pays the $0.01 query fee, the Agent picks the correct function to call.

This keeps the User Interface clean (one tool to toggle) while giving the Agent maximum power.
