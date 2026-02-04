---
status: complete
priority: p1
issue_id: "004"
tags: [typescript, code-review, critical, runtime-validation]
dependencies: []
---

# Problem Statement

Incomplete `total_amount` type validation only checks for `undefined` and `null`, but not actual type, allowing invalid values like strings, objects, or NaN to pass validation.

**Critical Risk:** Runtime type errors when displaying or using total amount in UI and database operations.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:259-268`

```typescript
// CURRENT - Only checks for undefined/null
if (responseData.total_amount === undefined || responseData.total_amount === null) {
  logger.error('Missing total_amount in response', {
    fileName: file.name,
    dataKeys: Object.keys(responseData),
  });
  return {
    success: false,
    error: 'Invoice total amount not found in response. Please ensure the invoice contains a total.',
  };
}
```

**Why it's incomplete:**
- Checks: `undefined` and `null` ✅
- **Missing:** `typeof` check for `number`
- **Missing:** `isNaN()` check for invalid numbers
- **Missing:** `Number.isFinite()` check for Infinity
- Allows: `"invalid"`, `{}`, `[]`, `NaN`, `Infinity` to pass

### Exploit Scenarios

**Scenario 1: Wrong Type (String)**
```json
// FastAPI returns malformed response
{
  "products": [...],
  "total_amount": "free"  // String, not number
}
```
**Result:**
- Validation passes (`!== undefined && !== null`)
- `totalAmount: responseData.total_amount` assigns string
- Display error: `€${totalAmount.toFixed(2)}` → **CRASH** (`.toFixed()` not on string)
- Database error: If DB expects `number`, may fail or coerce weirdly

**Scenario 2: Wrong Type (Array)**
```json
{
  "products": [...],
  "total_amount": [10.00, 20.00]  // Array, not number
}
```
**Result:**
- Validation passes
- Comparison `if (totalAmount > 100)` → **CRASH** (can't compare array to number)
- Display error or corrupted data

**Scenario 3: NaN (Not a Number)**
```json
{
  "products": [...],
  "total_amount": NaN  // Type is number, but value is NaN
}
```
**Result:**
- `typeof NaN === 'number'` ✅ (passess validation)
- `NaN === undefined` ❌ (passess validation)
- `NaN === null` ❌ (passess validation)
- But: `totalAmount.toFixed(2)` → **NaN** (NaN.propagates)
- But: `€${totalAmount.toFixed(2)}` → **"€NaN"** (displays NaN)
- But: Database may reject or store corrupted value

**Scenario 4: Infinity**
```json
{
  "products": [...],
  "total_amount": Infinity  // Type is number, but invalid
}
```
**Result:**
- Validation passes
- Calculations: `totalAmount * 1.2` → **Infinity** (propagates)
- Display: "€Infinity" (weird but no crash)
- Business logic: May cause overflow errors

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Runtime crash (`.toFixed()` on non-number) | 🔴 Critical | Medium | 6/10 |
| Display corruption (show "€NaN") | 🟠 High | Low | 3/10 |
| Database error (wrong type for column) | 🟠 High | Medium | 6/10 |
| Calculation errors (NaN/Infinity propagation) | 🟡 Medium | Low | 2/10 |

**Overall Risk Score: 17/40** - Exceeds important threshold

### Comparison with Product Validation

**Product fields (Line 246-256):**
```typescript
// ✅ Checks products is array
if (!Array.isArray(responseData.products)) {
  return { success: false, error: 'Invalid product data...' };
}

