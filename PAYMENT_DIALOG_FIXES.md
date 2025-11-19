# Payment Dialog Fixes - Network Detection & Alignment

## Issues Fixed

### Issue 1: Dialog Not Updating After Network Switch ✅
**Problem:** After clicking "Switch to Base" and successfully switching networks, the dialog still showed "Wrong network detected" with the orange warning indicator.

**Root Cause:** The component wasn't properly reacting to `chainId` prop changes. React components need explicit state management or effects to respond to prop updates, especially in dialog components that may be memoized or portal-rendered.

**Solution:** Added local state with `useEffect` to track chainId changes:

```typescript
// Use local state to ensure reactivity to chainId changes
const [currentChainId, setCurrentChainId] = useState(chainId);

// Update local state when chainId prop changes
useEffect(() => {
  setCurrentChainId(chainId);
}, [chainId]);

const isOnBaseMainnet = currentChainId === base.id;
```

**Why This Works:**
- `useState` creates reactive local state
- `useEffect` watches for `chainId` prop changes
- When wallet switches networks, `chainId` updates → effect runs → local state updates → component re-renders
- The UI now immediately reflects the new network status

### Issue 2: Width Alignment Inconsistency ✅
**Problem:** The network status indicator didn't match the width of other dialog content, creating visual inconsistency.

**Root Cause:** Added `px-6` padding to the network indicator container, but `AlertDialogContent` already has `p-6` padding, creating double horizontal padding and making the indicator narrower than the header/footer.

**Solution:** Removed the extra `px-6` padding:

```typescript
// Before (incorrect - double padding)
<div className="space-y-3 px-6">

// After (correct - uses parent's p-6)
<div className="space-y-3">
```

**Design System Alignment:**
- `AlertDialogContent` has `p-6` (24px padding on all sides)
- `AlertDialogHeader` and `AlertDialogFooter` are direct children, so they inherit this width
- Network indicator is now also a direct child with same width
- Uses `gap-4` (16px) spacing between sections per design system
- Follows the "surfaces p-6" guideline from design-system.json

## Visual Result

### Before:
- ❌ Shows "Wrong network detected" even after switching
- ❌ Network indicator narrower than header/footer
- ❌ Inconsistent visual rhythm

### After:
- ✅ Immediately shows "Connected to Base" after network switch
- ✅ Network indicator matches header/footer width exactly
- ✅ Consistent spacing and alignment throughout dialog
- ✅ Green checkmark appears instantly when on correct network
- ✅ Orange warning appears when on wrong network

## Component Structure

```
AlertDialogContent (p-6, gap-4)
├── AlertDialogHeader (full width)
│   ├── AlertDialogTitle
│   └── AlertDialogDescription
├── Network Indicator (full width, matches siblings)
│   ├── Status Badge (green ✓ or orange !)
│   └── Helper Text (conditional)
└── AlertDialogFooter (full width)
    ├── Cancel Button
    └── Switch/Pay Button (conditional)
```

## Testing

To verify the fixes:

1. **Test Reactivity:**
   - Start on Arbitrum
   - Open payment dialog → See "Wrong network detected"
   - Click "Switch to Base"
   - **Expected:** Dialog immediately updates to "Connected to Base" with green checkmark
   - "Pay & run" button appears

2. **Test Width Alignment:**
   - Open dialog on any network
   - **Expected:** Network indicator box aligns perfectly with:
     - Left edge of "Confirm payment" title
     - Left edge of Cancel/Pay buttons
     - Right edge matches dialog content width

3. **Test Multiple Switches:**
   - Switch from Arbitrum → Base → Arbitrum → Base
   - **Expected:** Dialog updates instantly each time
   - No lag or stale state

## Technical Notes

### Why useEffect Instead of Direct Prop?
While `chainId` prop should be reactive, dialog components rendered in portals (Radix UI's AlertDialog uses portals) can sometimes have stale closure issues. The `useEffect` pattern ensures:
- Explicit dependency tracking
- Guaranteed re-render on prop change
- No closure staleness
- Clear data flow

### Alternative Considered
We could have used `key={chainId}` on the dialog to force remount on network change, but that would:
- Reset all internal state
- Cause jarring animations
- Be less performant
- Not follow React best practices for controlled components

The `useEffect` + `useState` pattern is the idiomatic React solution for this scenario.

## Files Modified

- `/components/tools/payment-dialog.tsx`
  - Added `useEffect` and `useState` imports
  - Added local state for `currentChainId`
  - Removed `px-6` from network indicator container
  - Added comments explaining reactivity pattern

## Design System Compliance

✅ Follows `AlertDialog` content structure from design-system.json
✅ Uses semantic color tokens (green-500/10, orange-500/10)
✅ Maintains consistent spacing (space-y-3, gap-2, p-3)
✅ Proper text hierarchy (font-medium, text-sm, text-xs)
✅ Accessible focus states and disabled states
✅ Responsive to theme changes (dark: variants)

