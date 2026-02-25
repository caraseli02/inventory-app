---
status: complete
priority: p2
issue_id: "061"
tags: [code-review, invoice-import, idempotency, scalability, supabase]
dependencies: []
---

# Remove Global 5000-Row Cap From Invoice Idempotency Lookup

Avoid false negatives in invoice row dedupe caused by scanning only the first 5000 `stock_movements` notes globally and filtering client-side.

## Problem Statement

`getAlreadyImportedRowIds()` queries invoice import markers with `ilike('note', 'invoice_import|%')` and `limit(5000)`, then filters by supplier/invoice in application code. As data grows, matching rows can fall outside the first 5000 results, causing dedupe misses and duplicate stock movements.

## Findings

- Query selects all invoice notes globally, not scoped by current invoice identity, in `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceIdempotency.ts:89`.
- A hard limit of 5000 is applied before local filtering in `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceIdempotency.ts:94`.
- False negatives directly weaken the import-time idempotency guarantee for active stores with many invoice rows.

## Proposed Solutions

### Option 1: Add Structured Idempotency Columns/Table (Recommended Long-Term)

**Approach:** Store invoice supplier/invoice/row identifiers in dedicated columns or an `invoice_import_rows` table and query exact filters server-side.

**Pros:**
- Reliable and scalable
- Indexable exact matching
- Cleaner audit/reporting

**Cons:**
- Schema migration required
- More implementation work

**Effort:** 1-2 days

**Risk:** Medium

---

### Option 2: Encode Queryable Prefix and Narrow `ilike` Pattern

**Approach:** Build notes so invoice identity appears first in a normalized prefix, then query `ilike` with invoice-specific pattern.

**Pros:**
- No schema migration
- Much smaller result set per invoice

**Cons:**
- Depends on note format contract
- Still string parsing based

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Paginate Through All Matches

**Approach:** Page through `stock_movements` invoice notes until exhausted before filtering.

**Pros:**
- No schema change
- Correctness restored

**Cons:**
- Slow / expensive on large datasets
- More client complexity

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceIdempotency.ts`

## Resources

- **Branch:** `codex/feat-invoice-import-idempotent-actions`

## Acceptance Criteria

- [ ] Idempotency lookup does not miss rows due to global hard limit
- [ ] Import-time dedupe remains correct with >5000 historical invoice movement notes
- [ ] Performance impact is measured/documented

## Work Log

### 2026-02-25 - Code Review Discovery

**By:** Codex

**Actions:**
- Reviewed new idempotency helper query strategy
- Identified global cap + local filtering pattern
- Assessed correctness risk as dataset grows

**Learnings:**
- MVP-simple string note approach works initially, but current query shape undermines correctness guarantees at scale

## Notes

- Does not block immediate local repro, but weakens the stated acceptance criteria over time.
