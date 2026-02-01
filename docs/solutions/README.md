# Solutions Knowledge Base

This directory contains structured solutions to resolved issues, serving as a permanent knowledge base for the project.

## Structure

Solutions are organized by category:
*   `frontend/`: React, UI components, client-side logic.
*   `backend/`: Supabase, Edge Functions, database, API.
*   `infrastructure/`: Hosting (Vercel), CI/CD, PWA configs.
*   `security/`: Auth, RLS, CSP, validation.
*   `ux/`: Accessibility, design, user interaction flows.

## How to Add a Solution

1.  Copy `_template.md` to the appropriate category directory.
2.  Rename it to a slugified title (e.g., `scanner-infinite-loop.md`).
3.  Fill in the YAML frontmatter and markdown sections.
4.  Commit the file. The pre-commit hook will validate it.

## Search

Use the `learnings-researcher` agent (coming soon) or simply grep/search this directory.

## Solution Index

| Category | Solution | Severity | Date | Status |
|----------|-----------|----------|------|--------|
| frontend | [Checkout Infinite Loop on Non-Existent Products](frontend/checkout-infinite-loop-on-non-existent-products.md) | HIGH | 2026-02-01 | resolved |
| frontend | [Mobile Checkout Scanner Always Active](frontend/mobile-checkout-scanner-always-active.md) | HIGH | 2026-02-01 | resolved |
| frontend | [Scanner Active During Modal Interaction](frontend/scanner-active-during-modal-interaction.md) | HIGH | 2026-02-01 | resolved |
| frontend | [Scanner Loop (Continuous Item Additions)](frontend/scanner-loop-continuous-item-additions.md) | HIGH | 2026-02-01 | resolved |
| infrastructure | [Black Screen After Deployment (Chunk Load Failed)](infrastructure/black-screen-after-deployment-chunk-load-failed.md) | HIGH | 2026-02-01 | resolved |
| security | [Production App Shows Black Screen](security/production-app-shows-black-screen.md) | HIGH | 2026-02-01 | resolved |
| ux | [Transparent Dialog Background](ux/transparent-dialog-background.md) | HIGH | 2026-02-01 | resolved |
