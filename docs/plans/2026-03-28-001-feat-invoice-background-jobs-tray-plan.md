---
title: "feat: Invoice background jobs tray"
type: feat
status: active
date: 2026-03-28
origin: docs/brainstorms/2026-03-28-invoice-import-background-jobs-requirements.md
---

# feat: Invoice background jobs tray

## Overview

Move long-running invoice extraction ownership out of the invoice dialog and into durable app-level state. Add a global background-jobs tray in the app shell that tracks invoice extraction jobs across dialog close, shows lean status, and lets users reopen completed jobs into the existing invoice review flow.

This plan carries forward the product decisions from the origin requirements doc and keeps the first slice intentionally narrow: no jobs page, no auto-open review, no draft editing persistence, no new review surface (see origin: `docs/brainstorms/2026-03-28-invoice-import-background-jobs-requirements.md`).

## Problem Statement / Motivation

The current hybrid extraction flow solved the timeout problem but preserved a modal-owned UX boundary:

- extraction polling lives in [`src/hooks/useInvoiceFileState.ts`](/Users/vladislavcaraseli/Documents/inventory-app/src/hooks/useInvoiceFileState.ts)
- closing the dialog invalidates the active attempt and polling loop
- invoice extraction result is not promoted to any durable app-level object

That leaves users with a long-running background task hidden behind a transient surface. The mismatch causes fear of closing the dialog, loss of confidence in progress, and no stable place to return to finished work.

## Origin Decisions To Preserve

- Global tray, not page-local queue (see origin)
- `Ready to review`, not auto-open (see origin)
- Tray item content stays lean: file name + status (see origin)
- Reuse the existing invoice review flow once opened (see origin)
- Close immediately; no confirmation gate once submission succeeded (see origin)

## Research / Existing Context

### Relevant code paths

- [`src/layouts/AppShell.tsx`](/Users/vladislavcaraseli/Documents/inventory-app/src/layouts/AppShell.tsx): current app-shell host for global UI affordances
- [`src/components/invoice/InvoiceUploadDialog.tsx`](/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx): current modal owner of invoice import UI
- [`src/hooks/useInvoiceFileState.ts`](/Users/vladislavcaraseli/Documents/inventory-app/src/hooks/useInvoiceFileState.ts): owns active extraction attempt, polling, and modal-local state
- [`src/lib/invoiceOCR.async.ts`](/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceOCR.async.ts): accepted response parsing and job status polling
- [`src/pages/InventoryListPage.tsx`](/Users/vladislavcaraseli/Documents/inventory-app/src/pages/InventoryListPage.tsx): current dialog entry point

### Relevant learnings

- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`
  - preserve stable row identity when reopening or hydrating preview rows
- `docs/solutions/state-issues/invoice-preview-duplicate-rowid-key-collision-InvoiceUploadDialog-20260320.md`
  - treat OCR row ids as untrusted for UI identity; keep preview identity stable and collision-safe
- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`
  - import progress should be live and explicit; avoid fake or frozen status ownership
- `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`
  - extraction progress and cancellation semantics must stay explicit; long-running jobs need durable user feedback

### Planning decisions from local context

- App-shell placement is viable because `AppShell` already owns global UI affordances without coupling to one page.
- The async extraction contract already exposes `jobId`, `jobStatus`, `statusUrl`, and terminal result payloads, so the tray can be driven by the existing backend model rather than a new backend feature.
- Review reopening should hydrate from stored successful payload first. Refetching on open can remain a fallback, but v1 should not depend on job result retention timing at the backend if the frontend already has the successful payload.

## Proposed Solution

Introduce a small invoice-jobs client state layer owned above the dialog and rendered in the app shell.

### Core behavior

1. User uploads an invoice from the existing dialog.
2. If extraction completes inline, behavior stays effectively unchanged.
3. If extraction becomes async, the submission registers an app-level invoice job record.
4. The dialog may close immediately; the app-level job continues polling independently.
5. The global tray shows running jobs anywhere in the app.
6. When a job succeeds, the tray updates to `Ready to review`.
7. Clicking that tray item opens the existing invoice dialog directly in preview mode using the completed extraction payload.
8. If a job fails, the tray shows a failure state with a path to retry via fresh upload.

### State model

Create a new app-level invoice job entity with enough data to detach extraction from the dialog:

- `jobId`
- `fileName`
- `statusUrl`
- `jobStatus`: `queued | processing | ready | failed`
- `retryAfterSeconds`
- `error`
- `invoiceData` on success
- `createdAt`
- `updatedAt`

Notes:

- Frontend-facing tray status should collapse backend protocol details into a small vocabulary:
  - `processing` for `queued | processing`
  - `ready`
  - `failed`
- `invoiceData` should be stored when extraction succeeds so reopen does not depend on keeping the dialog mounted.

### Ownership model

- Dialog owns upload interaction and preview/import interaction.
- App-level invoice-jobs store owns async extraction lifecycle after submission.
- App shell owns global visibility via the tray.
- Inventory page remains an entry point for starting import, not the long-term owner of running jobs.

## Technical Approach

