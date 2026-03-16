---
status: pending
priority: p1
issue_id: "099"
tags: [code-review, architecture, whatsapp, concurrency]
dependencies: ["098"]
---

## Problem Statement

`getListPickerContentSid` in `lib/whatsapp/content-templates.ts` caches the resolved Content SID value, not the in-flight Promise. Two concurrent requests arriving for the same `itemCount` before the first Twilio API call resolves will both find the cache empty, both create a new Content resource, and both write their own SID back to the cache — with the last write winning. The losing SID is then orphaned in Twilio. In a serverless environment with multiple concurrent Lambda/Edge invocations this race is practically guaranteed under any non-trivial load.

## Findings

- `sidCache.get(itemCount)` is checked synchronously, but the Twilio create call is async; there is no lock or Promise placeholder between check and fill.
- Both concurrent callers pass the `has()` guard and proceed to `createListPickerContent()`, producing two distinct resources with two distinct `Date.now()` timestamps.
- The cache is then written by both callers; one SID is silently abandoned.
- This compounds the resource-leak issue tracked in #098: the race multiplies orphaned resources by the degree of concurrency.
- Pattern is a classic TOCTOU (time-of-check / time-of-use) bug in async cache code.

## Proposed Solutions

### Option 1: Cache the Promise (promise-dedup pattern)
Replace `Map<number, string>` with `Map<number, Promise<string>>`. On cache miss, create the Promise immediately (before the await), store it in the map, then await it. All concurrent callers for the same key get the same Promise and wait on the single in-flight Twilio request.

```typescript
const sidCache = new Map<number, Promise<string>>();

async function getListPickerContentSid(itemCount: number): Promise<string> {
  if (!sidCache.has(itemCount)) {
    sidCache.set(itemCount, createListPickerContent(itemCount));
  }
  return sidCache.get(itemCount)!;
}
```

**Pros:** Zero extra I/O, minimal code change, standard pattern, eliminates the race completely within a single process.
**Cons:** Does not help across separate serverless instances (that is the concern of #098). Rejected Promises stay cached — need error-path eviction.
**Effort:** Small
**Risk:** Low

### Option 2: Distributed lock via Supabase / Redis
Acquire a named lock (e.g. `content-sid-lock-{itemCount}`) in a shared store before calling Twilio. Only the lock holder creates the resource; others wait and then read the stored SID.

**Pros:** Works across multiple serverless instances.
**Cons:** Significant complexity, new infrastructure dependency, lock TTL/expiry management required.
**Effort:** Large
**Risk:** Medium

### Option 3: Idempotent creation with stable naming + lookup-before-create (combined with #098 Option 2)
Use a deterministic `friendly_name` and always attempt a GET before POST. Twilio will return the existing resource if it already exists. This makes concurrent creates safe at the Twilio level even without a local lock.

**Pros:** Solves both #098 and #099 in one change, no shared-lock infrastructure needed.
**Cons:** Two Twilio API calls on cache miss; GET must handle pagination.
**Effort:** Medium
**Risk:** Medium

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/content-templates.ts`
- Components: `getListPickerContentSid`, `sidCache`

## Acceptance Criteria
- [ ] Concurrent calls for the same `itemCount` result in exactly one Twilio Content resource created
- [ ] Promise rejection on the Twilio call is evicted from the cache so the next attempt retries
- [ ] Unit test covers simultaneous calls (e.g. `Promise.all([fn(6), fn(6)])`) and asserts single creation
- [ ] No regression on existing cache-hit path

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
