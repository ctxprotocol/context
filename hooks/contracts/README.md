# Using ContextRouter Contract Hooks

All contract hooks are **auto-generated** by Wagmi CLI in `lib/generated.ts`.

Just import them directly - no wrappers needed! 🎉

---

## 📚 Quick Reference

### Read Hooks (View Data)

```typescript
import {
  useReadContextRouterGetUnclaimedBalance,
  useReadContextRouterGetPlatformBalance,
  useReadContextRouterPlatformFeePercent,
  useReadContextRouterUsdc,
  useReadContextRouterOwner,
} from '@/lib/generated';

// Check developer's unclaimed earnings
const { data: balance } = useReadContextRouterGetUnclaimedBalance({
  args: ['0xDeveloperAddress']
});

// Check platform fees
const { data: platformFees } = useReadContextRouterGetPlatformBalance();

// Get contract constants
const { data: feePercent } = useReadContextRouterPlatformFeePercent();
```

### Write Hooks (Transactions)

```typescript
import {
  useWriteContextRouterExecutePaidQuery,
  useWriteContextRouterClaimEarnings,
  useWriteContextRouterClaimPlatformFees,
} from '@/lib/generated';
import { parseUnits } from 'viem';

// Execute a paid query
const { writeContract: executePaidQuery } = useWriteContextRouterExecutePaidQuery();

await executePaidQuery({
  args: [
    1n,                           // toolId (bigint)
    '0xDeveloperAddress',         // developerWallet
    parseUnits('0.01', 6)        // amount in USDC (6 decimals)
  ]
});

// Claim earnings (developer)
const { writeContract: claimEarnings } = useWriteContextRouterClaimEarnings();
await claimEarnings({});

// Claim platform fees (owner only)
const { writeContract: claimPlatformFees } = useWriteContextRouterClaimPlatformFees();
await claimPlatformFees({});
```

### Event Watching Hooks

```typescript
import {
  useWatchContextRouterQueryPaidEvent,
  useWatchContextRouterEarningsClaimedEvent,
} from '@/lib/generated';

// Watch for QueryPaid events
useWatchContextRouterQueryPaidEvent({
  onLogs(logs) {
    console.log('New payment:', logs);
  }
});

// Watch for EarningsClaimed events
useWatchContextRouterEarningsClaimedEvent({
  onLogs(logs) {
    console.log('Developer claimed:', logs);
  }
});
```

---

## 🎯 Complete Example: Payment Flow

```typescript
'use client';

import { useState } from 'react';
import { 
  useWriteContextRouterExecutePaidQuery,
  useReadContextRouterGetUnclaimedBalance,
  useWaitForTransactionReceipt
} from '@/lib/generated';
import { parseUnits, formatUnits } from 'viem';

export function PaymentButton({ 
  toolId, 
  developerWallet 
}: { 
  toolId: bigint;
  developerWallet: `0x${string}`;
}) {
  const [lastTxHash, setLastTxHash] = useState<`0x${string}`>();
  
  // Execute payment
  const { writeContract, isPending, data: txHash } = 
    useWriteContextRouterExecutePaidQuery();
  
  // Wait for confirmation
  const { isLoading: isConfirming, isSuccess } = 
    useWaitForTransactionReceipt({ hash: txHash });
  
  // Check developer's balance
  const { data: balanceWei } = useReadContextRouterGetUnclaimedBalance({
    args: [developerWallet]
  });
  
  const balanceUSD = balanceWei 
    ? Number(formatUnits(balanceWei, 6)) 
    : 0;
  
  const handlePay = async () => {
    try {
      await writeContract({
        args: [
          toolId,
          developerWallet,
          parseUnits('0.01', 6)  // $0.01 USDC
        ]
      });
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };
  
  return (
    <div>
      <button 
        onClick={handlePay} 
        disabled={isPending || isConfirming}
      >
        {isPending && 'Confirming in wallet...'}
        {isConfirming && 'Processing...'}
        {!isPending && !isConfirming && 'Pay $0.01'}
      </button>
      
      {isSuccess && <p>✅ Payment successful!</p>}
      
      <p>Developer Balance: ${balanceUSD.toFixed(2)}</p>
    </div>
  );
}
```

---

## 🧮 Helper: USD ↔ USDC Conversion

USDC has 6 decimals. Use Viem's utilities:

```typescript
import { parseUnits, formatUnits } from 'viem';

// USD → USDC wei (for contract calls)
const usdcWei = parseUnits('0.01', 6);  // 10000n

// USDC wei → USD (for display)
const usd = formatUnits(10000n, 6);     // "0.01"
const usdNumber = Number(formatUnits(10000n, 6)); // 0.01
```

---

## 🔄 Regenerate After Contract Changes

When you update `ContextRouter.sol`:

```bash
# 1. Recompile contract
cd hardhat
pnpm hardhat compile

# 2. Regenerate hooks
cd ..
pnpm wagmi
```

All hooks in `lib/generated.ts` update automatically! ✨

---

## 📖 Full Hook List

### Read Hooks
- `useReadContextRouterGetUnclaimedBalance` - Check developer earnings
- `useReadContextRouterGetPlatformBalance` - Check platform fees
- `useReadContextRouterPlatformFeePercent` - Get fee % (10%)
- `useReadContextRouterUsdc` - Get USDC contract address
- `useReadContextRouterOwner` - Get contract owner
- `useReadContextRouterDeveloperBalances` - Get raw balance mapping
- `useReadContextRouterPlatformBalance` - Get raw platform balance

### Write Hooks
- `useWriteContextRouterExecutePaidQuery` - Pay for a query
- `useWriteContextRouterClaimEarnings` - Developer withdraws earnings
- `useWriteContextRouterClaimPlatformFees` - Platform withdraws fees (owner only)
- `useWriteContextRouterTransferOwnership` - Transfer contract ownership
- `useWriteContextRouterRenounceOwnership` - Renounce ownership

### Simulate Hooks (Test Before Executing)
- `useSimulateContextRouterExecutePaidQuery`
- `useSimulateContextRouterClaimEarnings`
- `useSimulateContextRouterClaimPlatformFees`

### Event Watching Hooks
- `useWatchContextRouterQueryPaidEvent` - Watch payment events
- `useWatchContextRouterEarningsClaimedEvent` - Watch earnings claims
- `useWatchContextRouterPlatformFeesClaimedEvent` - Watch platform claims
- `useWatchContextRouterOwnershipTransferredEvent` - Watch ownership changes

---

## 🔗 Resources

- [Wagmi Hooks Documentation](https://wagmi.sh/react/hooks/useWriteContract)
- [Viem Utilities](https://viem.sh/docs/utilities/parseUnits.html)
- [Context Payment Infrastructure Plan](../../context-payment-mvp.plan.md)

