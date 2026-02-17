---
date: 2026-02-17
topic: ios-pwa-update-reliability
---

# iOS PWA Update Reliability

## What We're Building
A reliable update experience for iPad-installed PWA so users stop seeing stale app versions after deployments.

Problem observed: on iOS, old builds can stay active, forcing incognito testing to confirm latest changes. We want predictable update behavior in production and testing without breaking active inventory work.

## Why This Approach
We considered three approaches:

### A) Force immediate reload on update detection
Pros: fastest rollout, lowest stale-version window.
Cons: interrupts active scanning/checkout; higher UX risk.

### B) User-controlled update modal (chosen)
Pros: explicit, predictable, visible to user.
Cons: update depends on user tap.

### C) Silent auto mode + only debug reset
Pros: minimal UI noise.
Cons: weak discoverability; support burden remains.

Recommendation: B plus cache-reset fallback. This balances reliability and workflow safety.

## Key Decisions
- Update UX: blocking modal (not banner/toast).
Reason: impossible to miss; clear action path.
- Trigger timing: show immediately when update detected.
Reason: user asked for newest build right away.
- Safety valve: add manual "Reset app cache / force refresh" control.
Reason: handles iOS cache edge cases quickly in field and QA.
- Scope focus: update flow + iOS validation checklist first.
Reason: solve stale-version pain before deeper offline features.

## Open Questions
- Should we suppress modal during critical flows (camera scan open, checkout submit)?
- Should modal copy include current app version/build id?
- Where should cache-reset live: Settings, Debug panel, or both?

## Next Steps
→ Run `/workflows:plan` to define implementation tasks, acceptance criteria, and iOS test matrix.