// ✅ Checks products not empty
if (responseData.products.length === 0) {
  return { success: false, error: 'No products found...' };
}
```

**Total amount (Line 259-268):**
```typescript
// ❌ Only checks undefined/null
if (responseData.total_amount === undefined || responseData.total_amount === null) {
  return { success: false, error: 'Invoice total amount not found...' };
}
// ❌ Missing: typeof check
// ❌ Missing: isNaN() check
// ❌ Missing: Number.isFinite() check
```

**Verdict:** Inconsistent validation depth - products get thorough checks, total_amount gets shallow checks.

## Proposed Solutions

### Solution 1: Complete Type Validation ✅ RECOMMENDED

**Approach:** Add `typeof`, `isNaN()`, and `Number.isFinite()` checks.

**Implementation:**
```typescript
// ✅ NEW: Complete validation
if (
  typeof responseData.total_amount !== 'number' ||
  isNaN(responseData.total_amount) ||
  !Number.isFinite(responseData.total_amount)
) {
  logger.error('Invalid total_amount type in response', {
    fileName: file.name,
    receivedType: typeof responseData.total_amount,
    receivedValue: responseData.total_amount,
  });
  return {
    success: false,
    error: 'Invalid invoice total amount received from service',
  };
}

// ✅ NEW: Optional: Validate range
if (responseData.total_amount < 0) {
  logger.error('Negative total_amount in response', {
    fileName: file.name,
    totalAmount: responseData.total_amount,
  });
  return {
    success: false,
    error: 'Invoice total amount cannot be negative',
  };
}

// Safe to use
const totalAmount = responseData.total_amount;
```

**Pros:**
- ✅ Catches string, object, array types
- ✅ Catches NaN and Infinity
- ✅ Catches negative values (if added)
- ✅ Prevents runtime crashes
- ✅ Consistent with best practices
- ✅ Easy to implement (5-10 lines)

**Cons:**
- ⚠️ More verbose than current check
- ⚠️ May reject valid edge cases (e.g., total = 0)
  - Mitigation: Check if `>= 0` instead of `> 0` for invoices with 0 total

**Effort:** 5-10 minutes
**Risk:** Low (standard type guard pattern)

---

### Solution 2: Zod Schema Validation (Comprehensive)

**Approach:** Use Zod to validate entire response structure.

**Implementation:**
```typescript
import { z } from 'zod';

const FastAPIResponseSchema = z.object({
  products: z.array(
    z.object({
      name: z.string().min(1).max(500),
      quantity: z.number().positive().finite().max(10000),
      unit_price: z.number().nonnegative().finite().max(1000000),
      total_price: z.number().nonnegative().finite(),
      raw_code: z.string().max(50).optional(),
    })
  ).min(1),
  supplier: z.string().max(200).optional(),
  invoice_number: z.string().max(50).optional(),
  date: z.string().optional(),
  total_amount: z.number().nonnegative().finite(), // ✅ Automatic type, NaN, Infinity checks
});

// Validate entire response
const validationResult = FastAPIResponseSchema.safeParse(responseData);
if (!validationResult.success) {
  logger.error('Zod validation failed', {
    fileName: file.name,
    errors: validationResult.error.issues,
  });
  return {
    success: false,
    error: 'Invalid invoice data from service',
  };
}

const safeData = validationResult.data;
```

**Pros:**
- ✅ Comprehensive validation for all fields
- ✅ Automatic type, NaN, Infinity checks
- ✅ Declarative (easy to read and modify)
- ✅ Consistent validation across fields
- ✅ Reusable schema across app

**Cons:**
- ⚠️ Adds Zod dependency (8KB)
- ⚠️ Overkill if only validating total_amount

**Effort:** 30-45 minutes
**Risk:** Low (if Zod used elsewhere in app)

**Recommendation:** Use Solution 1 for quick fix, then adopt Zod for broader validation needs.

---

### Solution 3: Server-Side Validation in FastAPI

**Approach:** Add Pydantic validation to FastAPI `/extract` endpoint.

**Implementation (FastAPI):**
```python
from pydantic import BaseModel, confloat, constr
from typing import Optional

class ExtractResponse(BaseModel):
    products: list[Product]
    supplier: Optional[constr(max_length=200)]
    invoice_number: Optional[constr(max_length=50)]
    date: Optional[str]
    total_amount: confloat(ge=0)  # ✅ Automatic validation

# FastAPI validates on POST
@app.post("/extract")
async def extract_invoice(file: UploadFile):
    result = process_invoice(file)
    return ExtractResponse(**result)
