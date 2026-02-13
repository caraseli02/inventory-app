---
status: complete
priority: p2
issue_id: "010"
tags: [observability, logging, debugging]
dependencies: []
---

# Problem Statement

BatchDeleteConfirmDialog processes `Promise.allSettled` results but doesn't log individual product deletion failures at the point of detection. Failures are only visible in the UI error list, making debugging difficult.

**Impact:** When batch deletions fail, there's no persistent log record of which specific products failed and why, making it hard to diagnose patterns or reproduce issues.

## Findings

### Root Cause Analysis

**Location:** `src/components/product/BatchDeleteConfirmDialog.tsx:52-59`

```tsx
results.forEach((result, index) => {
  const product = products[index];
  if (result.status === 'fulfilled') {
    deletedIds.push(result.value);
  } else {
    // ❌ No logging here!
    const errorMessage = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);
    failed.push({ product, error: errorMessage });
  }
});
```

**What gets logged:**
- Only aggregate statistics in `onError` handler (lines 91-101)
- Total count of successes and failures
- Stack trace of the mutation wrapper error (not individual errors)

**What doesn't get logged:**
- Individual product IDs that failed
- Individual product names that failed
- Specific error messages per product
- Timestamps of each failure
- Error stack traces from individual deletions

### Example Log Output (Current)

**When 5 out of 10 deletions fail:**
```
ERROR: Batch deletion partially failed
{
  "totalProducts": 10,
  "successCount": 5,
  "failedCount": 5,
  "timestamp": "2026-02-06T10:30:00Z",
  "errorMessage": "Batch operation completed with 5 errors",
  "errorStack": "Error: Batch operation completed..."
}
```

**Missing details:**
- Which 5 products failed?
- What were the specific error messages?
- Were they all the same error or different?
- Did they fail due to FK constraints, validation, or network?

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Difficult debugging | 🟡 Low | Medium | 3/10 |
| Can't identify patterns | 🟡 Low | Medium | 3/10 |
| Lost error context | 🟡 Low | Low | 2/10 |
| User confusion | 🟢 None | Low | 0/10 |

**Overall Risk Score: 8/40** - Low priority improvement

**Why low priority:**
- User sees failures in UI (not a silent failure)
- Aggregate logging exists in `onError` handler
- Individual errors are displayed to user
- Debug info available in browser console

**Why still worth doing:**
- Helps identify systematic issues (e.g., all failures are FK violations)
- Enables better error tracking in production
- Improves debugging experience for developers
- Provides context for user support requests

## Solution

Add individual failure logging in the results processing loop.

### Implementation

```tsx
results.forEach((result, index) => {
  const product = products[index];
  if (result.status === 'fulfilled') {
    deletedIds.push(result.value);
  } else {
    const errorMessage = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);

    // ✅ Add individual failure logging
    logger.error('Product deletion failed in batch operation', {
      productId: product.id,
      productName: product.fields.Name,
      productBarcode: product.fields.Barcode,
      errorMessage,
      errorStack: result.reason instanceof Error ? result.reason.stack : undefined,
      batchSize: products.length,
      batchIndex: index,
      timestamp: new Date().toISOString(),
    });

    failed.push({ product, error: errorMessage });
  }
});
```

### Enhanced Log Output

**Same scenario (5 out of 10 fail):**
```
ERROR: Product deletion failed in batch operation
{
  "productId": "rec123abc",
  "productName": "Milk 1L",
  "productBarcode": "0123456789",
  "errorMessage": "Foreign key constraint violation: product has stock movements",
  "errorStack": "Error: Foreign key constraint...",
  "batchSize": 10,
  "batchIndex": 2,
  "timestamp": "2026-02-06T10:30:00.123Z"
}

ERROR: Product deletion failed in batch operation
{
  "productId": "rec456def",
  "productName": "Bread Whole Wheat",
  "productBarcode": "9876543210",
  "errorMessage": "Foreign key constraint violation: product has stock movements",
  "errorStack": "Error: Foreign key constraint...",
  "batchSize": 10,
  "batchIndex": 5,
  "timestamp": "2026-02-06T10:30:00.145Z"
}

... (3 more individual errors)

ERROR: Batch deletion partially failed
{
  "totalProducts": 10,
  "successCount": 5,
  "failedCount": 5,
  "timestamp": "2026-02-06T10:30:00.200Z"
}
```

**Insights from enhanced logs:**
- All 5 failures are FK constraint violations
- All failed products have stock movements
- Pattern: User tried to delete products with active stock
- Solution: Add cascade delete or prevent deletion of products with movements

## Implementation Plan

1. **Update BatchDeleteConfirmDialog.tsx**
   - Add `logger.error()` call in results loop (line ~55)
   - Include product ID, name, barcode, error details
   - Include batch context (size, index)

2. **Verify log output**
   - Test batch deletion with intentional failures
   - Check console logs for individual error entries
   - Verify all context fields are present

3. **Consider log aggregation**
   - If using a log service (Sentry, LogRocket), ensure individual errors are tracked
   - Add custom grouping to identify batch operation patterns

## Testing

**Manual Test:**
1. Select 5 products (mix of products with/without stock movements)
2. Click "Delete Selected", confirm
3. Observe partial failure (some succeed, some fail)
4. Check browser console logs
5. Verify individual error logs show:
   - Product IDs
   - Product names
   - Specific error messages
   - Stack traces

**Expected Log Pattern:**
```

## Work Log

### 2026-02-13 - Completed

**By:** Codex

**Actions:**
- Added per-item `logger.error(...)` when a product deletion fails inside the `allSettled` result loop (includes product id/name/barcode + error)
[ERROR] Product deletion failed... (product A)
[ERROR] Product deletion failed... (product B)
[ERROR] Batch deletion partially failed (aggregate)
```

## References

- **Structured Logging**: Best practices for logging in web applications
- **Error Tracking**: How to track errors in batch operations
- **Promise.allSettled**: Error handling patterns with settled promises
- **PR Review Finding**: Error handling review identified logging gap
