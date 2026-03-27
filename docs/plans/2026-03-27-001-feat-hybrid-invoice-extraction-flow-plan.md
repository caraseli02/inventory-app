---
title: "feat: Hybrid invoice extraction sync/async flow"
type: feat
status: active
date: 2026-03-27
---

# feat: Hybrid invoice extraction sync/async flow

## Overview

Invoice import currently assumes one browser request can stay open until OCR + parsing completes. That assumption no longer holds: real backend runs can exceed the frontend timeout even for small PDFs, which leaves users staring at a stuck modal and misclassifies slow-but-valid work as failure.

This plan replaces the single long-held request model with a smaller first-slice hybrid flow:

- Keep a fast synchronous path for invoices that complete quickly.
- Hand long-running work off to an async job path with status polling while the dialog remains open.
- Reuse the existing preview/import path unchanged once extraction succeeds.

## Problem Statement / Motivation

Recent reproduction and backend validation showed:

- frontend timeout fires at 120s for `1_0(002)0019_014286.pdf`
- backend completed a representative invoice successfully in `152.16s`
- current timeout heuristic is tied to file size, but actual latency is dominated by OCR/LLM compute and backend queue time
- current UI progress semantics are misleading: users see `40%` for long stretches with no durable status and no distinction between `upload finished` vs `backend still processing`

If left unchanged:

- valid imports will continue to fail under normal backend latency variation
- support/debugging remains expensive because the UI collapses timeout, upstream latency, and backend failure into one error class
- invoice import reliability will not scale as OCR workload grows

## Proposed Solution

Adopt a backend-owned hybrid sync/async extraction contract with an intentionally small v1.

### Recommended Product Behavior

1. User uploads invoice from the existing dialog.
2. Client submits the invoice through `POST /extract`.
3. Backend decides immediately whether the request can complete inline or should move to a durable job.
4. If extraction completes within the backend fast-path budget, return `200` and continue with today’s preview-first flow.
5. If extraction is predicted to be slow, backend returns `202 Accepted` with a minimal job envelope.
6. Client polls the job endpoint until terminal success or terminal failure while the dialog remains open.
7. On terminal success, preview opens with extracted rows and existing pricing-preview/import behavior.
8. Closing the dialog stops polling in v1. Same-session reopen recovery and cross-refresh recovery are deferred.

### Locked v1 API Contract

`POST /extract`

- `200 OK`
  - returns the current extraction payload unchanged when the invoice completes within the backend fast-path budget
- `202 Accepted`
  - returns:

```json
{
  "job_id": "ext_123",
  "status": "queued",
  "status_url": "/invoice/extraction-jobs/ext_123"
}
```

`GET /invoice/extraction-jobs/:jobId`

- non-terminal states:
  - `queued`
  - `processing`
- terminal success:

```json
{
  "job_id": "ext_123",
  "status": "succeeded",
  "result": { "...current extract payload..." }
}
```

- terminal failure:

```json
{
  "job_id": "ext_123",
  "status": "failed",
  "error": {
    "code": "EXTRACTION_FAILED",
    "message": "Unable to extract invoice"
  }
}
```

Protocol rules for v1:

- backend owns the `200` vs `202` decision
- clients do not choose sync vs async
- `POST /extract` remains the only submission entrypoint
- terminal success payload must reuse the current extraction payload shape unchanged
- duplicate submit for the same canonical extraction request should return the existing canonical job rather than creating parallel expensive work
- server decides immediately whether work stays inline or becomes a job; there is no mid-request “upgrade” behavior

### Why this direction

- Preserves the current best-case UX for fast invoices.
- Aligns with established async request-reply patterns for document/OCR workloads.
- Decouples user experience from backend tail latency without forcing a larger recovery/resume feature into v1.
- Keeps the first slice narrow enough to ship and validate quickly.

## Technical Considerations

### API Contract Direction

Introduce a durable extraction job abstraction around the existing `POST /extract` entrypoint.

Required headers/semantics:

- `Location` for the status endpoint when returning `202`
- `Retry-After` to guide polling cadence
- clear separation between non-terminal and terminal states
- proxy/dev-proxy compatibility for required async headers and status codes

### Frontend State Direction

Current invoice upload state is modal-local in:

- `src/hooks/useInvoiceFileState.ts`
- `src/hooks/useInvoiceImport.ts`
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/components/invoice/InvoiceUploadStep.tsx`

That state model should expand from:

- `upload | preview | importing | complete`

to a minimal v1 UI model:

- `upload`
- `uploading`
- `processing`
- `preview`
- `importing`
- `failed`

The UI should distinguish:

- upload progress
- backend processing in progress
- terminal failure

Backend sub-status (`queued`, `processing`) should remain protocol-level state, not a large user-facing taxonomy.

### Active Attempt Ownership

The frontend must enforce a hard state invariant:

- only the currently active upload attempt may transition dialog state to `preview`
- completions from superseded, replaced, or cancelled attempts are ignored

This is required to prevent stale async completions from reopening preview for the wrong file.

### Duplicate Submit / Idempotency

Duplicate-submit behavior must be explicit, not best-effort.

The plan requires:

- a canonical server-side dedupe key for extraction jobs
- deterministic behavior when the same extraction request is submitted again while a matching job is already running or already completed
- client behavior that can safely correlate a retry with the canonical existing job

### Error Taxonomy

The async flow needs a machine-readable error model. At minimum, planning and implementation should cover:

- `submit_rejected`
- `job_failed`
- `job_expired`
- `unauthorized`
- `poll_transient`
- `payload_invalid`
- `cancelled_by_user`

Each class should define:

- user-visible behavior
- retry semantics
- logging expectations

### Persistence / Recovery

This is intentionally deferred for v1.

V1 scope:

- poll while the dialog remains open
- stop polling on close/unmount
- do not resume across dialog close or full page refresh yet

Deferred:

- same-session reopen recovery
- cross-refresh persistence
- browser storage of job metadata

### Backward Compatibility

Do not break current preview-pricing/import stages.

The async change should end at the same handoff boundary the current sync extract returns:

- extracted invoice metadata
- extracted rows
- row IDs / weight candidates / barcodes

That keeps existing pricing preview and import behavior mostly unchanged.

## System-Wide Impact

### Interaction Graph

Current chain:

- `InvoiceUploadDialog` -> `useInvoiceImport` -> `useInvoiceFileState` -> `extractInvoiceData()` -> XHR `POST /extract` -> modal waits for final payload -> preview pricing preload -> import actions

Planned chain:

- `InvoiceUploadDialog` -> submit extraction request
- fast path:
  - `200` immediate extracted payload -> existing preview flow
- async path:
  - `202` job envelope -> polling loop while dialog stays open -> terminal success payload -> existing preview flow

This adds one async branch without changing the downstream preview/import branch.

### Error & Failure Propagation

Today:

- timeout, network failure, upstream 5xx, and long-running valid work are too easy to conflate

Needed:

- separate submit-time failures from processing-time failures
- separate local timeout from server-side job failure
- preserve backend failure payloads/status for UI and logs
- expose retryable vs non-retryable states through explicit codes

### State Lifecycle Risks

Key risks to handle explicitly:

- duplicate submissions when user retries after a slow response
- stale polling loops after dialog close/unmount
- job finishes after user started a new upload
- old job result overwrites the active upload attempt

### API Surface Parity

Any invoice extraction entry point should share one small client surface. Avoid split-brain behavior between:

- browser upload path in `src/lib/invoiceOCR.ts`
- future status polling path
- tests that currently mock only one-shot extraction success

### Integration Test Scenarios

Cross-layer scenarios planning must cover:

1. Submit invoice -> backend returns `202` -> client polls -> preview opens successfully.
2. Submit invoice -> user starts a second upload before the first job completes -> old completion is ignored.
3. Submit invoice twice during slow processing -> canonical existing job is reused rather than duplicated.
4. Backend returns terminal failure after several polls -> UI shows actionable error and allows retry.
5. Fast-path invoice still returns immediate preview with no polling regression.

## SpecFlow Analysis

Key gaps and edge cases this feature must close:

- No durable user-visible state between `upload started` and `preview ready`
- No explicit contract for `queued` vs `processing` vs `failed`
- No idempotency story for repeated submit on slow jobs
- No polling backoff / retry guidance
- No explicit stale-result ownership rule for concurrent/replaced uploads
- No observability contract for correlating browser request, job, and backend processing result

These gaps should be reflected in acceptance criteria and work phases, not left implicit.

## Implementation Phases

### Phase 1: Ship one vertical slice

- Lock the exact `POST /extract` and `GET /invoice/extraction-jobs/:jobId` contracts.
- Add backend fast-path vs async routing.
- Add job creation/status retrieval.
- Add frontend polling while the dialog remains open.
- Reuse existing preview/import path unchanged after terminal success.
- Add explicit ownership guard so only the active upload attempt can transition the UI to preview.

Deliverables:

- working end-to-end `200/202 + poll + preview` flow
- exact contract update in app/backend integration docs
- active-attempt guard in frontend state management

### Phase 2: Harden the async path

- Add canonical dedupe behavior for repeated submits of the same extraction request.
- Add explicit error taxonomy and retry semantics.
- Ensure proxy/header compatibility for required async headers/status codes.
- Strengthen logging around `job_id`, terminal status, and total duration.

Deliverables:

- dedupe semantics
- machine-readable failure taxonomy
- proxy-safe async contract

### Phase 3: Optional recovery and richer observability

- Add same-session reopen or cross-refresh resume only if needed after the core flow is stable.
- Add richer observability breakdowns only if simple `job_id + terminal status + duration` logging proves insufficient.

### Phase 4: Validation

- Add tests for fast-path and async-path behavior.
- Add integration coverage for duplicate-submit reuse, stale-result rejection, and terminal failure handling.
- Validate that existing preview-pricing/import flows remain unchanged after extraction completes.

## Acceptance Criteria

### Functional Requirements

- [ ] Users can upload an invoice and receive either an immediate preview or a durable processing state.
- [ ] Slow extraction no longer fails solely because a browser-held request exceeded the current 120s timeout.
- [ ] When backend accepts long-running work, client receives a job identifier and can poll for completion.
- [ ] When extraction completes asynchronously, the existing review/preview table opens with extracted data.
- [ ] UI clearly distinguishes `still processing` from `failed`.
- [ ] Retrying a slow job reuses the canonical existing job rather than creating parallel duplicate work.
- [ ] Only the currently active upload attempt may transition dialog state to `preview`; completions from superseded or cancelled attempts are ignored.

### Non-Functional Requirements

- [ ] Fast invoices still complete through a low-friction path with no noticeable regression.
- [ ] Polling honors backend pacing guidance and avoids aggressive request spam.
- [ ] Observability is sufficient to correlate client submit, `job_id`, terminal status, and total duration.
- [ ] Sensitive document identifiers are not exposed by default in production logs or headers.
- [ ] Required async headers/status codes remain visible through the active proxy/dev-proxy path when used.

### Quality Gates

- [ ] Unit tests cover extraction client branching (`200`, `202`, terminal failure, transient polling failure).
- [ ] Component or hook tests cover active-attempt ownership and stale-update prevention.
- [ ] Integration tests cover async handoff, status polling, and duplicate-submit reuse.
- [ ] Documentation updated for the new contract and operator debugging workflow.

## Success Metrics

- Fewer invoice-import failures caused by frontend timeout.
- Meaningful reduction in support/debug cases where valid invoices are reported as failed while backend eventually succeeds.
- High completion rate for invoices whose backend processing exceeds the former 120s limit.
- Clear separation in logs/metrics between:
  - submit failures
  - processing failures
  - user cancellations
  - successful async completions

## Dependencies & Risks

### Dependencies

- Backend team support for async job contract and job persistence
- Agreement on auth behavior for status polling endpoints

### Risks

- Introducing async state without strict attempt ownership may create stale-preview bugs
- Missing dedupe semantics may create duplicate processing/jobs
- Polling endpoints can add backend load without proper pacing and TTL cleanup

## Alternative Approaches Considered

### 1. Raise the timeout only

Rejected as the primary solution.

Why:

- backend latency already exceeds current timeout on valid work
- a larger timeout merely moves the failure threshold
- keeps users trapped in a modal-bound request model

### 2. Fully async-only extraction

Viable, but not preferred for first step.

Why not first:

- adds product/UI ceremony to every invoice, even fast ones
- hybrid path preserves today’s best-case UX while fixing reliability

## Documentation Plan

Update or create:

- `docs/specs/invoice-import-api-contract.md`
- a focused runbook or troubleshooting note for extraction jobs / status polling
- existing invoice timeout solution docs so they no longer imply size-based XHR timeout is the core reliability strategy

## Sources & References

### Internal References

- `src/lib/invoiceOCR.ts`
- `src/hooks/useInvoiceFileState.ts`
- `src/hooks/useInvoiceImport.ts`
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/components/invoice/InvoiceUploadStep.tsx`
- `docs/specs/invoice-import-api-contract.md`
- `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`
- `docs/solutions/integration-issues/invoice-fastapi-auth-cors-multipart-InvoiceOCR-20260217.md`
- `docs/solutions/integration-issues/missing-extract-cache-headers-InvoiceOCR-20260213.md`

### External References

- Azure async request-reply pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply
- AWS Textract async processing: https://docs.aws.amazon.com/textract/latest/dg/api-async.html
- Google Document AI long-running operations: https://docs.cloud.google.com/document-ai/docs/long-running-operations

## Recommended Next Step

Use this plan as the basis for implementation in one narrow vertical slice:

1. exact `200/202` submit contract
2. job status endpoint
3. dialog polling while open
4. active-attempt guard
5. preview reuse after success
