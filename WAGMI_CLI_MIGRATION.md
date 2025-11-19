# ✅ Wagmi CLI Migration Complete

Successfully migrated from manual hooks to **Wagmi CLI auto-generated hooks**!

## 🎯 What Changed

### Before (Manual Approach)
- ❌ Manually wrote all hooks in `hooks/contracts/use-context-router.ts`
- ❌ Manually imported ABI from JSON
- ❌ Manual type definitions
- ❌ Had to update hooks whenever contract changed

### After (Wagmi CLI Approach)
- ✅ Auto-generated type-safe hooks in `lib/generated.ts`
- ✅ ABI automatically extracted from Hardhat artifacts
- ✅ TypeScript types generated automatically
- ✅ One command to regenerate: `pnpm wagmi`

---

## 📁 Files Added

### 1. `wagmi.config.ts` (project root)
Configuration file for Wagmi CLI:
```typescript
export default defineConfig({
  out: "lib/generated.ts",
  plugins: [
    react(), // Generates React hooks
    actions(), // Generates vanilla actions
    hardhat({
      project: "./hardhat",
      deployments: {
        ContextRouter: {
          8453: process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS, // Base Mainnet
          84532: process.env.NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA, // Base Sepolia
        },
      },
    }),
  ],
});
```

### 2. `lib/generated.ts` (auto-generated)
Contains all auto-generated hooks:
- `useReadContextRouterGetUnclaimedBalance`
- `useReadContextRouterGetPlatformBalance`
- `useWriteContextRouterExecutePaidQuery`
- `useWriteContextRouterClaimEarnings`
- `useWriteContextRouterClaimPlatformFees`
- And 20+ more hooks!

### 3. `hooks/contracts/README.md` (usage guide)
Simple documentation showing how to use the generated hooks directly:
- No wrapper layer needed
- Direct imports from `lib/generated.ts`
- Examples with USD ↔ USDC conversion using Viem utilities

---

## 🚀 How to Use

### Direct Usage (Recommended)
```typescript
import { 
  useWriteContextRouterExecutePaidQuery,
  useReadContextRouterGetUnclaimedBalance,
  useWriteContextRouterClaimEarnings 
} from '@/lib/generated';
import { parseUnits, formatUnits } from 'viem';

function PaymentComponent() {
  const { writeContract: executePaidQuery, isPending } = 
    useWriteContextRouterExecutePaidQuery();
  
  const { data: balanceWei } = useReadContextRouterGetUnclaimedBalance({
    args: ['0xDeveloperWallet']
  });
  
  const balanceUSD = balanceWei 
    ? Number(formatUnits(balanceWei, 6)) 
    : 0;
  
  const handlePay = async () => {
    await executePaidQuery({
      args: [
        1n,                           // toolId
        '0xDev...',                   // developerWallet
        parseUnits('0.01', 6)        // $0.01 USDC (6 decimals)
      ]
    });
  };
  
  return (
    <div>
      <p>Unclaimed: ${balanceUSD.toFixed(2)}</p>
      <button onClick={handlePay} disabled={isPending}>
        Pay $0.01
      </button>
    </div>
  );
}
```

### Advanced Usage (Simulate Before Executing)
```typescript
import { 
  useWriteContextRouterExecutePaidQuery,
  useSimulateContextRouterExecutePaidQuery 
} from '@/lib/generated';
import { parseUnits } from 'viem';

function AdvancedPayment() {
  // Test transaction before executing
  const { data: simulation } = useSimulateContextRouterExecutePaidQuery({
    args: [1n, '0xDev...', parseUnits('0.01', 6)]
  });
  
  const { writeContract } = useWriteContextRouterExecutePaidQuery();
  
  return (
    <button onClick={() => writeContract(simulation?.request)}>
      Execute Payment
    </button>
  );
}
```

---

## 🔄 Workflow After Contract Changes

### When You Update the Smart Contract:

1. **Recompile contract:**
   ```bash
   cd hardhat
   pnpm hardhat compile
   ```

2. **Regenerate hooks:**
   ```bash
   cd ..
   pnpm wagmi
   ```

3. **Done!** All hooks are now updated with your new contract ABI.

### Watch Mode (Auto-regenerate on changes):
```bash
pnpm wagmi:watch
```

---

## 📦 Package.json Scripts

Added two new scripts:
- `pnpm wagmi` - Generate hooks once
- `pnpm wagmi:watch` - Auto-regenerate on Hardhat artifact changes

---

## 🎨 Available Hooks

### Read Hooks
- `useReadContextRouterGetUnclaimedBalance(address)` - Check developer balance
- `useReadContextRouterGetPlatformBalance()` - Check platform fees
- `useReadContextRouterPlatformFeePercent()` - Get fee percentage (10%)
- `useReadContextRouterUsdc()` - Get USDC contract address
- `useReadContextRouterOwner()` - Get contract owner
- `useReadContextRouterDeveloperBalances(address)` - Raw balance mapping

### Write Hooks
- `useWriteContextRouterExecutePaidQuery()` - Execute paid query
- `useWriteContextRouterClaimEarnings()` - Claim developer earnings
- `useWriteContextRouterClaimPlatformFees()` - Claim platform fees (owner only)
- `useWriteContextRouterTransferOwnership()` - Transfer ownership
- `useWriteContextRouterRenounceOwnership()` - Renounce ownership

### Simulate Hooks (Test transactions before executing)
- `useSimulateContextRouterExecutePaidQuery()`
- `useSimulateContextRouterClaimEarnings()`
- `useSimulateContextRouterClaimPlatformFees()`

### Event Watching Hooks
- `useWatchContextRouterQueryPaidEvent()` - Watch QueryPaid events
- `useWatchContextRouterEarningsClaimedEvent()` - Watch EarningsClaimed events
- `useWatchContextRouterPlatformFeesClaimedEvent()` - Watch PlatformFeesClaimed events

---

## ✨ Benefits

1. **Type Safety** - Full TypeScript types from contract ABI
2. **Auto-completion** - IDE knows all function names and parameters
3. **Less Code** - No manual ABI imports or type definitions
4. **Maintainability** - One command to update after contract changes
5. **Error Prevention** - TypeScript catches mismatches between contract and frontend
6. **Event Support** - Auto-generated event watching hooks
7. **Simulation Support** - Test transactions before executing

---

## 🔧 Environment Variables

Make sure these are set in `.env.local`:

```bash
# After deployment, add contract addresses:
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS=0x...          # Base Mainnet
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS_SEPOLIA=0x...  # Base Sepolia (optional)
```

After adding these, run `pnpm wagmi` to update the generated file with deployment addresses.

---

## 📚 Resources

- [Wagmi CLI Documentation](https://wagmi.sh/cli/getting-started)
- [Privy + Wagmi Integration](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi)
- [Context Payment Infrastructure Plan](./context-payment-mvp.plan.md)

---

**Migration completed successfully!** 🎉

All hooks are now auto-generated and type-safe. Run `pnpm wagmi` anytime you update the smart contract.

