---
status: complete
priority: p3
issue_id: "071"
tags: [code-review, whatsapp, simulator, deployment-scope]
dependencies: []
---

# Disable `/api/whatsapp-simulate` on Vercel and keep simulator local-only

## Problem Statement

`/api/whatsapp-simulate` was previously treated like a deployable endpoint, which made its missing production auth look like a `p1` security problem. The intended product scope is narrower: the simulator is for local debugging only and should not exist in preview/production.

## Findings

- The simulator is only needed for local development and debugging.
- Treating it as a production route created unnecessary auth hardening work for a feature that should never be deployed.
- The local Vite middleware already provides the intended developer workflow.

## Resolution

### Chosen approach: make the Vercel function unavailable

**Approach:**
- Return `404` from `api/whatsapp-simulate.ts` when `process.env.VERCEL` is set.
- Keep the Vite dev middleware as the supported local simulator path.
- Update the runbook to document that the simulator is local-only.

**Pros:**
- Removes preview/production attack surface entirely
- Matches actual intended scope
- Simpler than adding production auth/rate-limits for a non-shipped tool

**Cons:**
- Simulator cannot be used on deployed previews

**Effort:** Small

**Risk:** Low

## Acceptance Criteria

- [x] On Vercel, `/api/whatsapp-simulate` returns `404`
- [x] Local Vite dev simulator flow still works
- [x] Unit test coverage exists for the Vercel `404` behavior
- [x] Runbook documents simulator as local-only

## Work Log

### 2026-03-06 - Scope decision recorded

**By:** Codex

**Actions:**
- Reframed simulator exposure as a scope issue, not a production auth feature.
- Lowered the priority from `p1` to `p3` by making the route unavailable on Vercel.
- Updated tests and runbook to reflect local-only support.

**Learnings:**
- If a tool is explicitly dev-only, the cleanest fix is usually to remove deployed surface area rather than harden it like a product feature.
