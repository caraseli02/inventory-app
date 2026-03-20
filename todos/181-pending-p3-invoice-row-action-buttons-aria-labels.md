---
status: pending
priority: p3
issue_id: "181"
tags: [code-review, a11y, agent-native, ui]
dependencies: []
---

# Add aria-labels to invoice preview row action buttons

## Problem Statement

Invoice preview row actions (edit/save/cancel/remove) are icon-only buttons. Today they rely on `title` for naming, which is less reliable for accessibility tooling and agent/browser automation selectors (especially across locales).

## Findings

- Icon-only buttons set `title={t(...)}` but no explicit `aria-label`:
  - `src/components/invoice/InvoiceTableRow.tsx:72`
  - `src/components/invoice/InvoiceTableRow.tsx:73`
  - `src/components/invoice/InvoiceTableRow.tsx:79`
  - `src/components/invoice/InvoiceTableRow.tsx:80`
- This can make UI automation and screen reader behavior more brittle when translations change.

## Proposed Solutions

### Option 1: Add `aria-label` mirroring `title` (recommended)

**Approach:** Add `aria-label={t(...)}`

**Pros:**
- Improves accessibility and deterministic selectors
- Minimal code change

**Cons:**
- Slight duplication with `title`

**Effort:** Small

**Risk:** Low

---

### Option 2: Replace `title` with visually-hidden text

**Approach:** Wrap icon with `<span className="sr-only">…</span>` and use `aria-label` only when needed.

**Pros:**
- Strongest AT semantics

**Cons:**
- Slightly more markup in tight UI

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/components/invoice/InvoiceTableRow.tsx`

## Acceptance Criteria

- [ ] Edit/save/cancel/remove buttons have stable accessible names (`aria-label`)
- [ ] Manual keyboard + screen reader sanity check passes
- [ ] No visual regression

## Work Log

### 2026-03-20 - Review finding

**By:** Codex

**Actions:**
- Identified icon-only buttons relying on `title` without `aria-label`.

