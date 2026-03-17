---
name: TEMPLATE_DEBUG log exposes order PII in production logs
description: transport.ts logs full template variable values (product names, prices, pickup_time) on every send — no DEBUG flag gate — leaks customer order data to Vercel log drains
type: pending
priority: p2
issue_id: "122"
tags: [security, logging, privacy, transport]
dependencies: []
---

## Problem Statement

`transport.ts:119–124`:

```ts
console.log('[whatsapp] [TEMPLATE_DEBUG] sending template:', {
  contentSid,
  variableKeys: ...,
  variableValues: ...,
  contentVariablesJson: variables ? JSON.stringify(variables) : '(none)',
});
```

`contentVariablesJson` emits the full JSON of all template variables. These include `product_name` (customer order contents), `pickup_time`, and pricing. This fires on every template send in production. Vercel function logs are accessible to all project collaborators and any configured log drain — this is PII exposure at scale.

## Findings

- `transport.ts:119–124` — unconditional `console.log`
- Note: `variableValues` is sliced to 40 chars but `contentVariablesJson` is not truncated

## Proposed Solutions

### Option A — Gate behind DEBUG env flag (Recommended)
```ts
if (process.env.WHATSAPP_TEMPLATE_DEBUG) {
  console.log('[whatsapp] [TEMPLATE_DEBUG] ...', { ... });
}
```

**Pros:** Zero prod exposure; debug still available when needed
**Cons:** None
**Effort:** Trivial
**Risk:** None

### Option B — Remove the log entirely
The error logging at lines 136–139 already captures failures.

**Pros:** Simplest
**Cons:** Harder to debug template variable issues
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option A. Gate on `WHATSAPP_TEMPLATE_DEBUG`. Document in `.env.example`.

## Technical Details

- **Affected files:** `lib/whatsapp/transport.ts:119–124`

## Acceptance Criteria

- [ ] TEMPLATE_DEBUG log does not fire in production
- [ ] `WHATSAPP_TEMPLATE_DEBUG` documented in `.env.example`

## Work Log

- 2026-03-17: Identified by security-sentinel and typescript-reviewer review of PR #171
