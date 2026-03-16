---
status: pending
priority: p1
issue_id: "098"
tags: [code-review, architecture, whatsapp]
dependencies: []
---

## Problem Statement

`getListPickerContentSid` in `lib/whatsapp/content-templates.ts` uses an in-memory `sidCache = new Map<number, string>()`. In a serverless environment every cold start or process restart drops the cache. Because `friendly_name` embeds `Date.now()`, each restart creates brand-new Twilio Content resources (up to 10 per restart, one per `itemCount` variant). There is no cleanup mechanism, so orphaned Content resources accumulate in the Twilio account indefinitely, consuming quota and eventually hitting Twilio's Content resource limits.

## Findings

- `sidCache` is module-level in `lib/whatsapp/content-templates.ts` and does not survive process restarts.
- `friendly_name` pattern includes a timestamp, so duplicate names are never detected — each call creates a fresh resource.
- No TTL, no eviction, no Twilio Content resource cleanup path exists anywhere in the codebase.
- Vercel/serverless deployments restart frequently; every new deployment or idle-timeout cold start triggers recreation.
- Twilio imposes limits on the number of Content resources per account; unchecked growth will eventually cause creation failures in production.

## Proposed Solutions

### Option 1: Persist SID mapping in Supabase (or another durable store)
Store `{ item_count, content_sid, created_at }` in a dedicated Supabase table. On startup, hydrate the in-process cache from the DB. Create a new Twilio resource only if no row exists for the given `itemCount`.

**Pros:** Survives restarts, single source of truth, easy to query/audit, no Twilio quota bleed.
**Cons:** Adds a DB read on the hot path (can be mitigated with in-process cache as L1).
**Effort:** Medium
**Risk:** Low

### Option 2: Look up existing Content resources by stable `friendly_name` before creating
Use a deterministic, timestamp-free `friendly_name` (e.g. `inventory-list-picker-{itemCount}`). Before creating, call `GET /v1/Services/content` and search for an existing resource with that name. Reuse it if found.

**Pros:** No external dependency, self-healing, works across processes.
**Cons:** Twilio list API may be slow or paginated; adds latency. Name collision possible if schema changes.
**Effort:** Small
**Risk:** Medium

### Option 3: Periodic cleanup cron + stable naming (combined)
Use stable `friendly_name` (Option 2) plus a scheduled job (Vercel Cron or Supabase scheduled function) that purges Content resources older than N days that are no longer actively used.

**Pros:** Keeps Twilio account tidy long-term.
**Cons:** More moving parts; cleanup job itself needs care to avoid deleting active resources.
**Effort:** Large
**Risk:** Medium

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/content-templates.ts`
- Components: `getListPickerContentSid`, `sidCache`

## Acceptance Criteria
- [ ] Twilio Content resources for a given `itemCount` are created at most once across process restarts
- [ ] No orphaned Content resources accumulate after repeated cold starts
- [ ] Cache hydration on cold start adds < 200 ms to first-request latency (or is done lazily)
- [ ] Existing tests continue to pass; new test covers cold-start reuse behaviour

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
