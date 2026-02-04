---
status: complete
priority: p1
issue_id: "003"
tags: [typescript, code-review, critical, type-safety, runtime-validation]
dependencies: []
---

# Problem Statement

Missing runtime type validation for product fields in FastAPI response, allowing invalid data (empty strings, negative numbers, wrong types) to propagate into the application and database.

**Critical Risk:** TypeScript trusts the interface at compile-time, but API can return any types at runtime, causing data corruption or crashes.

## Findings

### Root Cause Analysis

**Location:** `src/lib/invoiceOCR.ts:285-296`

```typescript
// CURRENT - No runtime validation
const invoiceData: InvoiceData = {
  products: responseData.products.map((product) => ({
    name: product.name,              // ← Type: string, but could be "" or null
    quantity: product.quantity,        // ← Type: number, but could be -1 or NaN
    unitPrice: product.unit_price,     // ← Type: number, but could be -5 or null
    totalPrice: product.total_price,    // ← Type: number, but could be null or undefined
    barcode: product.raw_code,        // ← Type: string | undefined, ok
  })),
  supplier: responseData.supplier,
  invoiceNumber: responseData.invoice_number,
  invoiceDate: responseData.date,
  totalAmount: responseData.total_amount,
};
```

**Why it's unsafe:**
- TypeScript interface `FastAPIExtractResponse['products'][0]` declares types
- At compile-time: `product.name` is `string`, `product.quantity` is `number`
- At runtime: API could return `name: ""`, `quantity: -1`, `unit_price: null`
- TypeScript compiles fine, but invalid data crashes app or corrupts database

### Exploit Scenarios

