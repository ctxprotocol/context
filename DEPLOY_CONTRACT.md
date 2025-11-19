# Deploy ContextRouter Contract to Base Mainnet

## ⚠️ CRITICAL: You Must Deploy the Contract First!

The error you're seeing in MetaMask ("sending call data to an address that isn't a contract") is because:
- The contract address in `.env.local` is set to: `0xBFeF43bb654a2f285f0578a4e22C69587980eFf1`
- **But this contract doesn't exist on Base Mainnet yet!**
- You need to deploy it first

## Prerequisites

Before deploying, ensure you have:

1. **Deployer wallet with ETH on Base Mainnet**
   - You need ~0.001-0.002 ETH for gas fees
   - Get ETH on Base via bridge or exchange

2. **Environment variables set** in `/Users/alex/Documents/context/.env.local`:
   ```bash
   # Your deployer private key (KEEP THIS SECRET!)
   DEPLOYER_KEY=your_private_key_here
   
   # Etherscan V2 API key (works for Base, Arbitrum, Optimism, etc.)
   ETHERSCAN_API_KEY=your_etherscan_api_key_here
   
   # RPC URL (optional, has default)
   BASE_MAINNET_RPC_URL=https://base-mainnet.infura.io/v3/YOUR_INFURA_KEY
   ```

3. **Etherscan API Key** (for verification):
   - Get one free at: https://etherscan.io/myapikey
   - **Important:** Use Etherscan V2 API (single key works for all chains)
   - Add to `.env.local` as `ETHERSCAN_API_KEY`
   - This same key works for Base, Arbitrum, Optimism, Polygon, etc.

## Step 1: Navigate to Hardhat Directory

```bash
cd /Users/alex/Documents/context/hardhat
```

## Step 2: Deploy to Base Mainnet

```bash
npx hardhat run scripts/deploy.ts --network baseMainnet
```

**Expected Output:**
```
Deploying to network: baseMainnet (chainId: 8453)
Using USDC at: 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
✅ ContextRouter deployed to: 0xYourNewContractAddress

Add this to your .env.local:
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=0xYourNewContractAddress

Waiting for block confirmations...

🔍 Verify with:
npx hardhat verify --network baseMainnet 0xYourNewContractAddress 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
```

## Step 3: Update Environment Variable

Copy the deployed contract address and update your `.env.local`:

```bash
# In /Users/alex/Documents/context/.env.local
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=0xYourNewContractAddress
```

## Step 4: Verify Contract on Basescan

This makes your contract readable on Basescan and adds trust:

```bash
npx hardhat verify --network baseMainnet \
  0xYourNewContractAddress \
  0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
```

**Expected Output:**
```
Successfully verified contract ContextRouter on Basescan.
https://basescan.org/address/0xYourNewContractAddress#code
```

## Step 5: Regenerate Wagmi Hooks

After updating the contract address, regenerate the hooks:

```bash
cd /Users/alex/Documents/context
pnpm wagmi
```

This will update `lib/generated.ts` with the new contract address.

## Step 6: Restart Dev Server

```bash
pnpm dev
```

## Step 7: Test the Payment Flow

1. **Refresh your browser** (hard refresh: Cmd+Shift+R)
2. **Select Blocknative Gas tool**
3. **Type a message** and click Send
4. **Check MetaMask transaction details:**
   - Should now show your contract address
   - Should NOT show "0x0000...0000"
   - Should NOT show "potential mistake" warning

## Alternative: Deploy to Base Sepolia First (Recommended for Testing)

If you want to test on testnet first:

### 1. Get Sepolia ETH
- Bridge ETH to Base Sepolia: https://bridge.base.org/
- Or use a faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### 2. Deploy to Sepolia
```bash
cd /Users/alex/Documents/context/hardhat
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### 3. Update .env.local for Sepolia
```bash
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA=0xYourSepoliaAddress
```

### 4. Update Wagmi and Privy configs to use Sepolia
In `lib/wagmi.ts` and `privy.config.ts`, temporarily change:
```typescript
chains: [baseSepolia], // Instead of [base]
```

### 5. Regenerate hooks and test
```bash
pnpm wagmi
pnpm dev
```

## Troubleshooting

### Error: "insufficient funds for gas"
- Your deployer wallet needs ETH on Base Mainnet
- Check balance: https://basescan.org/address/YOUR_DEPLOYER_ADDRESS

### Error: "DEPLOYER_KEY not set"
- Add your private key to `.env.local`
- **NEVER commit this file to git!**

### Error: "Invalid API Key" or "deprecated V1 endpoint"
- Get an Etherscan V2 API key: https://etherscan.io/myapikey
- Add to `.env.local` as `ETHERSCAN_API_KEY` (NOT BASESCAN_API_KEY)
- The V2 API works for all chains (Base, Arbitrum, Optimism, etc.)

### Contract deploys but verification fails
- Wait a few minutes and try verification again
- Basescan sometimes has delays
- Verification is optional but recommended

### MetaMask still shows "0x0000...0000"
1. Check `.env.local` has the new address
2. Run `pnpm wagmi` to regenerate hooks
3. Restart dev server with `pnpm dev`
4. Hard refresh browser (Cmd+Shift+R)
5. Check browser console for errors

## Security Notes

⚠️ **IMPORTANT:**
- Your `DEPLOYER_KEY` is your private key - keep it secret!
- Never commit `.env.local` to git (it's already in `.gitignore`)
- The deployer address becomes the contract owner
- Only the owner can claim platform fees
- Consider using a hardware wallet for mainnet deployments

## Cost Estimate

**Deployment costs on Base Mainnet:**
- Contract deployment: ~0.0005-0.001 ETH (~$1-2)
- Contract verification: Free
- Total: Less than $2 USD

**Much cheaper than Ethereum mainnet!**

## After Deployment

Once deployed and verified:

1. **Check contract on Basescan:**
   - Visit: `https://basescan.org/address/YOUR_CONTRACT_ADDRESS`
   - Should show "Contract" tab with verified source code
   - Should show "Read Contract" and "Write Contract" tabs

2. **Test contract functions:**
   - On Basescan, go to "Read Contract"
   - Check `PLATFORM_FEE_PERCENT()` returns 10
   - Check `usdc()` returns the USDC address
   - Check `owner()` returns your deployer address

3. **Fund your test wallet with USDC:**
   - You need at least 0.01 USDC to test payments
   - Get USDC on Base via bridge or swap

4. **Complete the E2E test** from `E2E_TESTING.md`

## Quick Reference

```bash
# Deploy to mainnet
cd hardhat && npx hardhat run scripts/deploy.ts --network baseMainnet

# Verify on Basescan
npx hardhat verify --network baseMainnet CONTRACT_ADDRESS USDC_ADDRESS

# Update hooks
cd .. && pnpm wagmi

# Restart server
pnpm dev
```

## Next Steps

After successful deployment:
1. ✅ Update `NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS` in `.env.local`
2. ✅ Run `pnpm wagmi` to regenerate hooks
3. ✅ Restart dev server
4. ✅ Test payment flow end-to-end
5. ✅ Seed Blocknative tool if not done: `npx tsx scripts/seed-blocknative-tool.ts`
6. ✅ Follow `E2E_TESTING.md` for complete testing

## Support

If you encounter issues:
1. Check Hardhat console output for error messages
2. Check Basescan for transaction status
3. Check `.env.local` has all required variables
4. Ensure you're on the correct network in MetaMask
5. Check browser console for frontend errors

