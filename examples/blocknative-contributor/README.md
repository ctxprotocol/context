## Blocknative contributor example

This folder shows how an independent developer can expose the Blocknative Gas
Platform through the Context SDK. It runs a tiny Express server with a single
endpoint: `POST /context/blocknative`.

### Requirements

- Node.js 18+
- Blocknative API key

### Setup

```bash
cd examples/blocknative-contributor
cp env.example .env      # add BLOCKNATIVE_API_KEY
pnpm install
pnpm run dev
```

The server listens on `http://localhost:4001` by default. You can test it with:

```bash
curl http://localhost:4001/context/blocknative \
  -H "Content-Type: application/json" \
  -d '{"input":{"endpoint":"gas_price","chainId":8453,"confidence":90}}'
```

### How it works

- `@ctxprotocol/sdk` provides `defineHttpTool` + `executeHttpTool`.
- The contributor implements the Blocknative logic (URL building, parsing,
  API key management) entirely on their infra.
- Context will call this endpoint via the generic HTTP skill once the tool is
  registered in the marketplace.

### ⚠️ The "Data Broker" Requirement (Output Schemas)

You are building a **Data Broker** tool, not a chatbot. When a user pays for your tool, they are buying **structured data**, not text.

**Why `outputSchema` and `structuredContent` are required:**

1. **AI Agent Code Generation**: The agent uses your `outputSchema` to write accurate TypeScript code that parses your response. Without it, the agent guesses—and often fails.
2. **Type Safety**: `structuredContent` guarantees the agent receives data in the exact format it expects. No parsing errors.
3. **Dispute Resolution**: Our "Robot Judge" automatically resolves disputes by comparing your `structuredContent` against your `outputSchema`. Schema violations = automatic refund.

**Schema Definitions:**
- **`outputSchema`**: The "contract" of what you sell (returned in `listTools`).
- **`structuredContent`**: The actual data you deliver (returned in tool response).

**Rules:**
- Your `structuredContent` must match your `outputSchema` exactly
- Types matter: `"72"` (string) ≠ `72` (number)
- Repeated schema violations (5+ flags) lead to tool deactivation


