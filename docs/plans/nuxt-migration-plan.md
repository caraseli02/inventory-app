# Plan: Nuxt Migration Implementation Stubs

## Branching Approach
- Create a long-lived integration branch (e.g., `nuxt-migration`) off `main`. Do not merge to `main` until Nuxt parity is verified.
- For each phase below, open a short-lived feature branch off `nuxt-migration` (e.g., `nuxt-migration/scaffold`, `nuxt-migration/providers`, etc.) and merge it back into the integration branch after review.
- Keep React code working in `main`; only the integration branch accumulates Nuxt changes until the cutover is complete.

## Ordered Implementation Steps

### 1) Project Scaffolding and Tooling
- Generate a Nuxt 3 skeleton (e.g., `npx nuxi init tmp-nuxt`) and move it into the repo on the `nuxt-migration/scaffold` branch, replacing the Vite/React entrypoints.
- Update `package.json` scripts/dependencies to Nuxt defaults; remove React/Vite dependencies and add Nuxt/TanStack Vue Query/Tailwind modules.
- Add `nuxt.config.ts`, Nuxt-style TypeScript/ESLint configs, and align Tailwind/postcss setup with Nuxt conventions.

### 2) Global Styles and Layout Shell
- Port `src/index.css` and any global styles into Nuxt’s `assets/` pipeline and reference them in `app.vue`.
- Create a base layout in `layouts/default.vue` that mirrors the current shell (navigation, toasts, page container) without breaking styles.

### 3) Core Providers and Plugins
- Replace `src/main.tsx` logic with Nuxt plugins: initialize `@tanstack/vue-query` client, logging/error handling, and i18n setup.
- Register plugins in `nuxt.config.ts` and ensure they run client and server side as needed.

### 4) Routing and Page Ports
- Recreate file-based routes under `pages/` that map to existing React pages; port one page at a time per branch (e.g., `nuxt-migration/pages-dashboard`, `.../pages-inventory`).
- Translate React components to Vue SFCs (`<script setup>`, Composition API) and adjust state management to Vue Query/i18n equivalents.
- Replace Radix UI React primitives with Vue-friendly alternatives or minimal custom components while keeping UX and accessibility.

### 5) Shared Components and Utilities
- Move reusable UI elements from `src/components` into `components/` with Vue implementations, preserving props/slots parity and styling.
- Convert utility hooks to Vue composables (e.g., data fetching, form helpers) and update imports across ported pages.

### 6) API and Backend Integration
- Migrate the upload endpoint to a Nuxt/Nitro server route (e.g., `server/api/upload.post.ts`) mirroring current behavior and ensuring Vercel compatibility.
- Audit all data-access code to ensure endpoints/env vars are read via Nuxt runtime config; adjust client/server boundaries.

### 7) Environment Variables and Config
- Rename `VITE_` variables to `NUXT_PUBLIC_` (client) or server-side keys; update `.env.example`, runtime config, and code references.
- Document required env vars in README and deployment docs once Nuxt wiring is in place.

### 8) Documentation and Developer Experience
- Update README and docs to Nuxt commands (`nuxi dev`, `nuxi build`, `nuxi preview`), tech stack, and deployment steps.
- Add migration notes/changelog to guide contributors switching from React to Nuxt.

### 9) QA, Parity Verification, and Cutover
- Set up branch-level CI for the `nuxt-migration` integration branch (lint, typecheck, unit tests, end-to-end smoke if available).
- Perform page-by-page parity checks against `main` before final merge; only merge `nuxt-migration` into `main` after passing QA and stakeholder sign-off.

## How to Merge Completed Tasks into the Integration Branch
- Keep `main` stable on React. Do all Nuxt work on short-lived branches cut from `nuxt-migration` (e.g., `nuxt-migration/pages-dashboard`).
- When a task is finished on its feature branch:
  1. Rebase the feature branch onto the latest `nuxt-migration` to avoid drift (`git fetch origin && git rebase origin/nuxt-migration`).
  2. Run lint/tests relevant to the change and ensure the branch is green.
  3. Open a PR targeting `nuxt-migration` (not `main`); request review and resolve feedback.
  4. Prefer fast-forward or squash merge into `nuxt-migration` after approval and CI pass; avoid merging `main` into `nuxt-migration` to reduce conflicts—rebase `nuxt-migration` on `main` only when necessary.
  5. Delete the feature branch after merge to keep the branch list clean.
- Repeat per task until `nuxt-migration` reaches parity, then follow the cutover plan to merge `nuxt-migration` into `main` once QA and approvals are complete.
