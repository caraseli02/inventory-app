# Nuxt migration rollout checklist

This checklist keeps the `nuxt-migration` branch stable, aligned with `main`, and ready for release after QA and stakeholder approval.

## CI guardrails
- New workflow: `.github/workflows/nuxt-migration.yml` runs on `push`/`pull_request` to `nuxt-migration` and executes `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Scripts:
  - `pnpm lint` – ESLint coverage for the repository.
  - `pnpm typecheck` – TypeScript project references using `tsc -b --noEmit`.
  - `pnpm test` – Node.js test runner via `node --test` (see `tests/smoke.test.js`).
- Keep CI green before asking for review or QA.

## Page-by-page parity checks
1. Deploy or run both `main` and `nuxt-migration` (e.g., `pnpm dev --host` on separate ports).
2. For every user-facing page/screen:
   - Compare layout, copy, navigation, and locale handling against `main`.
   - Verify data flows (API calls, forms, barcode scan, inventory edits) using realistic seed data.
   - Confirm PWA behaviours (offline prompts, icons, caching) still match.
   - Capture any differences with screenshots and short notes.
3. Log parity findings in the PR description and track blockers in issues.

## QA and stakeholder sign-off
- QA pass criteria:
  - All parity items marked as matched or intentionally improved.
  - Smoke tests (add/edit items, search, scanning, export/import) executed on `nuxt-migration` build.
  - No open P1/P2 bugs.
- Stakeholder review:
  - Share release notes and parity summary.
  - Demo key flows and confirm acceptance.
- Merge policy:
  - Only merge `nuxt-migration` → `main` after QA and stakeholder approval are recorded in the PR description.
  - Keep the branch rebased on `main` until merge to reduce drift.
