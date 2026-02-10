---
date: 2026-02-10
topic: cleanup-and-security-hardening
---

# Cleanup And Security Hardening

## What We're Building
A short, low-risk maintenance cycle with two goals: clean repo/workspace clutter and remove exposed invoice API credentials from the browser bundle. This keeps day-to-day dev flow cleaner and reduces immediate security risk.

## Why This Approach
We chose a balanced approach: perform safe cleanup first, then implement the highest-priority security fix. This avoids large architectural changes and delivers immediate value in one session.

## Key Decisions
- Keep deletion of `test-screenshots/*` tracked artifacts: user confirmed these files are no longer needed.
- Prefer server-side invoice proxy: browser now calls `/api/extract-invoice` and does not send `X-API-Key`.
- Keep direct FastAPI path only as dev fallback: `VITE_INVOICE_API_URL` can still be used in local dev when proxy is unavailable.
- Move secrets to server env: `INVOICE_API_KEY` and `INVOICE_API_URL` are now server-side configuration.

## Open Questions
- Should invoice extraction require authenticated Supabase session before proxying?
- Which remaining non-main branches should be archived vs deleted permanently?
- Should we remove stale docs that still prescribe client-side `VITE_INVOICE_API_KEY` usage?

## Next Steps
1. Add Supabase session validation in `api/extract-invoice.ts`.
2. Update security/architecture docs to make proxy path the canonical production setup.
3. Do a second cleanup pass for remaining stale local branches (manual review per branch).
