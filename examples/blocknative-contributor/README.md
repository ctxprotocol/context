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
 
 1. **`outputSchema`**: Defines the "Contract" of what you sell.
    - *Example:* "I promise to return an object with a `price` (number) and `currency` (string)."
 2. **`structuredContent`**: The actual data you deliver.
    - *Example:* `{ price: 100, currency: "USD" }`
 
 **Why?**
 This allows our "Robot Judge" to **automatically resolve disputes**. If your API returns data that breaks your own schema, the user is automatically refunded. This creates trust without humans in the loop.

- Ensure your response structure matches your `outputSchema` exactly
- Types matter: `"72"` (string) ≠ `72` (number)
- Repeated schema violations (5+ flags) lead to tool deactivation


