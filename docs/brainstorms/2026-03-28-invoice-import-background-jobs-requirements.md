---
date: 2026-03-28
topic: invoice-import-background-jobs
---

# Invoice Import Background Jobs

## Problem Frame

Invoice extraction can run long enough that the current dialog becomes the de facto owner of progress. If the user closes the dialog, they lose visibility into the running work and have no durable place to return to the result. That makes a legitimate background process feel fragile and discourages normal app use while extraction runs.

## Requirements

- R1. Invoice extraction jobs must continue independently of the import dialog after submission.
- R2. Closing the import dialog during extraction must not interrupt or discard the running job from the user's point of view.
- R3. The app must expose a global background-jobs tray in the app shell that becomes the source of truth for long-running invoice extraction jobs.
- R4. Each tray item must show at least the file name and current job status while extraction is running.
- R5. When extraction succeeds, the tray item must change to a clear `Ready to review` state rather than auto-opening the review UI.
- R6. Selecting a ready tray item must reopen the existing invoice review flow with the extracted result.
- R7. The first slice should reuse the current preview/review experience once a user opens a completed job, rather than introducing a new review surface.
- R8. If extraction fails, the tray must show a clear failed state with an explicit retry or re-upload path.
- R9. The dialog close action should close immediately with no extra warning or confirmation once the job has been submitted.

## Success Criteria

- Users can close the invoice dialog during extraction and later return to the completed result from the tray.
- Users no longer need to keep the dialog open to feel safe that progress is preserved.
- Successful extraction completion does not interrupt the user by auto-opening review.
- The first shipped version improves reliability and confidence without creating a second full invoice-editing workflow.

## Scope Boundaries

- No dedicated jobs page in this slice.
- No inventory-page queue in this slice.
- No auto-open review when extraction completes.
- No auto-import behavior from the background job.
- No saved draft editing state across repeated preview opens beyond what is needed to reopen extracted results.

## Key Decisions

- Global tray over page-local queue: long-running work should remain visible anywhere in the app.
- Ready-to-review over auto-open: completion should be discoverable but not disruptive.
- Minimal tray item content: show file name and job status only in v1; deeper invoice summary is deferred.
- Reuse existing review UI: keep this slice focused on durable job ownership, not redesigning invoice review.
- Immediate close with background continuation: avoid adding more modal friction once submission succeeds.

## Dependencies / Assumptions

- The async extraction job contract from the hybrid extraction flow remains available and exposes stable job identity plus terminal result retrieval.
- The app shell can host a global tray or persistent jobs affordance visible outside the invoice dialog.
- Completed extraction results can be reopened into the existing preview flow without requiring the original dialog-local in-memory state.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] Where the global tray state should live so it survives dialog unmount and stays consistent across app navigation.
- [Affects R6][Technical] Whether reopening a ready job should hydrate the dialog directly from stored extraction payload or refetch from the job endpoint on open.
- [Affects R8][Needs research] What retry semantics are safest for failed jobs versus forcing a fresh upload.
- [Affects R4][Technical] What status vocabulary is the smallest useful set for tray items without leaking backend protocol details.

## Next Steps

→ /prompts:ce-plan for structured implementation planning
