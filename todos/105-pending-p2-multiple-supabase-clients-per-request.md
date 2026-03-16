---
status: pending
priority: p2
issue_id: "105"
tags: [code-review, performance, whatsapp]
dependencies: []
---

## Problem Statement

A single webhook invocation can call `createSupabaseClient()` three or more times — once inside each of `handleButtonPayload`, `handlePendingTextDecision`, and `handleRestConversation`. In a serverless environment each call instantiates a new client object and opens a new connection, adding unnecessary latency and potentially exhausting the Supabase connection pool under concurrent load.

## Findings

Inside `api/whatsapp.ts` (the webhook handler), the execution path for a typical inbound message calls multiple sub-handlers sequentially. Each sub-handler independently calls `createSupabaseClient()` at its top:

- `handleButtonPayload` — line 148
- `handlePendingTextDecision` — line 77
- `handleRestConversation` — line 352

All three operate on the same logical request and the same Supabase project. There is no reason to create more than one client per request.

## Proposed Solutions

### Option 1: Create client once at the top of `webhookHandler`, pass down as argument
Instantiate `createSupabaseClient()` at the entry point of `webhookHandler` and thread the resulting `client` through to every sub-handler via a parameter.

**Pros:** Single connection per request; minimal code change; explicit data flow makes testing easier (client can be injected as a mock).
**Cons:** All sub-handler signatures gain a `client` parameter — minor churn.
**Effort:** Small
**Risk:** Low

### Option 2: Module-level singleton (lazy-initialized)
Cache the client in a module-level variable, initializing it on first call. Subsequent calls within the same serverless instance reuse it.

**Pros:** No signature changes needed.
**Cons:** Shared state across requests on warm instances; harder to test (requires resetting module state); may cause subtle bugs if credentials change between invocations.
**Effort:** Small
**Risk:** Medium

### Option 3: Request-scoped context object
Wrap all per-request dependencies (Supabase client, logger, phone number) in a `RequestContext` object created once in `webhookHandler` and passed to all sub-handlers.

**Pros:** Scales well as more shared dependencies emerge; clean separation of concerns.
**Cons:** More refactoring than Option 1; increases PR size.
**Effort:** Medium
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `api/whatsapp.ts` (webhook handler), `lib/whatsapp/webhook.ts`
- Repeated call site lines: ~148, ~77, ~352 (subject to change as branch evolves)

## Acceptance Criteria
- [ ] `createSupabaseClient()` is called at most once per webhook invocation
- [ ] All sub-handlers receive the client via parameter or context rather than constructing their own
- [ ] No regression in existing integration tests (`tests/integration/whatsapp-agent.test.ts`)
- [ ] TypeScript types for sub-handler signatures updated accordingly

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
