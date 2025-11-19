# End-to-End Testing Guide: Context Payment MVP

## Overview
This guide walks through testing the complete payment flow for AI tools on Base Mainnet.

## Prerequisites
- ✅ ContextRouter deployed to Base Mainnet
- ✅ Blocknative Gas tool seeded in database
- ✅ MetaMask or compatible wallet installed
- ✅ Base Mainnet USDC for testing (≥$0.01)
- ✅ Small amount of ETH on Base for gas fees

## Environment Setup

### Required Environment Variables
```bash
# Base Mainnet RPC
BASE_MAINNET_RPC_URL="https://base-mainnet.infura.io/v3/YOUR_KEY"

# Contract Addresses
NEXT_PUBLIC_CONTEXT_ROUTER_ADDRESS="0x..." # Your deployed router
NEXT_PUBLIC_USDC_ADDRESS="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"

# Blocknative API
BLOCKNATIVE_API_KEY="your_key_here"

# Platform Treasury
PLATFORM_TREASURY_ADDRESS="your_deployer_address"
```

## Test Scenarios

### 1. Network Detection & Switching

**Objective:** Verify the payment dialog correctly detects the network and prompts users to switch.

#### Steps:
1. **Start on wrong network:**
   - Connect wallet to Arbitrum or Ethereum mainnet
   - Navigate to the chat interface at `http://localhost:3000`
   - Authenticate with Privy

2. **Select a tool:**
   - Click the "Tools" button (box icon) next to the model selector
   - In the Tools sidebar, click "Blocknative Gas (Base)"
   - Verify the tool badge appears above the input field

3. **Trigger payment dialog on wrong network:**
   - Type a message (e.g., "What is the gas price?")
   - Click Send
   - **Expected:** Payment dialog opens showing:
     - ⚠️ "Wrong network detected" with orange indicator
     - Helper text: "All payments are executed on Base mainnet..."
     - "Switch to Base" button enabled
     - "Pay & run" button NOT visible

4. **Switch network:**
   - Click "Switch to Base" button
   - **Expected:** MetaMask prompts network switch
   - Approve the network switch in MetaMask
   - **Expected:** 
     - Success toast: "Successfully switched to Base"
     - Dialog updates to show ✅ "Connected to Base" with green indicator
     - "Switch to Base" button disappears
     - "Pay & run" button appears and is enabled

### 2. USDC Approval Flow

**Objective:** Test first-time USDC approval for the ContextRouter contract.

#### Steps:
1. **Ensure on Base Mainnet:**
   - MetaMask should show "Base" network
   - Dialog shows ✅ "Connected to Base"

2. **Initiate first payment:**
   - Click "Pay & run" button
   - **Expected:** MetaMask opens with USDC approval request:
     - Contract: ContextRouter address
     - Token: USDC
     - Amount: 0.01 USDC

3. **Approve USDC spending:**
   - Click "Confirm" in MetaMask
   - **Expected:**
     - Dialog shows "Processing..."
     - Both buttons disabled during transaction

4. **Wait for approval confirmation:**
   - **Expected:** After ~2-5 seconds:
     - Approval transaction confirms
     - MetaMask immediately prompts for second transaction (executePaidQuery)

### 3. Tool Execution & Payment

**Objective:** Verify the complete payment → execution → result injection flow.

#### Steps:
1. **Execute payment transaction:**
   - After approval, MetaMask shows executePaidQuery call
   - **Verify transaction details:**
     - Function: `executePaidQuery`
     - Parameters visible: toolId (0), developer wallet, amount (10000 wei = $0.01)
   - Click "Confirm"

2. **Monitor transaction progress:**
   - **Expected dialog states:**
     - "Processing..." with spinner
     - All buttons disabled
   - **Expected in MetaMask Activity:**
     - Transaction shows "Pending"
     - Network: Base
     - To: ContextRouter contract

3. **Transaction confirmation:**
   - After ~2-5 seconds, transaction confirms
   - **Expected:** Dialog closes automatically

4. **Tool result injection:**
   - **Expected in chat:**
     - User message appears with injected tool result
     - Message format: `[Tool Blocknative Gas (Base)]: {"...gas data..."}`
     - AI response streams normally using the injected context

5. **Verify on Basescan:**
   - Click transaction in MetaMask → "View on block explorer"
   - **Verify on Basescan:**
     - Status: Success ✅
     - To: ContextRouter contract address
     - Method: `executePaidQuery`
     - Logs show: `QueryPaid` event with correct amounts

### 4. Subsequent Payments (No Approval)

**Objective:** Verify second payment skips approval (allowance already granted).

#### Steps:
1. **Select tool again:**
   - Click "Tools" → "Blocknative Gas (Base)"
   - Type another message
   - Click Send

2. **Initiate second payment:**
   - Dialog opens, showing ✅ "Connected to Base"
   - Click "Pay & run"

3. **Expected:** 
   - MetaMask opens with ONLY executePaidQuery (no approval step)
   - Single confirmation → immediate execution
   - **Faster flow:** ~2-3 seconds total

### 5. Error Handling

**Objective:** Test various failure scenarios.

#### Test 5a: User Cancels Network Switch
1. Start on wrong network
2. Open payment dialog → Click "Switch to Base"
3. In MetaMask, click "Cancel" on network switch
4. **Expected:**
   - Error toast: "Failed to switch network. Please try again."
   - Dialog remains open
   - Still shows wrong network state
   - "Switch to Base" button re-enabled

#### Test 5b: User Cancels Approval
1. Ensure on Base
2. Click "Pay & run" → MetaMask shows approval
3. Click "Reject" in MetaMask
4. **Expected:**
   - Error toast: "Payment failed. Please try again."
   - Dialog closes
   - No charge to user

