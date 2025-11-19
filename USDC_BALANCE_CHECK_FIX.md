# USDC Balance Check Fix

## Issue Fixed ✅

### Problem
When clicking "Pay & run", MetaMask would timeout with error:
```
ContractFunctionExecutionError: An unknown RPC error occurred.
Details: Wallet timeout
```

This was happening because the payment flow wasn't checking if the user had enough USDC before attempting the transaction.

### Root Cause
The payment flow was:
1. Check USDC allowance ✅
2. Approve if needed ✅
3. Call `executePaidQuery` ❌ **Failed here**

The contract's `safeTransferFrom` would fail if the user didn't have enough USDC, but MetaMask couldn't estimate gas properly, resulting in a generic "Wallet timeout" error instead of a clear "insufficient balance" message.

## What Was Fixed

### Added USDC Balance Check

Now the payment flow checks the user's USDC balance **before** attempting the transaction:

```typescript
const confirmPayment = useCallback(async () => {
  // ... (network checks)
  
  try {
    setIsPaying(true);
    
    const amount = parseUnits(primaryTool.pricePerQuery ?? "0.00", 6);
    
    // ✅ NEW: Check USDC balance first
    const { data: balanceData } = await refetchBalance();
    const balance = (balanceData as bigint | undefined) ?? 0n;
    
    if (balance < amount) {
      toast.error(
        `Insufficient USDC balance. You need ${primaryTool.pricePerQuery} USDC on Base mainnet.`
      );
      setIsPaying(false);
      setShowPayDialog(false);
      return; // Stop here - don't attempt transaction
    }
    
    // Check and handle allowance
    const allowanceRes = await refetchAllowance();
    const allowance = (allowanceRes.data as bigint | undefined) ?? 0n;
    if (allowance < amount) {
      console.info("Requesting USDC approval...");
      await writeErc20Async({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress, amount],
      });
      
      // Wait for approval to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Execute payment
    console.info("Executing payment transaction...");
    writeExecute({
      args: [0n, primaryTool.developerWallet as `0x${string}`, amount],
    });
  } catch (error) {
    // Enhanced error handling...
  }
}, [
  primaryTool,
  address,
  chainId,
  routerAddress,
  usdcAddress,
  refetchBalance, // ✅ Added dependency
  refetchAllowance,
  writeErc20Async,
  writeExecute,
]);
```

### Enhanced Error Messages

Added specific error handling for different failure scenarios:

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("user rejected") ||
    errorMessage.includes("User denied")
  ) {
    console.info("User cancelled payment/approval");
    toast.error("Transaction cancelled");
  } else if (
    errorMessage.includes("insufficient funds") ||
    errorMessage.includes("Insufficient")
  ) {
    console.error("Insufficient USDC:", error);
    toast.error("Insufficient USDC balance"); // ✅ Clear message
  } else {
    console.error("Payment failed:", error);
    toast.error("Payment failed. Please try again.");
  }

  setIsPaying(false);
  setShowPayDialog(false);
}
```

### Added Logging

Added console logging to track payment flow:

```typescript
// When requesting approval
console.info("Requesting USDC approval...");

// When executing payment
console.info("Executing payment transaction...");

// When user cancels
console.info("User cancelled payment/approval");

// When insufficient balance
console.error("Insufficient USDC:", error);
```

## How It Works Now

### Payment Flow with Balance Check

```
User clicks "Pay & run"
    ↓
Check network (must be Base mainnet)
    ↓
Check USDC balance
    ↓
[If balance < 0.01 USDC]
    ↓
❌ Show: "Insufficient USDC balance. You need 0.01 USDC on Base mainnet."
    ↓
Close dialog, reset state
    ↓
User can't proceed

[If balance >= 0.01 USDC]
    ↓
Check USDC allowance
    ↓
[If allowance < 0.01]
    ↓
Request approval from user
    ↓
Wait 2 seconds for approval to mine
    ↓
Execute payment transaction
    ↓
Wait for confirmation
    ↓
