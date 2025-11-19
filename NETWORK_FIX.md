# Network Detection Fix

## Issues Fixed

### 1. Wrong Network Detection
**Problem:** The payment dialog was showing "Connected to Base" even when the wallet was on Arbitrum or another network.

**Root Cause:** Using `useChainId()` which returns the configured chain from Wagmi config, not the actual connected chain from the user's wallet.

**Solution:** Changed to use `useAccount()` hook's `chain` property:
```typescript
// Before (incorrect)
const chainId = useChainId();

// After (correct)
const { address, chain } = useAccount();
const chainId = chain?.id; // Gets actual connected chain
```

### 2. HTML Nesting Error
**Problem:** React hydration error: `<div>` cannot be a descendant of `<p>`.

**Root Cause:** `AlertDialogDescription` renders as a `<p>` tag, but we were nesting `<div>` elements inside it.

**Solution:** Moved the network status indicator outside of `AlertDialogDescription`:
```tsx
<AlertDialogHeader>
  <AlertDialogTitle>Confirm payment</AlertDialogTitle>
  <AlertDialogDescription>
    Execute "{toolName}" for ${price} USDC?
  </AlertDialogDescription>
</AlertDialogHeader>

{/* Network indicator now outside, as a sibling */}
<div className="space-y-3 px-6">
  <div className="flex items-center gap-2...">
    {/* Network status */}
  </div>
</div>
```

## Testing

To verify the fix works:

1. **Connect wallet to Arbitrum:**
   - Open MetaMask
   - Switch to Arbitrum network
   - Refresh the app

2. **Trigger payment dialog:**
   - Select a tool
   - Type a message and click Send

3. **Expected behavior:**
   - Dialog shows: ⚠️ "Wrong network detected"
   - "Switch to Base" button is visible
   - "Pay & run" button is NOT visible

4. **Click "Switch to Base":**
   - MetaMask prompts network switch
   - After switching, dialog updates to: ✅ "Connected to Base"
   - "Pay & run" button becomes visible

5. **No console errors:**
   - Check browser console
   - Should NOT see: "In HTML, <div> cannot be a descendant of <p>"

## Technical Details

### Why `useChainId()` was wrong:
- `useChainId()` returns the first chain from your Wagmi config
- Since we only configured `base` in `lib/wagmi.ts`, it always returned Base's chain ID (8453)
- This is the "default" or "preferred" chain, not the user's actual connected chain

### Why `chain?.id` from `useAccount()` is correct:
- `useAccount()` returns the actual wallet connection state
- `chain` property reflects what network the user's wallet is currently on
- Returns `undefined` if wallet is disconnected
- Updates reactively when user switches networks in MetaMask

### Optional chaining (`?.`):
- We use `chain?.id` because `chain` can be `undefined` when wallet is disconnected
- This prevents runtime errors
- The comparison `chainId === base.id` will be `false` when `chainId` is `undefined`, which is correct behavior

## Files Changed

1. `/components/tools/payment-dialog.tsx`
   - Restructured JSX to avoid `<p>` nesting
   - Added `px-6` padding to network indicator container

2. `/components/multimodal-input.tsx`
   - Changed from `useChainId()` to `useAccount().chain?.id`
   - Ensures accurate network detection

## Related Documentation

- Wagmi `useAccount`: https://wagmi.sh/react/api/hooks/useAccount
- Wagmi `useChainId`: https://wagmi.sh/react/api/hooks/useChainId
- React Hydration: https://react.dev/reference/react-dom/client/hydrateRoot#avoiding-hydration-errors

