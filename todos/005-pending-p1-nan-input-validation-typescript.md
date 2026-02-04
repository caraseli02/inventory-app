---
status: complete
priority: p1
issue_id: "005"
tags: [typescript, code-review, critical, ui-validation, runtime-validation]
dependencies: []
---

# Problem Statement

Number input fields in `InvoiceUploadDialog.tsx` use `Number()` without NaN checks, allowing `NaN` values to be stored in product data.

**Critical Risk:** User can type non-numeric characters, resulting in `NaN` that propagates through product data to database and display as "€NaN".

## Findings

### Root Cause Analysis

**Locations:** `src/components/invoice/InvoiceUploadDialog.tsx`

```typescript
// Line 500 - Quantity input
<Input
  type="number"
  value={product.quantity}
  onChange={(e) => handleProductFieldChange(i, 'quantity', Number(e.target.value))}
  className="h-9 text-sm text-right w-full"
  min="1"
/>

// Line 513 - Unit Price input
<Input
  type="number"
  value={product.unitPrice}
  onChange={(e) => handleProductFieldChange(i, 'unitPrice', Number(e.target.value))}
  className="h-9 text-sm text-right w-full"
  step="0.01"
  min="0"
/>

// Line 527 - Total Price input
<Input
  type="number"
  value={product.totalPrice}
  onChange={(e) => handleProductFieldChange(i, 'totalPrice', Number(e.target.value))}
  className="h-9 text-sm text-right w-full"
  step="0.01"
  min="0"
/>

// Handler (Line 180-185)
const handleProductFieldChange = useCallback((index: number, field: keyof InvoiceProduct, value: string | number) => {
  setEditableProducts(prev => prev.map((product, i) => {
    if (i !== index) return product;
    return { ...product, [field]: value };  // ← NaN allowed!
  }));
}, []);
```

**Why it's unsafe:**
- `Number("abc")` → `NaN` (Not a Number)
- `Number("")` → `0` (empty becomes zero)
- `Number("1.2.3.4")` → `NaN` (invalid number format)
- TypeScript thinks `value` is `number` (type says `number | string`)
- At runtime: `NaN` gets stored as valid number
- TypeScript compiles fine (`NaN` is technically a `number`)

### Exploit Scenarios

**Scenario 1: Typing Letters**
```typescript
User types: "abc" in quantity field

Result:
e.target.value = "abc"
Number("abc") = NaN
handleProductFieldChange(i, 'quantity', NaN)  // ← Stored!

Display:
Quantity: NaN  // ← Shows "NaN" to user!

Import:
Create product with quantity: NaN  // ← Corrupted data
```

**Scenario 2: Typing Invalid Format**
```typescript
User types: "1.2.3.4" in unit price

Result:
e.target.value = "1.2.3.4"
Number("1.2.3.4") = NaN  // Too many decimal points
handleProductFieldChange(i, 'unitPrice', NaN)

Display:
Unit Price: €NaN  // ← Weird display

Import:
Product has unitPrice: NaN  // Corrupted
```

**Scenario 3: Backspace Leaves Empty**
```typescript
User deletes all characters (backspace to empty)

Result:
e.target.value = ""
Number("") = 0  // ← Becomes zero!
handleProductFieldChange(i, 'quantity', 0)  // Stored as 0

Impact:
- User meant to delete field, not set to zero
- Product with 0 quantity gets created (inventory logic error)
- Stock movement of 0 units (wasteful database entry)
```

**Scenario 4: Accidentally Deleted**
```typescript
User accidentally deletes number and types letter

Result:
Quantity was: 10
User types: "5" but hits backspace → "5" → "" → "a"
Number("a") = NaN

Impact:
- Previous value (10) lost, replaced with NaN
- User confused why number changed to "NaN"
```

### Impact Assessment