```

**Pros:**
- ✅ Validation on server-side (defense-in-depth)
- ✅ Pydantic handles automatically
- ✅ No client-side validation needed

**Cons:**
- ❌ Requires external FastAPI service changes
- ❌ Can't control if third-party service
- ❌ Doesn't protect against malicious FastAPI responses (if compromised)

**Effort:** 1-2 hours
**Risk:** Medium (depends on FastAPI control)

## Recommended Action

**Implement Solution 1 (Complete Type Validation) as P0 fix**

**Phase 1: Add Validation (5 minutes)**
1. Replace `undefined/null` check with `typeof` check
2. Add `isNaN()` check
3. Add `Number.isFinite()` check
4. Optional: Add range validation (`>= 0`)

**Phase 2: Test Edge Cases (10 minutes)**
1. Test with `total_amount: "string"`
2. Test with `total_amount: NaN`
3. Test with `total_amount: Infinity`
4. Test with `total_amount: 0` (zero-dollar invoice)
5. Test with `total_amount: -10` (negative)
6. Test valid cases ensure no regression

**Total Effort:** 15-20 minutes

**Future Enhancement:** Adopt Zod (Solution 2) if validation scales across app.

## Acceptance Criteria

- [ ] `typeof responseData.total_amount === 'number'` check added
- [ ] `isNaN(responseData.total_amount)` check added
- [ ] `Number.isFinite(responseData.total_amount)` check added
- [ ] Range validation added (`>= 0`)
- [ ] Unit test for string total_amount (should fail)
- [ ] Unit test for NaN total_amount (should fail)
- [ ] Unit test for Infinity total_amount (should fail)
- [ ] Unit test for negative total_amount (should fail)
- [ ] Unit test for zero total_amount (should pass)
- [ ] Unit test for valid total_amount (should pass)
- [ ] Error message clear and user-friendly
- [ ] No regression in happy path (valid invoices still work)
- [ ] Documentation updated (FASTAPI_INTEGRATION.md)

## Work Log

### 2026-02-04 - Initial Finding

**By:** Kieran TypeScript Reviewer

**Actions:**
- Reviewed `src/lib/invoiceOCR.ts:259-268` for total_amount validation
- Identified incomplete validation (only checks `undefined`/`null`)
- Analyzed exploit scenarios (wrong types, NaN, Infinity)
- Proposed 3 solutions with effort/risk assessment
- Recommended Solution 1 (complete type check) as immediate fix

**Learnings:**
- `undefined`/`null` checks insufficient for type safety
- `typeof` + `isNaN()` + `Number.isFinite()` pattern is robust
- NaN is `number` type but invalid value
- Infinity is `number` type but invalid for financial data
- Zod provides declarative alternative for larger validation needs

**Next Steps:**
- Awaiting triage decision
- If approved, implement Solution 1 (15-20 minutes)
- Add comprehensive unit tests for edge cases
- Consider adopting Zod if validation scales

---

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:259-268` - Total amount validation
- `tests/unit/lib/invoiceOCR.test.ts` - Add validation tests

**Related Components:**
- `InvoiceUploadDialog.tsx:410-417` - Displays total amount (no changes needed)
- Database layer - Receives validated `totalAmount` (no changes needed)

**Dependencies:**
- Solution 1: None (native TypeScript)
- Solution 2: `zod` package
- Solution 3: No client deps (FastAPI server changes)

**Bundle Size Impact:**
- Solution 1: +50 bytes (validation logic)
- Solution 2: +8KB (zod library)
- Solution 3: No change

## Resources

**Documentation:**
- MDN: isNaN() - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN
- MDN: Number.isFinite() - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite
- MDN: typeof operator - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof

**Related Code:**
- Similar validation for product fields: See todo #003
- Existing patterns: Check `lib/errors.ts` for custom error classes

**Test Scenarios:**
```typescript
// Unit tests to add
describe('total_amount validation', () => {
  it('should reject string total_amount', () => { /* ... */ });
  it('should reject NaN total_amount', () => { /* ... */ });
  it('should reject Infinity total_amount', () => { /* ... */ });
  it('should reject negative total_amount', () => { /* ... */ });
  it('should accept zero total_amount', () => { /* ... */ });
  it('should accept valid total_amount', () => { /* ... */ });
});
```