#### Test 5c: Insufficient USDC Balance
1. Ensure wallet has < $0.01 USDC
2. Try to make payment
3. **Expected:**
   - MetaMask shows error: "Insufficient funds"
   - Transaction fails before submission
   - No gas fees charged

#### Test 5d: User Cancels Payment
1. After approval, MetaMask shows executePaidQuery
2. Click "Reject"
3. **Expected:**
   - Error toast: "Payment failed. Please try again."
   - Dialog closes
   - USDC approval remains (can retry faster)

### 6. Developer Earnings

**Objective:** Verify the 90/10 split and developer claim flow.

#### Steps:
1. **Make 10 test payments:**
   - Repeat payment flow 10 times
   - Total spent: $0.10 USDC

2. **Check developer dashboard:**
   - Navigate to `/my-tools` (or your developer dashboard route)
   - **Expected display:**
     - Tool: "Blocknative Gas (Base)"
     - Total queries: 10
     - Total revenue: $0.10
     - Claimable earnings: $0.09 (90% of $0.10)

3. **Claim earnings:**
   - Click "Claim Earnings" button
   - MetaMask prompts `claimEarnings()` call
   - Confirm transaction

4. **Verify payout:**
   - After confirmation, check wallet USDC balance
   - **Expected:** +$0.09 USDC received
   - Dashboard shows: Claimable earnings: $0.00

5. **Verify on contract:**
   - On Basescan, call ContextRouter `getUnclaimedBalance(developerAddress)`
   - **Expected:** Returns 0

### 7. Platform Fee Collection

**Objective:** Verify platform owner can claim accumulated fees.

#### Steps:
1. **Connect as platform owner:**
   - Use deployer wallet in MetaMask
   - Navigate to admin/treasury page (if built) or use Basescan

2. **Check platform balance:**
   - On Basescan: Read Contract → `getPlatformBalance()`
   - **Expected:** Shows accumulated 10% fees
     - Example: After 10 queries @ $0.01 = $0.01 total platform fees

3. **Claim platform fees:**
   - Write Contract → `claimPlatformFees()`
   - Confirm transaction

4. **Verify payout:**
   - Platform wallet receives USDC
   - `getPlatformBalance()` returns 0

## Success Criteria Checklist

- [ ] Payment dialog correctly detects Base vs. other networks
- [ ] "Switch to Base" button works and updates UI instantly
- [ ] Green ✅ indicator shows when on correct network
- [ ] First payment requires USDC approval + execution (2 transactions)
- [ ] Subsequent payments skip approval (1 transaction)
- [ ] Tool results are successfully injected into chat context
- [ ] AI responds using the injected tool data
- [ ] Transaction hashes are recorded in database
- [ ] Developer earnings are correctly calculated (90%)
- [ ] Platform fees are correctly calculated (10%)
- [ ] Error states provide clear user feedback
- [ ] Canceled transactions don't charge users
- [ ] All transactions visible on Basescan under ContextRouter address

## Common Issues & Solutions

### Issue: "Missing wallet or contract configuration"
**Solution:** Check environment variables are loaded correctly. Restart dev server.

### Issue: "Please switch to Base mainnet first" even when on Base
**Solution:** Clear site permissions in MetaMask, reconnect, ensure MetaMask shows "Base" in network dropdown.

### Issue: Approval succeeds but execution fails
**Solution:** Check USDC balance after approval fee. You may have enough to approve but not to execute + pay gas.

### Issue: Transaction confirmed but no tool result appears
**Solution:** Check browser console for API errors. Verify `/api/tools/execute` endpoint is working.

### Issue: Tool execution fails with "Tool not found"
**Solution:** Verify Blocknative tool is seeded: `npx tsx scripts/seed-blocknative-tool.ts`

## Monitoring & Debugging

### Check Transaction Status
```bash
# View transaction on Basescan
https://basescan.org/tx/{TRANSACTION_HASH}
```

### Check Contract State
```bash
# On Basescan → ContextRouter contract → Read Contract
- getUnclaimedBalance(developerAddress)
- getPlatformBalance()
```

### Check Database Records
```sql
-- Verify tool query was recorded
SELECT * FROM tool_query 
WHERE transaction_hash = 'YOUR_TX_HASH' 
ORDER BY executed_at DESC 
LIMIT 10;

-- Check developer earnings
SELECT 
  t.name,
  t.total_queries,
  t.total_revenue
FROM ai_tool t
WHERE t.developer_id = 'YOUR_DEV_ID';
```

### Browser Console Debugging
```javascript
// Check current chain
window.ethereum.request({ method: 'eth_chainId' })
  .then(chainId => console.log('Chain ID:', parseInt(chainId, 16)));

// Check USDC balance
// (Paste in console after connecting wallet)
```

## Post-Testing Cleanup

1. **Document any issues** encountered during testing
2. **Save transaction hashes** for successful payments
3. **Record gas costs** for each operation type:
   - Approval: ~X ETH
   - ExecutePaidQuery: ~Y ETH
4. **Calculate total costs** for 10-query test run
5. **Update documentation** with actual observed timings

## Next Steps After Successful E2E Test

- [ ] Deploy ContextRouter to production with real funds
- [ ] Set up transaction monitoring/alerts
- [ ] Create developer onboarding flow documentation
- [ ] Build admin dashboard for platform fee management
- [ ] Implement automatic tool verification system
- [ ] Add analytics dashboard for query volumes
- [ ] Consider gas optimization if costs are high