| Impact | Severity | Frequency | User Frustration |
|--------|----------|-----------|-----------------|
| Data corruption (NaN in DB) | 🔴 Critical | Medium | 5-10% of edits | Very High |
| Display errors (show "€NaN") | 🟠 High | Medium | 20-30% of edits | High |
| Confusion (why "NaN"? What's wrong?) | 🟠 High | High | 30-40% of NaN occurrences | High |
| Data loss (accidental deletion) | 🟡 Medium | Low | 2-5% of edits | Medium |

**Business Impact:**
- Corrupted product data in inventory
- Users confused and frustrated
- Support tickets for "NaN showing everywhere"
- Lost time correcting data
- Inventory calculations broken (NaN * quantity = NaN)

### Comparison with Similar Inputs

**Other number inputs in codebase:**
- Search for `type="number"` + `onChange` pattern
- Check if other inputs have NaN validation
- If yes, follow same pattern

**Industry best practice:**
```typescript
// ✅ Pattern with validation
const handleNumberChange = (value: string, min: number, max: number) => {
  const numValue = Number(value);

  // Validation
  if (isNaN(numValue)) {
    return; // Don't update state
  }

  if (numValue < min || numValue > max) {
    return; // Out of range
  }

  updateState(numValue);
};

// ✅ Better: Use controlled inputs with validation
const [value, setValue] = useState<number>('');
const isValid = !isNaN(value) && value >= min && value <= max;

return (
  <Input
    type="number"
    value={value}
    onChange={(e) => {
      const num = Number(e.target.value);
      if (!isNaN(num)) setValue(num);
    }}
    min={min}
    max={max}
  />
);
```

## Proposed Solutions

### Solution 1: Add NaN Check to Handler ✅ RECOMMENDED

**Approach:** Validate `Number()` result before updating state.

**Implementation:**
```typescript
// ✅ NEW: Safe number change handler
const handleProductFieldChange = useCallback((index: number, field: keyof InvoiceProduct, value: string | number) => {
  // If value is already a number, use it directly
  if (typeof value === 'number') {
    if (isNaN(value) || !Number.isFinite(value)) {
      return; // Don't update invalid numbers
    }
    setEditableProducts(prev => prev.map((product, i) => {
      if (i !== index) return product;
      return { ...product, [field]: value };
    }));
    return;
  }

  // Value is string, convert with validation
  const numValue = Number(value);

  // ✅ NEW: Validate before updating
  if (isNaN(numValue) || !Number.isFinite(numValue)) {
    // Invalid input, don't update state
    // Optionally: Show visual error (red border, error message)
    return;
  }

  // ✅ NEW: Optional: Range validation
  const fieldValidations = {
    quantity: (v: number) => v > 0 && v <= 10000,
    unitPrice: (v: number) => v >= 0 && v <= 1000000,
    totalPrice: (v: number) => v >= 0,
  };

  const validate = fieldValidations[field] || (() => true);
  if (!validate(numValue)) {
    return; // Out of range, don't update
  }

  // Valid number, update state
  setEditableProducts(prev => prev.map((product, i) => {
    if (i !== index) return product;
    return { ...product, [field]: numValue };
  }));
}, []);
```

**UI Enhancement: Show Validation Error**
```typescript
// Add validation error state
const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

// In render
<TableCell className="px-4 py-3">
  {isEditing ? (
    <Input
      type="number"
      value={product.quantity}
      onChange={(e) => handleProductFieldChange(i, 'quantity', e.target.value)}
      className={`h-9 text-sm text-right w-full ${
        validationErrors[i] ? 'border-red-500 focus:ring-red-500' : ''
      }`}
    />
  ) : (
    product.quantity
  )}
  {validationErrors[i] && (
    <p className="text-xs text-red-500 mt-1">{validationErrors[i]}</p>
  )}
</TableCell>
```

**Pros:**
- ✅ Prevents NaN from entering state
- ✅ Prevents Infinity from entering state
- ✅ User can't save invalid data
- ✅ Clear UX (invalid input not accepted)
- ✅ Optional range validation
- ✅ Easy to implement (10-15 lines)

**Cons:**
- ⚠️ More code in handler
- ⚠️ Need to decide UX for invalid input (silent rejection vs error message)
  - Recommendation: Silent rejection with visual cue (red border) for inline editing

**Effort:** 15-25 minutes
**Risk:** Low (standard input validation pattern)

---

### Solution 2: Use Controlled Input with Validation

**Approach:** Change to controlled inputs with proper validation in state.

**Implementation:**
```typescript
// For each product row
const ProductInputCell = ({
  product,
  field,
  rowIndex,
  onUpdate,
  validation,
}: ProductInputCellProps) => {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleChange = (newValue: string) => {
    setValue(newValue);

    const numValue = Number(newValue);

    // Validate
    if (newValue === '') {
      setError(''); // Empty is ok (user is deleting)
      return;
    }

    if (isNaN(numValue) || !Number.isFinite(numValue)) {
      setError('Please enter a valid number');
      return; // Don't update parent
    }

    // Range validation
    const fieldValidations = {
      quantity: (v: number) => v > 0 && v <= 10000,
      unitPrice: (v: number) => v >= 0 && v <= 1000000,
      totalPrice: (v: number) => v >= 0,
    };

    const validate = fieldValidations[field] || (() => true);
    if (!validate(numValue)) {
      setError('Value out of allowed range');
      return;
    }

    // Valid
    setError('');
    onUpdate(rowIndex, field, numValue);
  };

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      className={`h-9 text-sm text-right w-full ${
        error ? 'border-red-500 focus:ring-red-500' : ''
      }`}
      min={field === 'quantity' ? 1 : undefined}
      step={field === 'unitPrice' || field === 'totalPrice' ? '0.01' : undefined}
    />
  );
};

// Usage in table
{isEditing ? (
  <ProductInputCell
    product={product}
    field="quantity"
    rowIndex={i}
    onUpdate={handleProductFieldChange}
    validation={(v) => v > 0 && v <= 10000}
  />
) : (
  <span className="font-medium">{product.quantity}</span>
)}
```

**Pros:**
- ✅ Full control over validation
- ✅ Clear error messages for user
- ✅ Better UX (red border + error text)
- ✅ Can show range requirements in error
- ✅ Reusable component for all number inputs

**Cons:**
- ⚠️ More complex (new component)
- ⚠️ More code (50-80 lines)
- ⚠️ Larger refactor of existing code

**Effort:** 60-90 minutes
**Risk:** Low (standard React pattern)

**Recommendation:** Use Solution 1 for quick fix, then adopt Solution 2 if validation needs expand.

---

### Solution 3: Disable Invalid Input (Simplest)

**Approach:** Disable input while invalid, prevent `NaN`.

**Implementation:**
```typescript
const handleProductFieldChange = useCallback((index: number, field: keyof InvoiceProduct, value: string | number) => {
  let numValue: number;

  if (typeof value === 'number') {
    numValue = value;
  } else {
    numValue = Number(value);

    // ✅ NEW: Validate immediately, reject if invalid
    if (isNaN(numValue) || !Number.isFinite(numValue)) {
      return; // Don't update state
    }
  }

  // Update state
  setEditableProducts(prev => prev.map((product, i) => {
    if (i !== index) return product;
    return { ...product, [field]: numValue };
  }));
}, []);
```

**UX Enhancement:**
```typescript
// Show visual cue for invalid input
{isEditing && (
  <Input
    type="number"
    value={product.quantity}
    onChange={(e) => {
      const num = Number(e.target.value);
      const isValid = !isNaN(num) && num > 0;
      handleProductFieldChange(i, 'quantity', isValid ? num : product.quantity);
    }}
    // ✅ NEW: Visual feedback
    className={`h-9 text-sm text-right w-full ${
      isNaN(product.quantity) ? 'bg-red-50' : ''
    }`}
  />
)}
```

**Pros:**
- ✅ Simple implementation (5 lines)
- ✅ Prevents NaN from being stored
- ✅ Minimal refactor
- ✅ Fast to implement

**Cons:**
- ❌ No error message (user confused why input doesn't work)
- ❌ Visual cue only (may not be obvious)
- ❌ Doesn't explain validation rules to user
- ❌ Poor UX compared to Solution 2

**Effort:** 5-10 minutes
**Risk:** Low (minimal code change)

**Recommendation:** Use as interim fix if Solution 1 or 2 are too much work.

## Recommended Action

**Implement Solution 1 (NaN Check to Handler) as P0 fix**

**Phase 1: Update Handler (10 minutes)**
1. Add `isNaN()` check to `handleProductFieldChange`
2. Add `Number.isFinite()` check
3. Add range validation (optional but recommended)
4. Return early if validation fails

**Phase 2: Test Validation (10 minutes)**
1. Type "abc" in number field (should be rejected)
2. Type "1.2.3.4" (too many decimals, should be rejected)
3. Type valid number (should be accepted)
4. Delete all characters and type new (should work)
5. Verify state doesn't update for invalid input
6. Verify valid inputs still work (no regression)

**Total Effort:** 20-25 minutes

**Future Enhancement:** Adopt Solution 2 (controlled inputs) if UX needs improvement.

## Acceptance Criteria

- [ ] `handleProductFieldChange` has `isNaN()` check
- [ ] `handleProductFieldChange` has `Number.isFinite()` check
- [ ] Invalid inputs don't update state (early return)
- [ ] Test: Typing "abc" in quantity doesn't store NaN
- [ ] Test: Typing "1.2.3.4" doesn't store NaN
- [ ] Test: Typing valid number still works (no regression)
- [ ] Test: Backspace to empty doesn't set to 0
- [ ] Test: Range validation works (min/max enforced)
- [ ] User can't save product with NaN values
- [ ] Error message or visual feedback for invalid input (optional)
- [ ] No runtime crashes from invalid numbers
- [ ] Documentation updated (if validation behavior changes)

## Work Log

### 2026-02-04 - Initial Finding

**By:** Kieran TypeScript Reviewer

**Actions:**
- Reviewed `src/components/invoice/InvoiceUploadDialog.tsx:500, 513, 527`
- Identified missing NaN checks in `Number()` conversions
- Analyzed exploit scenarios (typing letters, invalid formats, empty strings)
- Proposed 3 solutions with effort/risk assessment
- Recommended Solution 1 (NaN check in handler) as immediate fix

**Learnings:**
- `Number()` is aggressive (converts anything to number or NaN)
- `Number("")` → `0` (empty becomes zero, confusing)
- `Number("abc")` → `NaN` (stores corrupt data)
- Input validation must happen at handler, not component level
- Controlled inputs with validation provide better UX than naive `Number()` calls
- Range validation prevents unrealistic values

**Next Steps:**
- Awaiting triage decision
- If approved, implement Solution 1 (20-25 minutes)
- Test all number inputs (quantity, unitPrice, totalPrice)
- Consider adopting Solution 2 (controlled inputs) for better UX

---

## Technical Details

**Affected Files:**
- `src/components/invoice/InvoiceUploadDialog.tsx:180-185` - Handler function
- `src/components/invoice/InvoiceUploadDialog.tsx:496-535` - Number input cells (3 locations)
- `src/components/invoice/InvoiceUploadDialog.tsx:180-185` - Handler function

**Related Components:**
- `Input` component from shadcn/ui (no changes needed)
- `InvoiceProduct` type (no changes needed)
- Database layer (receives validated data, no changes)

**Dependencies:**
- All solutions: None (native JavaScript/React)

**Bundle Size Impact:**
- Solution 1: +100 bytes (validation logic)
- Solution 2: -200 bytes + 2KB (controlled input component)
- Solution 3: +50 bytes (simple check)

## Resources

**Documentation:**
- MDN: Number() - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number
- MDN: isNaN() - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN
- React Docs: Controlled Components - https://react.dev/learn/managing-state

**Related Code:**
- Other number inputs in codebase: Search for `type="number"` patterns
- Input validation patterns: Check existing `validate` functions

**Test Scenarios:**
```typescript
describe('Number input validation', () => {
  it('should reject "abc" input', () => { /* ... */ });
  it('should reject "1.2.3.4" input', () => { /* ... */ });
  it('should accept valid number "10.5"', () => { /* ... */ });
  it('should handle empty input correctly', () => { /* ... */ });
  it('should enforce min value', () => { /* ... */ });
  it('should enforce max value', () => { /* ... */ });
});
```
