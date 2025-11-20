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

## 📝 The Description Field: Your Instruction Manual

When you register your tool (Native or HTTP), the **Description** field is the single most important piece of metadata.

*   **Who reads it?** The LLM (e.g., GPT-5, Claude 4.5 Sonnet).
*   **When?** During the "Planning" phase of a chat.
*   **How is it used?**

When a user asks a question (e.g., *"Is gas cheap on Base right now?"*), the Agent scans the list of available tools. It reads your description to decide:
1.  *"Is this tool relevant to the user's question?"*
2.  *"How do I use this tool to get the answer?"*

**Example:**
If your description says *"Fetches gas prices"*, the Agent knows to pick it.
If it says *"Supports 'gas_price' endpoint which returns standard, fast, and rapid estimates"*, the Agent knows **exactly** what parameter to send (`endpoint: "gas_price"`) and what kind of data to expect back.

## 💡 Example Input: The Cheat Sheet

You will notice an "Example Input (JSON)" field in the `/contribute` form.

**For HTTP Tools:** This is **Required**. The Agent needs to know the exact JSON structure to send to your API.

**For Native Skills:** This field is **Hidden**.
*   **Why?** Because Native Skills are code. The Agent will automatically infer how to use your function by reading the module signature (or implied interface) from the platform's runtime environment. You don't need to provide a JSON example—your TypeScript code is the documentation.

## 💰 How to Monetize Your Skill

Just submitting code doesn't get you paid. You must also create a **Marketplace Listing**.

1. **Submit the PR** with your code (as described below).
2. **Register the Tool:** Go to the `/contribute` page in the Context App.
3. **Select "Native Skill":** Choose this option instead of "HTTP Tool".
4. **Link Your Code:** Enter the module path (e.g., `@/lib/ai/skills/community/your-skill-name`).
5. **Set Your Price:** Choose your fee per query (e.g., $0.01 USDC).

Once your PR is merged and your Tool is registered, the two will be linked. Users will see your tool in the sidebar, and when they pay to use it, the Agent will execute your high-performance code.

> **Note:** For HTTP Tools, you can simply register your endpoint URL directly in the `/contribute` page. You can also use our [Context SDK](https://github.com/ctxprotocol/sdk) to easily build type-safe endpoints.

### 🧩 The Power of Composability

Because Context uses **Code Execution**, your skill can be composed with any other skill in the marketplace.
- An Agent might combine your **Prediction Market** skill with a **Weather** skill to forecast crop futures.
- Your tiny, specific utility (like `wei-converter`) might be used thousands of times inside larger workflows.
- You get paid every time your function is imported and run.

### 🚦 The Verification Process

Unlike HTTP Tools which are live instantly, Native Skills require a 2-step verification for security:

1.  **Code Review:** The Context team reviews your PR on GitHub to ensure the code is safe and high-quality.
2.  **Link Verification:** After merging, we verify that your Marketplace Listing points to the correct module path.
3.  **Go Live:** Once both checks pass, an Admin clicks "Verify" and your tool becomes active in the global marketplace.

### 🔄 How to Bundle Multiple Endpoints (e.g., Coingecko)

If you are a large data provider (like Coingecko) with 50+ endpoints, you do **not** need to register 50 separate tools.

1.  **Register ONE Tool:** Call it "Coingecko Pro" ($0.01).
2.  **Submit ONE Native Skill Module:** `lib/ai/skills/community/coingecko.ts`.
3.  **Export Multiple Functions:** Inside your file, export as many functions as you like:
    ```typescript
    export async function getPrice(...) { ... }
    export async function getHistory(...) { ... }
    export async function getMarketChart(...) { ... }
    ```
4.  **The Result:** The Agent sees all these functions attached to the "Coingecko Pro" tool. When a user pays the $0.01 query fee, the Agent picks the correct function to call.

This keeps the User Interface clean (one tool to toggle) while giving the Agent maximum power.

## 👩‍💻 How to Contribute Code

1. **Fork** the [Context repository](https://github.com/ctxprotocol/context).
2. **Duplicate** the `template.ts` file in this directory.
3. **Rename** it to your skill name (e.g., `uniswap-quoter.ts`).
4. **Implement** your logic:
   - Define input schemas using `zod`.
   - Write clean, safe TypeScript code.
   - **No `eval()`:** Arbitrary code execution is strictly forbidden for security.
   - **Verified APIs Only:** Network calls must be to reputable, public endpoints (e.g., `api.uniswap.org`) or imports of other Registered Tools. We review every URL during the PR process.
5. **Submit a Pull Request** to the main repository.
