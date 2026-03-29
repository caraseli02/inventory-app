# Project Status

Last updated: 2026-03-29
Canonical status doc for current priorities, active work, recent completions, and handoff context. Use this as the control layer above `docs/plans/` and `docs/solutions/`.

## Current Priorities

1. Finish the invoice import reliability track so long-running extraction jobs stay visible and reviewable.
2. Land the WhatsApp parity harness so replay remains authoritative and simulator drift is easier to catch.
3. Keep the docs workflow aligned with Compound Engineering: plans for implementation intent, solutions for resolved learnings, this file for current control/status.

## Active Work

### Invoice extraction reliability

- Status: Active
- Why it matters: invoice OCR can exceed the old frontend timeout budget, so the app needs a durable async handoff and visible review path.
- Canonical plans:
  - [2026-03-27-001-feat-hybrid-invoice-extraction-flow-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-27-001-feat-hybrid-invoice-extraction-flow-plan.md)
  - [2026-03-28-001-feat-invoice-background-jobs-tray-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-28-001-feat-invoice-background-jobs-tray-plan.md)
- What is left:
  - keep async extraction handoff durable and easy to understand
  - keep review reopening on the existing invoice flow
  - continue closing UX gaps around where job status appears after dialog close
- How to continue:
  - start from the March 27 and March 28 plans
  - review the most recent invoice background-jobs solution docs before changing the UI or polling behavior

### WhatsApp parity harness

- Status: Active
- Why it matters: replay, simulator, and real webhook behavior still need a tighter parity loop for user-visible outputs.
- Canonical plan:
  - [2026-03-26-001-feat-whatsapp-parity-harness-vertical-slice-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-26-001-feat-whatsapp-parity-harness-vertical-slice-plan.md)
- What is left:
  - add the first shared parity fixtures
  - compare replay vs simulator for high-signal flows
  - document the harness in the WhatsApp testing/runbook docs
- How to continue:
  - keep replay authoritative
  - focus phase 1 on user-visible transport/message parity, not full state equivalence

## Recently Completed

- 2026-03-29: added an inline inventory-page background jobs panel so invoice progress is visible after dialog close.
  - Solution: [background-invoice-jobs-hidden-in-header-tray-InventoryListPage-20260329.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/solutions/ui-bugs/background-invoice-jobs-hidden-in-header-tray-InventoryListPage-20260329.md)
- 2026-03-15: completed WhatsApp template parity for text and button flows.
  - Plan: [2026-03-15-001-feat-whatsapp-template-parity-text-and-button-flows-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-15-001-feat-whatsapp-template-parity-text-and-button-flows-plan.md)

## Next Up

- Triage and resolve the remaining late-March pending todos tied to current areas of work:
  - [173-pending-p3-align-search-products-output.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/todos/173-pending-p3-align-search-products-output.md)
  - [177-pending-p3-avoid-parsing-inventory-from-system-prompt.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/todos/177-pending-p3-avoid-parsing-inventory-from-system-prompt.md)
  - [180-pending-p3-dedup-whatsapp-search-products-tool-and-test-fakes.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/todos/180-pending-p3-dedup-whatsapp-search-products-tool-and-test-fakes.md)
  - [181-pending-p3-invoice-row-action-buttons-aria-labels.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/todos/181-pending-p3-invoice-row-action-buttons-aria-labels.md)
  - [182-pending-p3-update-solution-doc-for-previewid-uniqueness.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/todos/182-pending-p3-update-solution-doc-for-previewid-uniqueness.md)

## Decision Notes

- `docs/project-status.md` is the current control tower.
- `docs/plans/` remains the implementation record and source for active execution details.
- `docs/solutions/` remains the resolved-problem memory layer.
- `feature_list.json` is still useful for structured feature/test tracking, but it is not the handoff layer.
- `docs/project/claude-progress.md` is deprecated as an active tracker and now points here.

## Links To Canonical Plans

- [2026-03-26-001-feat-whatsapp-parity-harness-vertical-slice-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-26-001-feat-whatsapp-parity-harness-vertical-slice-plan.md)
- [2026-03-27-001-feat-hybrid-invoice-extraction-flow-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-27-001-feat-hybrid-invoice-extraction-flow-plan.md)
- [2026-03-28-001-feat-invoice-background-jobs-tray-plan.md](/Users/vladislavcaraseli/.codex/worktrees/ba5b/inventory-app/docs/plans/2026-03-28-001-feat-invoice-background-jobs-tray-plan.md)

## Update Rules

- Update this file in every PR that changes shipped behavior, active priorities, roadmap order, or the meaning of "what's next".
- Keep entries short and current. Prefer replacing stale bullets over appending long logs.
- When work moves from active to done, link the merged plan and any new solution doc.
- When a new plan becomes active, add it here in the same PR that starts the work.