**Scenario 1: Empty Product Name**
```json
// FastAPI response (malicious or buggy)
{
  "products": [
    {
      "name": "",  // Empty string
      "quantity": 10,
      "unit_price": 5.00,
      "total_price": 50.00
    }
  ],
  "total_amount": 50.00
}
```
**Result:**
- Product created with empty name in database
- User sees blank product in inventory
- Search/filtering broken (can't find product with no name)

**Scenario 2: Negative Quantity**
```json
{
  "products": [
    {
      "name": "Milk 1L",
      "quantity": -5,  // Negative number
      "unit_price": 1.35,
      "total_price": -6.75
    }
  ],
  "total_amount": -6.75
}
```
**Result:**
- Negative stock added to database
- Inventory calculation corrupted
- Stock movements show negative values (business logic error)

**Scenario 3: Invalid Number Types**
```json
{
  "products": [
    {
      "name": "Bread",
      "quantity": "five",  // String, not number
      "unit_price": null,    // Null, not number
      "total_price": undefined
    }
  ],
  "total_amount": "free"
}
```
**Result:**
- Runtime type error when displaying `€${product.unitPrice.toFixed(2)}`
- Application crash or NaN display
- User data not imported (error)

**Scenario 4: SQL Injection via Product Name**
```json
{
  "products": [
    {
      "name": "'; DROP TABLE products; --",
      "quantity": 1,
      "unit_price": 10.00,
      "total_price": 10.00
    }
  ],
  "total_amount": 10.00
}
```
**Result:**
- If database doesn't use parameterized queries, SQL injection possible
- Even with parameterized queries, malicious data corrupts product catalog
- Business data integrity compromised

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Data corruption (invalid data in DB) | 🔴 Critical | Medium | 6/10 |
| Runtime crashes (type errors) | 🟠 High | Low | 3/10 |
| Business logic errors (negative stock) | 🟠 High | Low | 3/10 |
| Security vulnerabilities (injection) | 🟠 High | Low | 2/10 |

**Overall Risk Score: 14/40** - Exceeds important threshold

### Validation Gaps

**Current Validation (Lines 234-279):**
```typescript
// ✅ Checks: products is array
if (!Array.isArray(responseData.products)) {
  return { success: false, error: 'Invalid product data...' };
}

// ✅ Checks: total_amount is present
if (responseData.total_amount === undefined || responseData.total_amount === null) {
  return { success: false, error: 'Invoice total amount not found...' };
}

// ✅ Checks: products not empty
if (responseData.products.length === 0) {
  return { success: false, error: 'No products found...' };
}

// ❌ MISSING: Product field validation
// ❌ MISSING: Number type checks
// ❌ MISSING: String validation (non-empty)
```

## Proposed Solutions

### Solution 1: Add Runtime Validation Function ✅ RECOMMENDED

**Approach:** Create validation function for product fields before mapping.

**Implementation:**
```typescript
// ✅ NEW: Runtime type guard for product
function validateProduct(product: FastAPIExtractResponse['products'][0]): product is InvoiceProduct {
  return (
    // Name: must be non-empty string
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    product.name.length <= 500 && // Reasonable max length

    // Quantity: must be positive number
    typeof product.quantity === 'number' &&
    !isNaN(product.quantity) &&
    Number.isFinite(product.quantity) &&
    product.quantity > 0 &&
    product.quantity <= 10000 && // Reasonable max quantity

    // Unit Price: must be non-negative number
    typeof product.unit_price === 'number' &&
    !isNaN(product.unit_price) &&
    Number.isFinite(product.unit_price) &&
    product.unit_price >= 0 &&
    product.unit_price <= 1000000 && // Reasonable max price

    // Total Price: must be non-negative number
    typeof product.total_price === 'number' &&
    !isNaN(product.total_price) &&
    Number.isFinite(product.total_price) &&
    product.total_price >= 0 &&

    // Barcode: must be string or undefined
    (product.raw_code === undefined ||
      (typeof product.raw_code === 'string' && product.raw_code.length <= 50))
  );
}

// ✅ NEW: Validate all products before mapping
const invalidProduct = responseData.products.find(p => !validateProduct(p));
if (invalidProduct) {
  logger.error('Invalid product data in response', {
    fileName: file.name,
    invalidProduct: JSON.stringify(invalidProduct),
    productIndex: responseData.products.indexOf(invalidProduct),
  });
  return {
    success: false,
    error: 'Invalid product data received from invoice service. Please ensure the invoice contains valid product information.',
  };
}

// ✅ NOW SAFE: Map with validation
const invoiceData: InvoiceData = {
  products: responseData.products.map((product) => ({
    name: product.name,
    quantity: product.quantity,
    unitPrice: product.unit_price,
    totalPrice: product.total_price,
    barcode: product.raw_code,
  })),
  supplier: responseData.supplier,
  invoiceNumber: responseData.invoice_number,
  invoiceDate: responseData.date,
  totalAmount: responseData.total_amount,
};
```

**Pros:**
- ✅ Type-safe validation (TypeScript understands the guard)
- ✅ Clear error messages for invalid data
- ✅ Prevents data corruption
- ✅ Protects against injection attacks
- ✅ Catches NaN, Infinity, null, wrong types
- ✅ Easy to test (unit tests for each validation rule)
- ✅ Follows TypeScript best practices (type guards)

**Cons:**
- ⚠️ More code (30-40 lines of validation logic)
- ⚠️ Need to adjust max values if business requirements change
  - Mitigation: Extract to constants: `MAX_PRODUCT_NAME_LENGTH`, `MAX_QUANTITY`, etc.

**Effort:** 30-45 minutes
**Risk:** Low (defensive programming pattern)

---

### Solution 2: Zod Schema Validation

**Approach:** Use Zod library for declarative runtime validation.

**Installation:**
```bash
pnpm add zod
```

**Implementation:**
```typescript
import { z } from 'zod';

// ✅ NEW: Zod schema for FastAPI product
const FastAPIProductSchema = z.object({
  name: z.string().min(1).max(500),
  quantity: z.number().positive().finite().max(10000),
  unit_price: z.number().nonnegative().finite().max(1000000),
  total_price: z.number().nonnegative().finite(),
  raw_code: z.string().max(50).optional(),
});

const FastAPIResponseSchema = z.object({
  products: z.array(FastAPIProductSchema).min(1),
  supplier: z.string().max(200).optional(),
  invoice_number: z.string().max(50).optional(),
  date: z.string().optional(),
  total_amount: z.number().nonnegative().finite(),
});

// ✅ NEW: Validate with Zod
const validationResult = FastAPIResponseSchema.safeParse(responseData);
if (!validationResult.success) {
  logger.error('Zod validation failed', {
    fileName: file.name,
    errors: validationResult.error.issues,
  });
  return {
    success: false,
    error: 'Invalid invoice data from service. Please contact support.',
  };
}

const safeData = validationResult.data;

// ✅ NOW SAFE: Map with Zod-validated data
const invoiceData: InvoiceData = {
  products: safeData.products.map((product) => ({
    name: product.name,
    quantity: product.quantity,
    unitPrice: product.unit_price,
    totalPrice: product.total_price,
    barcode: product.raw_code,
  })),
  supplier: safeData.supplier,
  invoiceNumber: safeData.invoice_number,
  invoiceDate: safeData.date,
  totalAmount: safeData.total_amount,
};
```

**Pros:**
- ✅ Declarative validation (easier to read)
- ✅ Automatic error messages
- ✅ Type-safe (Zod infers types)
- ✅ Community-tested library
- ✅ Reusable schema across app
- ✅ Easy to extend validation rules

**Cons:**
- ⚠️ Adds dependency (Zod, ~8KB minified)
- ⚠️ Learning curve for team
- ⚠️ Overkill if only used here

**Effort:** 30-45 minutes
**Risk:** Low (widely used library)

**Recommendation:** If project already uses Zod elsewhere, use this. Otherwise, use Solution 1.

---

### Solution 3: Server-Side Validation in FastAPI

**Approach:** Add validation in FastAPI service, assume API returns valid data.

**Implementation (FastAPI):**
```python
# FastAPI service (external)
from pydantic import BaseModel, constr, validator
from typing import Optional

class Product(BaseModel):
    name: constr(min_length=1, max_length=500)
    quantity: constr(gt=0, le=10000)
    unit_price: confloat(ge=0, le=1000000)
    total_price: confloat(ge=0)
    raw_code: Optional[constr(max_length=50)]

class ExtractResponse(BaseModel):
    products: list[Product]
    supplier: Optional[constr(max_length=200)]
    invoice_number: Optional[constr(max_length=50)]
    date: Optional[str]
    total_amount: confloat(ge=0)

# FastAPI automatically validates on POST /extract
```

**Pros:**
- ✅ Validation on server-side (defense-in-depth)
- ✅ Pydantic handles it automatically
- ✅ No client-side validation needed

**Cons:**
- ❌ Requires changes to external FastAPI service
- ❌ Can't control service if it's third-party
- ❌ Doesn't protect against malicious FastAPI responses (if service is compromised)

**Effort:** 2-4 hours (depends on FastAPI service control)
**Risk:** Medium (requires external service changes)

## Recommended Action

**Implement Solution 1 (Runtime Validation Function) as P0 fix**

**Phase 1: Create Validation Function (15 minutes)**
1. Add `validateProduct()` type guard in `invoiceOCR.ts`
2. Define validation rules (name, quantity, prices, barcode)
3. Extract magic numbers to constants

**Phase 2: Validate Before Mapping (10 minutes)**
1. Find invalid product with `find()` or `some()`
2. Return error if validation fails
3. Log detailed error with product data

**Phase 3: Test Validation (20 minutes)**
1. Add unit tests for each validation rule
2. Test edge cases (empty string, NaN, negative numbers)
3. Test valid cases ensure no regression
4. Test malicious responses

**Total Effort:** 45-60 minutes

**Future Enhancement:** Consider Zod (Solution 2) if validation needs scale across app.

## Acceptance Criteria

- [ ] `validateProduct()` type guard function created
- [ ] Product name validated: non-empty string, max 500 chars
- [ ] Product quantity validated: positive number, <= 10000
- [ ] Product unit_price validated: non-negative number, <= 1,000,000
- [ ] Product total_price validated: non-negative number
- [ ] Product barcode validated: string or undefined, max 50 chars
- [ ] NaN and Infinity checks for all numbers
- [ ] Invalid product detected before mapping
- [ ] Error message clear and actionable for users
- [ ] Unit tests added for validation rules (10+ test cases)
- [ ] Edge cases tested (empty strings, negative numbers, null, undefined)
- [ ] No regression in happy path (valid products still work)
- [ ] Documentation updated (FASTAPI_INTEGRATION.md)

## Work Log

### 2026-02-04 - Initial Finding

**By:** Kieran TypeScript Reviewer

**Actions:**
- Reviewed `src/lib/invoiceOCR.ts:285-296` for runtime validation
- Identified missing validation for product fields
- Analyzed exploit scenarios (empty name, negative quantity, type errors, injection)
- Proposed 3 solutions with effort/risk assessment
- Recommended Solution 1 (type guard) as immediate fix

**Learnings:**
- TypeScript compile-time checks ≠ runtime safety
- External API responses cannot be trusted without validation
- Type guards are idiomatic TypeScript pattern
- Zod provides declarative alternative for larger scale
- Defense-in-depth requires validation on both client and server

**Next Steps:**
- Awaiting triage decision
- If approved, implement Solution 1 (45-60 minutes)
- Add comprehensive unit tests for validation
- Consider Zod adoption if validation scales

---

## Technical Details

**Affected Files:**
- `src/lib/invoiceOCR.ts:284-296` - Product mapping code
- `tests/unit/lib/invoiceOCR.test.ts` - Add validation tests

**Related Components:**
- `InvoiceUploadDialog.tsx` - No changes needed (uses InvoiceData)
- Database layer (Supabase/Airtable) - No changes needed (receives validated data)

**Dependencies:**
- Solution 1: None (uses native TypeScript)
- Solution 2: `zod` package (add via pnpm)
- Solution 3: No client deps (FastAPI server changes)

**Bundle Size Impact:**
- Solution 1: +200 bytes (validation logic)
- Solution 2: +8KB (zod library)
- Solution 3: No change

## Resources

**Documentation:**
- TypeScript Handbook: Type Guards - https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
- MDN: typeof operator - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
- Zod Documentation: https://zod.dev/

**Related Code:**
- Project validation patterns: Check `lib/errors.ts` for custom error classes
- Similar validation in codebase: Search for `validate` functions

**Validation Constants:**
```typescript
// Extract to constants at top of file
const MAX_PRODUCT_NAME_LENGTH = 500;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10000;
const MIN_PRICE = 0;
const MAX_PRICE = 1000000;
const MAX_BARCODE_LENGTH = 50;
```
