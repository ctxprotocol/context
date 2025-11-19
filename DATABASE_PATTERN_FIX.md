# Database Access Pattern Fix

## Issue Fixed ✅

### Problem
The payment verification flow was failing with:
```
Module not found: Can't resolve '@/lib/db'
```

**Root Cause:** Payment-related files were trying to import `db` directly from `@/lib/db`, but this export doesn't exist. The correct pattern is to use query functions from `@/lib/db/queries`.

### Why This Pattern?

The codebase follows a **repository pattern** where:
- ✅ **All database access goes through `@/lib/db/queries`**
- ✅ Query functions encapsulate database logic
- ✅ Provides consistent error handling
- ✅ Makes it easy to add caching, logging, or validation
- ❌ **Direct `db` imports are not exposed**

## Files Fixed

### 1. `/lib/tools/payment-verifier.ts`

**Before (broken):**
```typescript
import { eq } from "drizzle-orm";
import { db } from "@/lib/db"; // ❌ This doesn't exist
import { toolQuery } from "@/lib/db/schema";

// Later in code:
const existingQuery = await db.query.toolQuery.findFirst({
  where: eq(toolQuery.transactionHash, txHash),
});
```

**After (fixed):**
```typescript
import { getToolQueryByTransactionHash } from "@/lib/db/queries"; // ✅

// Later in code:
const existingQuery = await getToolQueryByTransactionHash({
  transactionHash: txHash,
});
```

### 2. `/app/(chat)/api/admin/verify-tool/route.ts`

**Before (broken):**
```typescript
import { eq } from "drizzle-orm";
import { db } from "@/lib/db"; // ❌
import { aiTool } from "@/lib/db/schema";

await db
  .update(aiTool)
  .set({ isVerified: true, verifiedBy: userId, verifiedAt: new Date() })
  .where(eq(aiTool.id, toolId));
```

**After (fixed):**
```typescript
import { verifyAITool } from "@/lib/db/queries"; // ✅

await verifyAITool({
  toolId,
  verifiedBy: userId,
});
```

### 3. `/lib/db/queries.ts` - New Functions Added

Added two new query functions to support the payment flow:

```typescript
/**
 * Check if a transaction hash has already been used
 * Prevents double-spending attacks
 */
export async function getToolQueryByTransactionHash({
  transactionHash,
}: {
  transactionHash: string;
}) {
  try {
    const queries = await db
      .select()
      .from(toolQuery)
      .where(eq(toolQuery.transactionHash, transactionHash))
      .limit(1);
    return queries[0] || null;
  } catch (error) {
    console.error("Failed to get tool query by transaction hash:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check transaction hash"
    );
  }
}

/**
 * Verify an AI tool (admin function)
 */
export async function verifyAITool({
  toolId,
  verifiedBy,
}: {
  toolId: string;
  verifiedBy: string;
}) {
  try {
    return await db
      .update(aiTool)
      .set({
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .where(eq(aiTool.id, toolId));
  } catch (error) {
    console.error("Failed to verify tool:", error);
    throw new ChatSDKError("bad_request:database", "Failed to verify tool");
  }
}
```

## The Correct Pattern

### ✅ DO: Use Query Functions

```typescript
// In your API routes or server components:
import { getAIToolById, recordToolQuery } from "@/lib/db/queries";

const tool = await getAIToolById({ id: toolId });
await recordToolQuery({
  toolId,
  userId,
  transactionHash,
  amountPaid: "0.01",
  status: "completed",
});
```

### ❌ DON'T: Import `db` Directly

```typescript
// This will fail:
import { db } from "@/lib/db"; // Module not found!

// This is also wrong (even if it worked):
import { db } from "@/lib/db/queries"; // Breaks encapsulation
```

## Benefits of This Pattern

1. **Consistent Error Handling**
   - All queries use `ChatSDKError` with proper error codes
   - Errors are logged consistently
   - Easy to add retry logic or fallbacks

2. **Type Safety**
   - Query functions have explicit TypeScript interfaces
   - Prevents passing wrong parameters
   - IDE autocomplete works perfectly

3. **Testability**
   - Easy to mock query functions in tests
   - Can add logging/metrics without changing callers
   - Can add caching layer transparently

4. **Security**
   - Centralizes database access
   - Easier to audit for SQL injection
   - Can add authorization checks in one place

5. **Maintainability**
   - If database schema changes, update query functions
   - Callers don't need to change
   - Easy to find all uses of a query

## How to Add New Queries

When you need a new database operation:

### 1. Add the function to `lib/db/queries.ts`

```typescript
/**
 * Your function description
 */
export async function yourNewQuery({
  param1,
  param2,
}: {
  param1: string;
  param2: number;
}) {
  try {
    return await db
      .select()
      .from(yourTable)
      .where(eq(yourTable.column, param1));
  } catch (error) {
    console.error("Failed to do your query:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to do your query"
    );
  }
}
```

### 2. Import and use it

```typescript
import { yourNewQuery } from "@/lib/db/queries";

const result = await yourNewQuery({
  param1: "value",
  param2: 123,
});
```

## Verification

To verify all database access follows this pattern:

```bash
# Should return NO results:
grep -r "from \"@/lib/db\"" --include="*.ts" --include="*.tsx" .

# Should return ONLY lib/db/queries.ts:
grep -r "from \"drizzle-orm/postgres-js\"" --include="*.ts" .
```

## Testing the Fix

1. **Restart your dev server:**
   ```bash
   pnpm dev
   ```

2. **Try the payment flow again:**
   - Select Blocknative Gas tool
   - Type a message and send
   - Confirm payment in MetaMask
   - **Expected:** Transaction confirms → Tool executes → Result appears

3. **Check server logs:**
   - Should see: `POST /api/tools/execute 200`
   - Should NOT see: "Module not found: Can't resolve '@/lib/db'"

## Related Files

All these files now correctly use the query pattern:
- ✅ `lib/tools/payment-verifier.ts`
- ✅ `lib/tools/executor.ts`
- ✅ `app/(chat)/api/tools/execute/route.ts`
- ✅ `app/(chat)/api/tools/route.ts`
- ✅ `app/(chat)/api/admin/verify-tool/route.ts`
- ✅ `scripts/seed-blocknative-tool.ts`

## Summary

- **Problem:** Direct `db` imports don't work
- **Solution:** Always use query functions from `@/lib/db/queries`
- **Pattern:** Repository pattern with encapsulated database access
- **Benefit:** Consistent, maintainable, type-safe database operations

This is a **best practice** that makes the codebase more maintainable and prevents similar issues in the future!