### 1. Add app-level invoice jobs store

Introduce a small React context/provider or equivalent app-level store mounted under `AppShell`.

Responsibilities:

- register new async extraction jobs
- poll job status independent of dialog lifecycle
- persist terminal success payload in memory for the current session
- expose actions:
  - `registerPendingJob`
  - `markJobSucceeded`
  - `markJobFailed`
  - `dismissJob`
  - `openJobReview`

Implementation guidance:

- Keep this in-memory for v1; no cross-refresh persistence
- Keep polling ownership centralized here, not duplicated in both tray and dialog
- Use one polling loop per active job, guarded against duplicate pollers

Deepened decision:

- mount the provider inside [`src/layouts/AppShell.tsx`](/Users/vladislavcaraseli/Documents/inventory-app/src/layouts/AppShell.tsx), not per-page
- reason: `AppShell` already wraps all routed pages via [`src/App.tsx`](/Users/vladislavcaraseli/Documents/inventory-app/src/App.tsx), so job visibility survives route changes without introducing another root provider in `main.tsx`

### 2. Lift async extraction handoff out of modal-local ownership

Refactor invoice upload flow so:

- upload validation and file submission can remain in the dialog/hook
- once `extractInvoiceData()` returns a pending result, the dialog hands off that job to the app-level store
- modal-local `cancelActiveAttempt()` must stop being the user-visible owner of the job after handoff

Result:

- closing the dialog no longer means “cancel the visible workflow”
- dialog close only closes UI, not job tracking

Deepened decision:

- once a pending response is returned, the dialog must no longer own polling
- the current `pollPendingExtraction(...)` logic in [`src/hooks/useInvoiceFileState.ts`](/Users/vladislavcaraseli/Documents/inventory-app/src/hooks/useInvoiceFileState.ts) should move behind the shared store seam
- the dialog can still own inline success (`200`) and local validation errors; only async jobs are promoted into shared state

### 3. Add a global tray UI in `AppShell`

Add a compact tray or popover anchored in the shell header area.

Tray requirements:

- visible from anywhere in the app
- shows count or presence of active/ready/failed jobs
- each item shows:
  - invoice file name
  - lean user-facing status
- ready item includes `Review`
- failed item includes `Retry` or `Upload again`
- running item is informational only in v1

Do not build:

- full jobs page
- detailed invoice summaries
- per-item progress percentages unless already available cheaply and truthfully

Deepened decision:

- prefer a compact popover-style tray anchored near the existing shell controls before escalating to a sheet
- reason: the brainstorm chose a global tray, not a destination page; the shell already has compact controls (`LanguageSelector`, reset button), so a small affordance fits the chosen product posture better than a modal surface

### 4. Reopen existing review flow from a completed job

Add a way for `InventoryListPage` + `InvoiceUploadDialog` to open directly with completed extraction data.

Recommended shape:

- extend `InvoiceUploadDialog` props with an optional initial session object:
  - `initialInvoiceData`
  - `initialFileName`
  - optional “source job id”
- dialog initializes directly into `preview` when those props exist

This keeps the existing preview/import UI intact and avoids a second review surface.

Deepened decision:

- prefer stored payload hydration first, not status-endpoint refetch on open
- reason: success payload already passed runtime validation in the shared polling path; reusing it avoids backend result-retention coupling and makes “Ready to review” deterministic
- optional fallback refetch is acceptable only when payload is absent, not as the primary path

### 5. Failure and retry semantics

For v1:

- failed tray items should not attempt opaque backend job restart
- retry should mean: reopen uploader with file-selection step and let the user re-upload
- keep failed item dismissible once user takes action or chooses to ignore it

Reasoning:

- safest behavior without assuming backend restart semantics
- avoids duplicating hidden extraction requests
- aligns with the origin requirement of explicit retry/re-upload path

Deepened decision:

- “Retry” in tray copy should mean “start a new upload”, not “resume this failed job”
- failed items should keep enough metadata for operator clarity (`fileName`, failure state, optional message), but should not be treated as resumable workflows

## SpecFlow / Edge Cases

- Close dialog immediately after async handoff: job remains visible in tray and continues polling
- Navigate between pages while job is running: tray stays visible and job keeps progressing
- Multiple invoice jobs submitted in one session: tray handles multiple items without status collision
- Successful job completes while dialog is closed: tray changes to `Ready to review`; no auto-open
- Successful job completes while dialog remains open on upload/processing screen:
  - source of truth should be singular
  - prefer store-driven completion and either:
    - update the open dialog from shared store, or
    - leave dialog open but ensure no duplicate pollers/state races
- Failed job while dialog closed: tray shows failed state and actionable retry path
- Open ready job twice: reopening should preserve stable preview identity and not duplicate/remap row state incorrectly
- Duplicate or stale job completion callbacks must not reopen the wrong invoice session

## Risks / Unknowns

- Dual ownership race: if both dialog and global store poll, state can drift or double-complete
- Rehydration correctness: preview rows must preserve stable identity rules from prior invoice row-state fixes
- Session-only persistence: closing the browser tab will still lose job visibility in v1
- Tray UX crowding: app shell header is small; UI must stay compact and tablet-friendly

