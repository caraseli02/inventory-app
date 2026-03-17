---
name: Content API findExistingContentSid only fetches first 50 resources — misses existing templates
description: content-templates.ts:72 fetches PageSize=50 with no pagination; accounts with >50 Content resources always create duplicate dynamic_list_picker_v2_N templates
type: pending
priority: p2
issue_id: "123"
tags: [whatsapp, twilio, content-templates, performance]
dependencies: []
---

## Problem Statement

`content-templates.ts:72`:

```ts
const url = `${CONTENT_API_BASE}?PageSize=50`;
```

`findExistingContentSid` fetches only the first 50 Content resources and does not follow pagination (`meta.next_page_url`). If the Twilio account accumulates more than 50 Content resources, the target `dynamic_list_picker_v2_N` friendly name may be on page 2+ and will be missed. This triggers a new `POST /v1/Content` on every cold start for each missing item count, accumulating duplicate resources and defeating the idempotency goal of version-bumping the friendly name.

This is already a time-bomb: every new deployment creates a cold start, and at scale the account will exceed 50 resources quickly.

## Proposed Solutions

### Option A — Paginate with next_page_url (Recommended short-term)
Follow `meta.next_page_url` in a loop until the friendly name is found or pages are exhausted.

**Pros:** Correct behavior at any account size
**Cons:** Multiple HTTP round trips on cold start cache miss
**Effort:** Small
**Risk:** Low

### Option B — Filter by FriendlyName prefix at API level
If Twilio Content API supports `FriendlyName=` query param, fetch only the matching resource.

**Pros:** Single HTTP call regardless of account size
**Cons:** Need to verify API supports this filter
**Effort:** Small
**Risk:** Low

### Option C — Persist SIDs to Supabase as fallback (Best long-term)
After creating a template, store the SID in a `whatsapp_content_sids` table keyed by `friendly_name`. Cold starts read from DB first; Twilio API is only the fallback.

**Pros:** Eliminates the cold-start Twilio API round trip entirely; survives account growth
**Cons:** Requires DB table/migration
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A now (correct behavior), Option C as the long-term fix.

## Technical Details

- **Affected files:** `lib/whatsapp/content-templates.ts:72`

## Acceptance Criteria

- [ ] `findExistingContentSid` does not miss resources when account has >50 Content resources
- [ ] No duplicate `dynamic_list_picker_v2_N` templates created across cold starts
- [ ] Test: mock returns 50 resources on page 1, target on page 2 — found correctly

## Work Log

- 2026-03-17: Identified by architecture-strategist, performance-oracle, typescript-reviewer review of PR #171
