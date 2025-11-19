# Community Skills Registry

This directory contains **Verified Native Skills** submitted by the community.

## ⚡️ Native Skills vs. HTTP Tools

| Feature | HTTP Tools | Native Skills |
| :--- | :--- | :--- |
| **Hosting** | You host it (your server) | We host it (Context Protocol) |
| **Latency** | Network dependent | Zero-latency (runs in-process) |
| **Complexity** | Simple JSON I/O | Complex TypeScript logic |
| **Verification** | Permissionless | Requires Pull Request Review |
| **Best For** | Private APIs, Rapid Prototyping | High-performance Data, Aggregators |

## 💰 How to Monetize Your Skill

Just submitting code doesn't get you paid. You must also create a **Marketplace Listing**.

1. **Submit the PR** with your code (as described below).
2. **Register the Tool:** Go to the `/contribute` page in the Context App.
3. **Select "Native Skill":** Choose this option instead of "HTTP Tool".
4. **Link Your Code:** Enter the module path (e.g., `@/lib/ai/skills/community/your-skill-name`).
5. **Set Your Price:** Choose your fee per query (e.g., $0.01 USDC).

Once your PR is merged and your Tool is registered, the two will be linked. Users will see your tool in the sidebar, and when they pay to use it, the Agent will execute your high-performance code.

### 🧩 The Power of Composability

Because Context uses **Code Execution**, your skill can be composed with any other skill in the marketplace. 
- An Agent might combine your **Prediction Market** skill with a **Weather** skill to forecast crop futures.
- Your tiny, specific utility (like `wei-converter`) might be used thousands of times inside larger workflows.
- You get paid every time your function is imported and run.

## 👩‍💻 How to Contribute Code

1. **Fork** the [Context repository](https://github.com/ctxprotocol/context).
2. **Duplicate** the `template.ts` file in this directory.
3. **Rename** it to your skill name (e.g., `uniswap-quoter.ts`).
4. **Implement** your logic:
   - Define input schemas using `zod`.
   - Write clean, safe TypeScript code.
   - **Note:** No `eval()`, no unrestricted network calls (use verified APIs only).
5. **Submit a Pull Request** to the main repository.
