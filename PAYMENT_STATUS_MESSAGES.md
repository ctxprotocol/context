# Payment Status Messages in Chat

## What Was Added ✅

Added **temporary status messages** in the chat message area (not just the input composer) to show the payment and tool execution lifecycle.

### The Flow Now

When a user sends a message with a tool selected and confirms payment:

1. **"Processing payment..."**  
   - Appears immediately after clicking "Pay & run" in the payment dialog
   - Shows while:
     - Checking USDC balance
     - Checking/requesting USDC allowance (if needed)
     - Waiting for user to confirm in MetaMask
     - Waiting for on-chain confirmation

2. **"Running Blocknative Gas (Base)..."**  
   - Replaces "Processing payment..." once the payment transaction is confirmed
   - Shows while:
     - Verifying payment on-chain
     - Calling `/api/tools/blocknative`
     - Recording the query in the database

3. **"Thinking..."**  
   - Replaces "Running..." once the tool result is injected
   - Shows while:
     - AI model is processing the augmented prompt
     - Streaming the response

### Implementation Details

#### 1. Payment Status Message

In `confirmPayment`:

```typescript
try {
  setIsPaying(true);
  
  // Add a temporary "assistant" message showing payment status
  const tempId = `temp-payment-${Date.now()}`;
  setMessages((prev) => [
    ...prev,
    {
      id: tempId,
      role: "assistant",
      content: "Processing payment...",
      createdAt: new Date(),
    },
  ]);

  // ... balance checks, allowance, writeExecute ...
}
```

#### 2. Tool Execution Status Message

In the post-payment `useEffect`:

```typescript
useEffect(() => {
  const proceed = async () => {
    if (!primaryTool || !lastExecutedTx) return;
    
    // Remove any "Processing payment..." messages and add tool execution status
    const tempId = `temp-tool-${Date.now()}`;
    setMessages((prev) => [
      ...prev.filter((msg) => !msg.id.startsWith("temp-payment")),
      {
        id: tempId,
        role: "assistant",
        content: `Running ${primaryTool.name}...`,
        createdAt: new Date(),
      },
    ]);
    
    try {
      // Call /api/tools/execute
      const response = await fetch("/api/tools/execute", { /* ... */ });
      const { data } = await response.json();

      // Remove the temporary status message
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      // Inject tool result and send to AI
      sendMessage({ /* ... */ });
    }
  };
  // ...
}, [isExecSuccess, lastExecutedTx, primaryTool, /* ... */]);
```

#### 3. Error Handling

If the user cancels or an error occurs:

```typescript
// In executeError useEffect:
useEffect(() => {
  if (executeError && isPaying) {
    // Remove any temp payment messages
    setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-payment")));
    
    // Show error toast
    toast.error("Transaction cancelled");
    
    // Reset state
    setIsPaying(false);
    setShowPayDialog(false);
    resetExecute();
  }
}, [executeError, isPaying, resetExecute, setMessages]);
```

### Why Temporary Messages?

These messages are **not persisted** to the database:
- They use temporary IDs like `temp-payment-${Date.now()}` and `temp-tool-${Date.now()}`
- They're filtered out before the next step
- They only exist in the React state to provide immediate UI feedback

This keeps the database clean while giving users real-time status updates.

### Design System Compliance

The temporary messages follow the existing message rendering:
- Use `role: "assistant"` so they appear on the left like AI responses
- Use the same `Message` component styling (no custom UI needed)
- Automatically get the correct typography, spacing, and theme colors from `design-system.json`
- No new components or custom styles required

### User Experience

**Before:**
```
[User types message with tool]
[Clicks Send]
[Payment dialog opens]
[Clicks "Pay & run"]
[Confirms in MetaMask]
[10+ seconds of silence...]
[Finally: "Thinking..." appears]
[Answer streams]
```

**After:**
```
[User types message with tool]
[Clicks Send]
[Payment dialog opens]
[Clicks "Pay & run"]
→ "Processing payment..." appears immediately
[Confirms in MetaMask]
→ "Running Blocknative Gas (Base)..." replaces it
[Tool executes]
→ "Thinking..." replaces it
[Answer streams]
```

### Edge Cases Handled

1. **User cancels payment:**
   - Temp message is removed
   - Toast: "Transaction cancelled"
   - Dialog closes

2. **Insufficient USDC:**
   - Temp message is removed
   - Toast: "Insufficient USDC balance..."
   - Dialog closes

3. **Tool execution fails:**
   - "Running..." message is removed
   - Toast: "Payment succeeded but tool execution failed"
   - Dialog closes

4. **Multiple rapid payments:**
   - Each gets its own temp ID with timestamp
   - Previous temp messages are cleaned up before adding new ones

### Testing

1. **Happy path:**
   - Select tool
   - Click Send
   - Click "Pay & run"
   - Confirm in MetaMask
   - **Expected:** See "Processing payment..." → "Running Blocknative Gas (Base)..." → "Thinking..." → Answer

2. **Cancel during payment:**
   - Select tool
   - Click Send
   - Click "Pay & run"
   - Click "Reject" in MetaMask
   - **Expected:** "Processing payment..." disappears, toast shows "Transaction cancelled"

3. **Network error:**
   - Disconnect internet after confirming payment
   - **Expected:** "Running..." eventually times out, toast shows error, temp message is removed

### Future Improvements

Consider adding:
- Progress percentage for multi-step operations
- Estimated time remaining
- Ability to cancel tool execution (if supported by backend)
- Retry button in error states
- More detailed status for approval vs payment steps

### Related Files

- `/components/multimodal-input.tsx` - Main implementation
- `/components/message.tsx` - Renders the temporary status messages (no changes needed)
- `/design/design-system.json` - Design tokens used for styling

### Summary

Users now see **continuous visual feedback** throughout the entire payment → tool → AI pipeline, eliminating the confusing 10+ second gap where nothing seemed to be happening.

The implementation is clean, uses existing components, follows the design system, and handles all error cases properly.