Execute tool & inject result
```

### Error Messages by Scenario

| Scenario | Old Behavior | New Behavior |
|----------|-------------|--------------|
| **No USDC** | "Wallet timeout" (confusing) | "Insufficient USDC balance. You need 0.01 USDC on Base mainnet." |
| **User cancels** | Red error overlay | "Transaction cancelled" (toast only) |
| **Network error** | Generic error | "Payment failed. Please try again." |
| **Wrong network** | Proceeds then fails | Blocked with "Please switch to Base mainnet first." |

## Testing

### Test Case 1: No USDC Balance
1. **Setup:** Empty wallet or < 0.01 USDC on Base mainnet
2. **Action:** Click "Pay & run"
3. **Expected:**
   - ✅ Toast: "Insufficient USDC balance. You need 0.01 USDC on Base mainnet."
   - ✅ Dialog closes immediately
   - ✅ No MetaMask popup
   - ✅ No "Wallet timeout" error

### Test Case 2: Sufficient USDC Balance
1. **Setup:** >= 0.01 USDC on Base mainnet
2. **Action:** Click "Pay & run" → Confirm in MetaMask
3. **Expected:**
   - ✅ Console: "Executing payment transaction..."
   - ✅ MetaMask popup appears
   - ✅ Transaction confirms
   - ✅ Tool executes
   - ✅ Result appears in chat

### Test Case 3: First-Time Payment (Needs Approval)
1. **Setup:** >= 0.01 USDC, no prior approval
2. **Action:** Click "Pay & run" → Confirm approval → Confirm payment
3. **Expected:**
   - ✅ Console: "Requesting USDC approval..."
   - ✅ First MetaMask popup (approval)
   - ✅ 2-second wait
   - ✅ Console: "Executing payment transaction..."
   - ✅ Second MetaMask popup (payment)
   - ✅ Tool executes

### Test Case 4: User Cancels
1. **Action:** Click "Pay & run" → Click "Reject" in MetaMask
2. **Expected:**
   - ✅ Console: "User cancelled payment/approval"
   - ✅ Toast: "Transaction cancelled"
   - ✅ Dialog closes
   - ✅ No red error overlay

## How to Get USDC on Base Mainnet

If you see "Insufficient USDC balance", you need to get USDC on Base mainnet:

### Option 1: Bridge from Ethereum or Other Chains
1. Go to https://bridge.base.org/
2. Connect your wallet
3. Bridge USDC from Ethereum mainnet to Base
4. Wait for bridge confirmation (~10 minutes)

### Option 2: Buy Directly on Base
1. Use a DEX on Base (e.g., Uniswap, Aerodrome)
2. Swap ETH → USDC
3. Make sure you have enough ETH for gas

### Option 3: Use a CEX
1. Withdraw USDC from Coinbase/Binance/etc.
2. Select "Base" as the network
3. Send to your wallet address

### Verify You Have USDC
1. Add USDC token to MetaMask:
   - Token Address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - Symbol: USDC
   - Decimals: 6
2. Check your balance shows >= 0.01 USDC

## Technical Details

### Why Check Balance Before Transaction?

**Without balance check:**
```
User clicks pay
    ↓
MetaMask tries to estimate gas
    ↓
Contract.executePaidQuery() would revert (insufficient USDC)
    ↓
Gas estimation fails
    ↓
MetaMask shows: "Wallet timeout" ❌ (confusing)
```

**With balance check:**
```
User clicks pay
    ↓
Check balance in frontend
    ↓
If insufficient: show clear error ✅
    ↓
If sufficient: proceed to MetaMask
```

### Why Wait 2 Seconds After Approval?

```typescript
await new Promise(resolve => setTimeout(resolve, 2000));
```

This gives the approval transaction time to be mined before we attempt the payment transaction. Without this:
- Approval transaction is submitted
- Payment transaction is submitted immediately
- Payment might fail because approval isn't confirmed yet
- User sees confusing error

With the 2-second wait:
- Approval transaction is submitted
- Wait 2 seconds (usually enough for 1 block on Base)
- Payment transaction is submitted
- Approval is already confirmed ✅

### Balance vs Allowance

These are two different checks:

**Balance:**
- How much USDC you own
- Checked with: `balanceOf(userAddress)`
- Must be >= payment amount

**Allowance:**
- How much USDC the router can spend on your behalf
- Checked with: `allowance(userAddress, routerAddress)`
- Must be >= payment amount
- Set with: `approve(routerAddress, amount)`

Both must be sufficient for the payment to succeed.

## Related Files

- `/components/multimodal-input.tsx` - Payment flow logic
- `/hardhat/contracts/ContextRouter.sol` - Smart contract (unchanged)
- `/lib/abi/erc20.ts` - ERC20 ABI for balance/allowance checks

## Summary

**Before:** "Wallet timeout" error when user had no USDC
**After:** Clear error message before attempting transaction

The fix:
1. ✅ Checks USDC balance before transaction
2. ✅ Shows clear error if insufficient
3. ✅ Prevents confusing "Wallet timeout" errors
4. ✅ Adds helpful logging for debugging
5. ✅ Improves error messages for all scenarios

This provides a much better UX and makes it immediately clear when the user needs to get USDC on Base mainnet!

