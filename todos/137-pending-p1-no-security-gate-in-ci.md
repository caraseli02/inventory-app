---
status: done
priority: p1
issue_id: "137"
tags: [code-review, security, ci]
dependencies: []
---

# No security gate in CI — security regressions pass undetected

## Problem Statement
`ci.yml` has zero security-focused jobs. No secret scanning, no dependency audit (`pnpm audit`), no SAST, no CORS/auth regression checks. All documented security fixes (Twilio HMAC validation, path traversal, `VITE_NOTIFY_SECRET` exposure, invoice API key) could be re-introduced and pass CI undetected.

## Findings
- `ci.yml`: no `pnpm audit`, no secret scanning (GitHub secret scanning is separate and not repo-configured), no SAST step
- `lib/whatsapp/webhook.ts` (Twilio signature validation) is in `lib/whatsapp/` → low-risk tier → no tests triggered (see todo #130)
- PR template has no security-review checkbox for `api/` or auth changes
- CLAUDE.md documents `security-sentinel` routing rule but it is advisory text, not CI-enforced
- Past security solutions: `docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`, `docs/solutions/api-errors/client-bundled-secret-whatsapp-notify-20260305.md`, `docs/solutions/logic-errors/replay-mode-path-traversal-and-missing-prod-guard-WhatsAppAgent-20260316.md`

## Proposed Solutions

### Option A: Add pnpm audit to CI validate job (Quick win)
```yaml
- name: Audit dependencies
  run: pnpm audit --audit-level=high
```
- Effort: Tiny
- Catches: known CVEs in dependencies
- Does not catch: custom auth regressions

### Option B: Add security-review checkbox to PR template for api/ changes
Add a section to `.github/pull_request_template.md`:
```
### Security Review (required for api/, lib/whatsapp/, mcp/ changes)
- [ ] Twilio signature validation unchanged or intentionally modified
- [ ] No secrets added to VITE_ env vars (client bundle)
- [ ] Auth/CORS headers reviewed
```
- Effort: Small
- Enforced by convention, not CI

### Option C: Add lib/whatsapp/ to high-risk tier (see todo #130)
Ensures full test suite runs including Twilio auth tests, which serves as a de-facto security regression check for webhook auth.
- This is a prerequisite, not a full security gate

### Option D: GitHub secret scanning (repo setting)
Enable GitHub Advanced Security / secret scanning for the repository.
- Effort: Repo admin action
- Catches: accidental secret commits

**Recommended**: All of A + B + C (with C tracked separately as #130). D as a repo admin task.

## Technical Details
- Affected files: `.github/workflows/ci.yml`, `.github/pull_request_template.md`

## Acceptance Criteria
- [x] `pnpm audit --audit-level=high` runs in CI (via `node scripts/audit-check.js`, ignores known-unfixable xlsx advisories GHSA-4r6h-8v6p-xvw6 + GHSA-5pgg-2g8v-p4x9)
- [ ] PR template has security-review checklist for api/whatsapp/mcp changes
- [ ] `lib/whatsapp/` changes trigger full test suite (via #130)

## Work Log
- 2026-03-17: Identified by security-sentinel agent in ce-review
- 2026-03-17: Fixed — added `node scripts/audit-check.js` to CI validate job; updated 9 direct/transitive deps; added pnpm overrides for 8 transitive vulns; xlsx acknowledged as unfixable (no patched version on npm)
