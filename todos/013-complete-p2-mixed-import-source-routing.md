---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, quality, import]
dependencies: []
---

# Mixed-source imports are routed through invoice path

Import routing uses `some()` to decide mode. If any row has `importSource === 'invoice'`, all rows are processed with invoice logic.

## Problem Statement

The handler currently assumes the batch is homogeneous. A mixed payload (invoice + xlsx rows) can route xlsx rows through invoice update/create semantics unexpectedly.

## Findings

- `src/pages/InventoryListPage.tsx:302` sets `isInvoiceImport` with `some(...)`.
- `src/pages/InventoryListPage.tsx:303` branches the full batch into invoice path.
- No per-row source guard exists inside the loop.

## Proposed Solutions

### Option 1: Enforce homogeneous batches at runtime (recommended)

Validate all rows share the same `importSource`; throw a clear error otherwise.

**Pros:**
- Small change.
- Prevents silent misrouting.

**Cons:**
- Rejects mixed batches instead of handling them.

**Effort:** Small

**Risk:** Low

---

### Option 2: Split and process by source

Partition into invoice/xlsx sub-batches and run each path explicitly.

**Pros:**
- Fully robust to mixed payloads.

**Cons:**
- More code and duplicated summary aggregation.

**Effort:** Medium

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `src/pages/InventoryListPage.tsx:302`
- `src/pages/InventoryListPage.tsx:303`

## Resources

- Review branch: `codex/invoice-pricing-parity-weight-edit`

## Acceptance Criteria

- [ ] Mixed-source payload is either rejected clearly or handled by explicit partitioning.
- [ ] Existing pure-xlsx and pure-invoice flows keep current behavior.
- [ ] Import summary remains accurate after source routing changes.

## Work Log

### 2026-02-11 - Code Review Discovery

**By:** Codex

**Actions:**
- Reviewed import mode routing condition.
- Validated that branch selection is batch-wide.

**Learnings:**
- Current function contract implicitly expects homogeneous input but does not enforce it.

## Notes

- Lower urgency than data duplication, but worth fixing for robustness.

### 2026-02-11 - Fix Implemented

**By:** Codex

**Actions:**
- Added strict source-homogeneity validation at import start.
- Mixed-source batches now fail fast with clear error toast and no writes.
- Kept existing behavior for pure invoice and pure xlsx batches.

**Learnings:**
- Batch-level guard is the smallest safe fix for routing ambiguity.