## Implementation Units

### Unit 1: Create app-level invoice jobs state

- Goal: add a shared store/provider for invoice extraction jobs mounted under `AppShell`
- Files:
  - `src/layouts/AppShell.tsx`
  - new files under `src/components/invoice/` or `src/hooks/` / `src/lib/` for provider + types
- Approach:
  - define job entity + reducer/state transitions
  - centralize status polling and terminal result storage
  - expose hooks/actions for dialog and tray consumers
- Patterns to follow:
  - existing app-level state patterns in `src/hooks/useToast.tsx`
  - current async polling semantics in `src/hooks/useInvoiceFileState.ts`
- Verification:
  - types compile
  - store can register pending job, transition to ready/failed, and expose data to consumers

### Unit 2: Add global background jobs tray UI

- Goal: render job presence and actions in app shell
- Files:
  - `src/layouts/AppShell.tsx`
  - new tray component under `src/components/invoice/`
  - locale files as needed
- Approach:
  - add a compact shell affordance with job count/badge
  - show lean item rows with status + actions
  - keep styling consistent with existing shell controls
- Patterns to follow:
  - shell header controls in `src/layouts/AppShell.tsx`
  - shadcn dialog/sheet/popover patterns already used in repo
- Verification:
  - tray visible when jobs exist
  - running, ready, failed states render correctly
  - no tray shown when empty unless intentionally designed otherwise

### Unit 3: Refactor invoice dialog handoff and reopen path

- Goal: make dialog capable of handing off async jobs and reopening from completed payloads
- Files:
  - `src/components/invoice/InvoiceUploadDialog.tsx`
  - `src/hooks/useInvoiceImport.ts`
  - `src/hooks/useInvoiceFileState.ts`
  - `src/pages/InventoryListPage.tsx`
- Approach:
  - split “submit file” from “own async polling”
  - pass pending jobs to app-level store
  - add optional initial payload props so dialog can open directly into preview
- Patterns to follow:
  - current preview initialization logic in invoice hooks
  - prior stable preview identity learnings from invoice row-state fixes
- Verification:
  - async submit can close immediately and continue in tray
  - opening a ready job lands in preview with extracted rows intact

### Unit 4: Failure handling, actions, and regression tests

- Goal: cover failure/retry UX and protect against state races
- Files:
  - invoice job store files
  - invoice dialog tests / hook tests
  - possibly app-shell integration tests
- Approach:
  - define retry as fresh upload path
  - add tests for close-while-processing, ready-to-review reopen, and failed-job action path
  - verify no stale completion updates the wrong session
- Patterns to follow:
  - invoice async tests and row-state regression coverage already in repo
- Verification:
  - automated coverage for tray-driven reopen and close-safe behavior

## Requirements Trace

- R1, R2: Units 1 and 3 detach extraction lifecycle from dialog ownership
- R3, R4, R5: Units 1 and 2 add global tray + lean status + ready state
- R6, R7: Unit 3 reopens existing review flow from completed payload
- R8: Units 2 and 4 define failed state and retry path
- R9: Unit 3 ensures dialog close is immediate after submission

## Test Scenarios

- Upload invoice that returns `202`, close dialog, verify tray shows processing job
- Let background job succeed, verify tray shows `Ready to review` without auto-opening dialog
- Click ready tray item, verify existing preview UI opens with extracted invoice rows
- Submit two invoices, verify tray shows both and actions target the correct job
- Force job failure, verify tray shows failed state and offers explicit retry/re-upload path
- Close and reopen dialog while job is still running, verify no duplicate pollers or stale state takeover
- Verify preview row actions/removals still bind to correct rows after opening from tray-backed payload

## Verification

- `pnpm typecheck`
- `pnpm lint`
- targeted unit/integration tests for invoice job store + dialog reopen flow
- if browser coverage is practical in this session, verify tray behavior manually or via Playwright

Deepened verification focus:

- add at least one integration-style test around the shared store transitions instead of only reducer-level tests
- cover the exact regression boundary that motivated this feature:
  - dialog close after async handoff does not stop the job from reaching `ready`
  - clicking `Review` opens preview with the same extracted rows
- cover the stale-completion guard:
  - two jobs in flight
  - completion of job A must not hydrate job B's review session

## Deferred To Implementation

- Choose exact tray primitive: popover, sheet, or inline dropdown based on current shell constraints
- Decide whether open-ready should use stored payload only or opportunistic refetch fallback when payload missing
- Decide whether successful ready jobs remain in tray until dismissed or auto-clear after import completion

## Rollout / Operational Notes

- This is frontend-only against the existing async extraction contract; no backend contract expansion is required for the first cut
- Logging should include job id and file name on handoff, success, failure, and review-open actions for debugging
- If polling bugs appear, safest fallback is to keep tray visible but disable reopen until terminal payload exists, rather than guessing state

## Recommended Execution Order

1. Unit 1: app-level store
2. Unit 2: tray UI
3. Unit 3: dialog handoff + reopen
4. Unit 4: failure handling + regressions
