---
module: WhatsAppAgent
date: 2026-03-16
problem_type: logic_error
component: api_client
symptoms:
  - "LLM ignores selected product after qty prompt template is sent and restarts product search"
  - "User selects product via list-picker, receives qty prompt, provides quantity — bot responds with disambiguation list instead of creating order"
  - "appendSyntheticHistory not called when TWILIO_QTY_SID is set and template sends successfully"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [whatsapp, selection-resolver, synthetic-history, llm-context, early-return, qty-prompt, template]
related_github_issue: null
commit: null
---

# Problem Description

When a user selected a product from a list-picker and the qty prompt template was sent successfully, the LLM had no conversational context about which product was selected. This caused it to restart product search when the user typed a quantity, asking "which product?" instead of creating an order. The bug was an early `return` statement after the template send that silently skipped the `appendSyntheticHistory()` call.

# Symptoms

- User clicks a product in list-picker → receives qty template (correct)
- User types "2 bucati la 14:00" → bot responds with "Am mai multe opțiuni în inventar. Care anume?" (wrong)
- LLM history shows no assistant turn after product selection
- Bug only occurs when `TWILIO_QTY_SID` is set; text-fallback path worked correctly

# Root Cause Analysis

`handleProductSelected` had two code paths: template send (when `TWILIO_QTY_SID` is set) and text fallback. `appendSyntheticHistory()` was placed after both paths and was only reachable if the template path was skipped or threw. A successful template send hit `return` before history was appended.

```typescript
// ❌ BEFORE — early return skips appendSyntheticHistory
if (qtySid) {
  try {
    await sendTemplateMessage(args.from, qtySid, { product_name: args.product });
    return;  // ← exits here on success; history append never runs
  } catch (err) {
    console.warn('[whatsapp] qty template send failed, using text fallback:', String(err));
  }
}
// Only reached if qtySid not set OR template threw
await sendRestMessage(args.from, `Ce cantitate doriți din *${args.product}*?`);
await appendSyntheticHistory(args.sb, args.phone, `Am selectat produsul ${args.product}...`);
```

The LLM's next turn had no synthetic assistant message indicating which product was selected, so it fell back to open-ended product search using stale conversation context.

# Solution

Remove the early `return`. Use a boolean flag to track whether the template was sent successfully, then run all post-send side effects unconditionally after the branch.

```typescript
// ✅ AFTER — history append always runs regardless of send path
const qtySid = process.env.TWILIO_QTY_SID ?? '';
let templateSent = false;

if (qtySid) {
  try {
    await sendTemplateMessage(args.from, qtySid, { product_name: args.product });
    templateSent = true;
  } catch (err) {
    console.warn('[whatsapp] qty template send failed, using text fallback:', String(err));
  }
}

if (!templateSent) {
  await sendRestMessage(
    args.from,
    `Ce cantitate doriți din *${args.product}*? / How many of *${args.product}* would you like?`,
  );
}

// Always append — LLM needs context about which product was selected
// regardless of whether the template or text path was used
await appendSyntheticHistory(
  args.sb,
  args.phone,
  `Am selectat produsul ${args.product}. Câte bucăți doriți?`,
);
```

# Files Changed

- `lib/whatsapp/selection-resolver.ts` (lines 121–139) — removed early `return`, added `templateSent` flag, moved `appendSyntheticHistory` outside branch
- `tests/unit/lib/whatsapp-selection-resolver.test.ts` — added test: "appends synthetic history even when template succeeds"

# Prevention

**Rule:** Side effects that must always run (history appends, state transitions, audit logs) must be placed outside all success/failure branches, not inside the happy path. Use a flag variable to record what happened, then react after the branch.

**Detection in code review:** Scan async functions with multiple return points. For each early `return`, verify that all required side effects have already executed. Flag any side effect that appears only inside one branch of an `if/else`.

**Related pattern — `handleCategorySelected` already does this correctly:**

```typescript
// ✅ sendListPickerTemplate OR sendRestMessage — then history append regardless
if (productSid) {
  await sendListPickerTemplate(...);
} else {
  await sendRestMessage(...);
}
await appendSyntheticHistory(...);  // always runs
```

Use this as the canonical model when adding new multi-path send functions.

- [x] Added unit test: `handleProductSelected > appends synthetic history even when template succeeds`
- [ ] Audit other multi-path send functions for the same early-return pattern

## Related Solutions

- [`docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`](stale-history-revives-old-order-WhatsAppAgent-20260312.md) — related: LLM context gaps caused by incomplete history propagation
- [`docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`](followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md) — related: assistant reply tokens polluting product search context
