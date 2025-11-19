# Environment Variables Setup

## Option 1: Create Hardhat-Specific .env File (Recommended)

Create a new file: `/Users/alex/Documents/context/hardhat/.env`

```bash
# === REQUIRED FOR DEPLOYMENT ===
DEPLOYER_KEY=0xYOUR_PRIVATE_KEY_HERE
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY_HERE

# === OPTIONAL (defaults are provided) ===
INFURA_API_KEY=YOUR_INFURA_KEY_HERE          # For faster RPC
DEPLOYER_MNEMONIC=YOUR_12_WORD_PHRASE_HERE   # For local hardhat testing
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY_HERE    # For Ethereum network verification

# Base Network Configuration (optional - defaults already set)
BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/YOUR_INFURA_KEY
BASE_MAINNET_RPC_URL=https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY
BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_MAINNET_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Where to get these:**
- `DEPLOYER_KEY`: Your wallet's private key (MetaMask: Account Details → Export Private Key)
- `BASESCAN_API_KEY`: https://basescan.org/myapikey (free account)
- `INFURA_API_KEY`: https://infura.io (optional, for faster RPC)

## Option 2: Share Parent .env.local (Alternative)

If you want to share variables with the main Next.js app, update hardhat.config.ts:

Change:
```typescript
dotenv.config({ path: "./.env" });
```

To:
```typescript
dotenv.config({ path: "../.env.local" });
```

Then add these to `/Users/alex/Documents/context/.env.local`:
```bash
# === REQUIRED FOR CONTRACT DEPLOYMENT ===
DEPLOYER_KEY=0xYOUR_PRIVATE_KEY_HERE
BASESCAN_API_KEY=YOUR_BASESCAN_API_KEY_HERE

# === OPTIONAL (defaults are provided) ===
INFURA_API_KEY=YOUR_INFURA_KEY_HERE
DEPLOYER_MNEMONIC=YOUR_12_WORD_PHRASE_HERE
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY_HERE

# Base Network Configuration (optional - defaults already set)
BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/YOUR_INFURA_KEY
BASE_MAINNET_RPC_URL=https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY
BASE_SEPOLIA_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_MAINNET_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## ⚠️ Security Notes

1. **NEVER commit .env files to Git**
2. The `.gitignore` already excludes `.env` files
3. Use different keys for testnet vs mainnet
4. For production, use environment secrets (Vercel/GitHub Actions)

## Variable Mapping

| Your Current Project | Context Project | Notes |
|---------------------|-----------------|-------|
| `DEPLOYER_KEY` | `DEPLOYER_PRIVATE_KEY` | Same key, different name |
| `BASESCAN_API_KEY` | Same | Already matches |
| `INFURA_API_KEY` | New (optional) | Fallback to public RPC if not set |

## Quick Test

After setting up .env, test with:
```bash
cd /Users/alex/Documents/context/hardhat
pnpm hardhat compile
```

If you see "Compiled X Solidity files successfully" → You're good! ✅

