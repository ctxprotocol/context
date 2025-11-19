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

## 👩‍💻 How to Contribute

1. **Fork** the [Context repository](https://github.com/ctxprotocol/context).
2. **Duplicate** the `template.ts` file in this directory.
3. **Rename** it to your skill name (e.g., `uniswap-quoter.ts`).
4. **Implement** your logic:
   - Define input schemas using `zod`.
   - Write clean, safe TypeScript code.
   - **Note:** No `eval()`, no unrestricted network calls (use verified APIs only).
5. **Submit a Pull Request** to the main repository.

Once verified and merged, your skill becomes part of the Agent's standard toolkit.
