---
status: pending
priority: p2
issue_id: "148"
tags: [whatsapp, code-review, history, multi-path]
dependencies: []
---

# Audit multi-path send functions for missing history append (early-return pattern)

## Problem Statement
`handleProductSelected` was missing a `appendSyntheticHistory` call on the template-success path — it only appended history on the fallback text path. The fix in `handle-product-selected-missing-history-append-WhatsAppAgent-20260316.md` modelled the correct pattern, but other multi-path send functions in `lib/whatsapp/` were not audited for the same early-return gap.

## Scope
Audit all functions in `lib/whatsapp/` that:
1. Send a message via template (early return on success)
2. Fall back to `sendRestMessage` if the template fails

Check whether `appendSyntheticHistory` (or equivalent history append) is called on **both** the template-success path and the text-fallback path.

## Files to Check
- `lib/whatsapp/selection-resolver.ts` — `handleCategorySelected`, `handleProductSelected`, `handleQtyInput`, `handleCartPickupTime`, `sendCategoryList`
- `lib/whatsapp/webhook.ts` — any multi-path send blocks in `handleRestConversation` or `handleButtonPayload`
- `lib/whatsapp/conversation.ts` — any templated confirmation sends

## Canonical Pattern (from handleProductSelected fix)
```typescript
if (templateSid) {
  const sent = await sendTemplateMessage(from, templateSid, vars);
  if (!sent) {
    // fallback
    await sendRestMessage(from, fallbackText);
  }
}
// ✅ history append happens OUTSIDE the if/else, always runs
await appendSyntheticHistory(sb, phone, content);
```

## Acceptance Criteria
- [ ] All multi-path send functions audited
- [ ] Any missing history appends added
- [ ] Unit test added for each fixed function (history appended on both paths)

## Work Log
- 2026-03-17: Created as tracking issue for open checkbox in handle-product-selected-missing-history-append-WhatsAppAgent-20260316.md
