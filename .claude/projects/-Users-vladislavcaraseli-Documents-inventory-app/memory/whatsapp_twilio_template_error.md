---
name: Twilio Template Variable Error 21656 (RESOLVED)
description: WhatsApp list-picker template variable naming fix — use product_1, product_2 format
type: project
---

## Problem

When sending product list-picker template via Twilio, getting error 21656:
```
Template send failed: 400 {
  "code": 21656,
  "message": "The Content Variables parameter is invalid."
}
```

## Root Cause Analysis

Not a deduplication issue! Products intentionally have same name at different prices:
```
'CRENVURSTI URSULET FILLETTI' (price €5.00)
'CRENVURSTI URSULET FILLETTI' (price €7.00)
'CRENVURSTI URSULET FILLETTI' (price €9.00)
```

## Actual Issue

Twilio is rejecting the ContentVariables JSON structure. Possible causes:

1. **Variable names mismatch** - Template expects `product_1`, `product_2` but we're sending `1`, `2`, `3`
2. **Special characters in product names** - JSON encoding issue with Cyrillic/special chars
3. **Variable structure** - Template configuration doesn't match our variable format
4. **Max length exceeded** - Some product names might exceed Twilio's variable limits

## Solution (RESOLVED - 2026-03-14)

**Root Cause**: Template variables were keyed as `"1"`, `"2"`, `"3"` but Twilio template expects `"product_1"`, `"product_2"`, `"product_3"`.

**Fix Applied**: Updated `sendListPickerTemplate()` in `lib/whatsapp/transport.ts`:
```typescript
// Before:
items.forEach((item, index) => { variables[String(index + 1)] = item; });

// After:
items.forEach((item, index) => { variables[`product_${index + 1}`] = item; });
```

This follows Twilio's standard variable naming convention for list-picker templates.

## Related Code

- `lib/whatsapp/inventory.ts`: `getProductsByCategory()` - returns product names
- `lib/whatsapp/transport.ts`: `sendListPickerTemplate()` - creates variables
- `lib/whatsapp/webhook.ts`: Logs show the actual product list being sent

**Why:** Different prices require separate product records with same name
**Status:** RESOLVED - Variable names corrected to match Twilio template expectations
