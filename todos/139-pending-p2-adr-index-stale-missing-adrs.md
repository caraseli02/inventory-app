---
status: pending
priority: p2
issue_id: "139"
tags: [code-review, documentation, adr]
dependencies: []
---

# ADR index stale — 3 existing ADRs unlisted; 5+ architectural decisions lack ADRs

## Problem Statement
`docs/adrs/README.md` only lists ADR-0001 and ADR-0002. ADR-0003, -0004, and -0005 exist on disk but are absent from the index. Separately, 5+ significant architectural decisions made since January 2026 have no ADR at all, including the Twilio-over-Meta switch, WhatsApp-on-Vercel (not Edge Functions), and the EDA event-store adoption.

## Findings
**Existing ADRs missing from index:**
- `docs/adrs/ADR-0003-code-splitting-strategy.md` — ACCEPTED
- `docs/adrs/ADR-0004-git-hook-strategy.md` — Accepted
- `docs/adrs/ADR-0005-invoice-ocr-architecture-evolution.md` — Accepted

**Missing ADRs (no file exists):**
| Decision | Evidence | Status |
|---|---|---|
| Twilio over Meta WhatsApp Cloud API | `whatsapp_agent.md` changelog 0.3.0: "Switched from Meta to Twilio" | Missing |
| WhatsApp on Vercel Serverless (not Supabase Edge Functions) | Spec shows Edge Functions; implementation uses Vercel | Missing |
| Risk-tiered CI with detect-risk-tier.sh | `docs/plans/2026-02-17-refactor-risk-tiered-checks` plan | Missing |
| EDA / event-store pattern | `docs/plans/EDA_PLAN.md`, `src/lib/event-store/`, `src/lib/eda/` | Missing |
| WhatsApp module split into lib/whatsapp/ subdomain | `docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md` | Missing |

The Twilio switch is especially high-value: the spec's architecture diagram still shows Meta/Edge Functions, and the reversal has no documented rationale.

## Proposed Solutions

### Option A: Update index + create missing ADRs (Recommended)
1. Update `docs/adrs/README.md` to include ADR-0003, -0004, -0005
2. Create ADR-0006 for EDA adoption (highest architectural complexity)
3. Create ADR-0007 for Twilio-over-Meta decision
4. Create ADR-0008 for WhatsApp-on-Vercel decision
- Effort: Medium (1 index update + 3 ADR files)

## Technical Details
- Affected files: `docs/adrs/README.md`, new ADR files to create

## Acceptance Criteria
- [ ] `docs/adrs/README.md` lists all 5+ existing ADRs
- [ ] ADR-0006 created for EDA adoption with decision, rationale, trade-offs
- [ ] ADR-0007 created for Twilio-over-Meta decision
- [ ] `docs/specs/whatsapp_agent.md` architecture diagram updated to match ADR (Twilio/Vercel)

## Work Log
- 2026-03-17: Identified by architecture-strategist agent in ce-review
