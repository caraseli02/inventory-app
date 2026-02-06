---
status: pending
priority: p2
issue_id: "009"
tags: [performance, api, rate-limiting, ux]
dependencies: []
---

# Problem Statement

BatchDeleteConfirmDialog uses `Promise.allSettled` to delete all selected products in parallel, which could overwhelm the backend API or hit rate limits when users select large batches (50+ products).

**Impact:** Large batch deletions could cause API rate limiting errors, database connection pool exhaustion, or FK constraint violations that sequential processing would avoid.

## Findings

### Root Cause Analysis

**Location:** `src/components/product/BatchDeleteConfirmDialog.tsx:42-47`

```tsx
const results = await Promise.allSettled(
  products.map(async (product) => {
    await deleteProduct(product.id);
    return product.id;
  })
);
```

**Why it's potentially problematic:**
- All delete operations run simultaneously
- No batch size limit or throttling
- Could exhaust database connection pool
- May hit API rate limits (if configured)
- Simultaneous FK constraint checks could cause contention

### Potential Issues with Large Batches

**Scenario: User selects 100 products**
1. Dialog starts 100 parallel delete operations
2. Each operation opens database connection
3. **Supabase connection pool:** Typically 15-25 connections on free tier
4. **Result:** Requests queue or fail with connection errors

**Database Impact:**
- Connection pool exhaustion
- Increased lock contention on related tables (stock_movements FK)
- Potential deadlocks if multiple users batch delete simultaneously

**API Rate Limiting:**
- Supabase free tier: ~1000 requests/minute
- 100 simultaneous requests from one user = spike
- Could trigger rate limiting if multiple users do this

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| API rate limiting | 🟠 Medium | Low | 4/10 |
| Connection pool exhaustion | 🟠 Medium | Low | 4/10 |
| Database deadlocks | 🟡 Low | Very Low | 1/10 |
| User-visible errors | 🟠 Medium | Low | 4/10 |

**Overall Risk Score: 13/40** - Medium priority improvement

**Why medium priority:**
- Most users delete 5-10 products at once (low impact)
- Large batches (50+) are rare but possible
- Error handling catches failures gracefully
- Could become an issue with scale

## Solution

### Option 1: Add Batch Size Warning (Quick Win)

Show warning dialog when batch size exceeds threshold:

```tsx
const handleDelete = async () => {
  // Check for large batch
  if (products.length > 20) {
    const confirm = window.confirm(
      `You're about to delete ${products.length} products. This may take a while. Continue?`
    );
    if (!confirm) return;
  }

  await mutation.mutateAsync({ products });
};
```

**Pros:**
- Quick to implement (5 minutes)
- Educates users about performance
- No functional changes

**Cons:**
- Doesn't solve underlying issue
- Extra click for users

### Option 2: Process in Sequential Batches (Recommended)

Process deletions in smaller batches sequentially:

```tsx
const BATCH_SIZE = 10;

for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.allSettled(
    batch.map(async (product) => {
      await deleteProduct(product.id);
      return product.id;
    })
  );

  // Process results and update UI after each batch
  // ...
}
```

**Pros:**
- Prevents connection pool exhaustion
- Smooth API load distribution
- Progressive UI updates

**Cons:**
- Slightly slower for large batches
- More complex implementation

### Option 3: Add Backend Batch Endpoint

Create dedicated batch delete API endpoint:

```typescript
// Backend: POST /api/products/batch-delete
async function batchDelete(productIds: string[]) {
  // Single transaction, optimized SQL
  await db.transaction(async (tx) => {
    await tx.deleteMany('products', { id: { in: productIds } });
  });
}
```

**Pros:**
- Most efficient (single transaction)
- Better error handling
- Atomic operation

**Cons:**
- Requires backend changes
- More complex to implement

## Implementation Plan

### Phase 1: Quick Win (Recommended First Step)

1. **Add batch size warning**
   - Threshold: 20 products
   - Show confirmation dialog with count
   - Educate users about processing time

2. **Add progress indicator**
   - Show "Deleting X of Y products..."
   - Update count as deletions complete

### Phase 2: Batch Processing (If Needed)

1. **Implement sequential batching**
   - Batch size: 10 products
   - Process batches sequentially
   - Update UI after each batch

2. **Add cancellation support**
   - Allow users to cancel in-progress batch
   - Track which products deleted
   - Show partial results

### Phase 3: Backend Optimization (Future)

1. **Create batch delete endpoint**
   - Accept array of product IDs
   - Use database transaction
   - Return results atomically

2. **Update frontend to use batch endpoint**
   - Single API call instead of many
   - Simpler error handling

## Testing

**Test Case 1: Small Batch (< 10 products)**
- Should work identically to current behavior
- No warnings or delays

**Test Case 2: Medium Batch (10-20 products)**
- Should work without issues
- Slightly slower completion

**Test Case 3: Large Batch (20-50 products)**
- Should show warning dialog
- Should complete successfully
- Progress indicator updates

**Test Case 4: Very Large Batch (50+ products)**
- Should show warning dialog
- Should process in batches
- Should not exhaust connections
- Should handle partial failures

**Load Test:**
- Multiple users deleting 20 products simultaneously
- Should not cause connection errors
- Should not trigger rate limiting

## References

- **Supabase Connection Pooling**: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool
- **Promise.allSettled**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
- **PostgreSQL Foreign Keys**: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK
- **PR Review Finding**: Code quality review identified potential rate limiting issues
