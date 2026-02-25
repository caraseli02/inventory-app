---
date: 2026-02-25
topic: invoice-import-default-fx-rate-19-5
---

# Invoice Import: Default FX Rate (MDL per EUR) = 19.5

## What We're Building
Reduce friction in “Importă din factură” preview by pre-filling the FX rate input with **19.5 MDL/EUR** so EUR prices show immediately (no required manual step).

Scope: invoice import preview flow only (not general XLSX import).

## Why This Approach
We want the EUR view “from the start” with minimal UI/logic complexity.

Auto-fetching BNM by invoice date exists as a possible improvement, but it adds network dependency + edge cases (missing date, weekends/holidays, offline) and may not be required for the current user workflow.

## Approaches Considered

### Approach A (Chosen): Frontend default = 19.5
Pre-fill the FX rate field with 19.5 on first render; user can override.

**Pros**
- Zero extra network calls
- Works offline
- Immediate EUR conversion in preview
- Simple mental model: “rate is editable input”

**Cons**
- Not “correct by date” for historical invoices
- Requires user attention when the real rate differs materially

### Approach B: Auto-fetch BNM rate by invoice date (editable override)
Fetch rate using invoice date with fallback lookback; show source badge (BNM vs fallback vs manual).

**Pros**
- More accurate and “automatic”
- Better auditability for imported costs

**Cons**
- Network dependency + more failure states
- More UI states to explain (loading/fallback/error)

### Approach C: Backend owns FX + EUR conversion
Backend returns EUR-computed pricing (and used FX rate) as part of preview response; UI shows values and optionally allows override.

**Pros**
- Single source of truth
- Centralizes correctness (future multi-client consistency)

**Cons**
- Still needs a decision on override UX (if any)
- Requires backend changes + versioning coordination

## Key Decisions
- Default FX rate for invoice import preview is **19.5 MDL/EUR**.
- FX rate remains **user-editable** in the preview step.
- We do **not** require backend changes for this improvement.

## Open Questions
- Should we visually label the default as “Default (19.5)” vs “Manual” to reduce accidental wrong-rate imports?
- Do we want to persist last-used FX rate per device/session (so user overrides once)?
- Do we need invoice-currency detection later (EUR invoices, etc.), or keep “MDL only” for MVP?

## Next Steps
→ `/workflows:plan` to implement the UI default + any chosen UX labeling.

