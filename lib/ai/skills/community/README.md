# Community Skills Registry

This directory contains **Verified Native Skills** submitted by the community.

## How it works

Unlike **HTTP Tools** (which are permissionless and run on your own server), **Native Skills** run directly on the Context platform infrastructure. This allows for:

- Higher performance (no HTTP roundtrip latency)
- Complex logic & data transformation
- Access to verified platform APIs

## How to submit a skill

1. **Fork** the Context repository.
2. **Duplicate** the `template.ts` file in this directory.
3. **Rename** it to your skill name (e.g., `uniswap-quoter.ts`).
4. **Implement** your logic.
   - Use `zod` for input validation.
   - Ensure code is safe and performant.
5. **Submit a Pull Request** to the main repository.

Once verified and merged, your skill will be available to the Context AI agent.

