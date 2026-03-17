---
module: WhatsAppAgent
date: 2026-03-16
problem_type: integration_issue
component: server_component
symptoms:
  - "Twilio error 21656 (ContentVariables parameter is invalid) when category/product list has fewer than 6 items"
  - "Padding empty slots with '-' or '—' triggers ContentVariables rejection"
  - "Templates only rendered for exactly 6-item lists; all other counts fell back to plain text"
root_cause: wrong_api_usage
resolution_type: code_fix
severity: high
tags: [twilio, whatsapp, list-picker, content-api, dynamic-template, error-21656, caching, race-condition]
related_github_issue: null
commit: null
---

# Problem Description

WhatsApp list-picker templates only worked when there were exactly 6 items because the static Twilio Content resource had exactly 6 variable slots (`{{1}}`–`{{6}}`). When categories or products returned fewer items, the code padded missing slots with `-`, causing Twilio error 21656 ("ContentVariables parameter is invalid"). This meant templates were effectively disabled for the most common case (< 6 items).

Additionally, the original attempt to fix this with padding values was rejected because Twilio validates that list-picker item title values are non-trivial.

# Symptoms

- `Error 21656` in Vercel logs on category or product list-picker sends
- Log shows `product_5` and `product_6` variables set to `"-"` or `"—"`
- WhatsApp users see plain text product lists instead of interactive list-picker UI
- Templates work in manual tests with exactly 6 items but fail in real usage

# Root Cause Analysis

The Twilio `twilio/list-picker` Content resource has a fixed number of variable slots defined at creation time. Sending a `ContentVariables` map with more or fewer keys than the template's slot count causes error 21656. Padding with empty/placeholder strings is also rejected — Twilio validates that item title values are meaningful.

```typescript
// ❌ BEFORE — static 6-slot template, pads missing items with placeholder
for (let i = 0; i < 6; i++) {
  vars[String(i + 1)] = items[i] || '-';  // '-' triggers error 21656
}
await sendTemplateMessage(to, STATIC_SID, vars);
```

Additionally, the original implementation used `Date.now()` in the `friendly_name`, causing each cold start to create new orphaned Content resources, and had no protection against concurrent requests creating duplicates.

# Solution

Create Twilio Content resources dynamically via the Content API with exactly the number of item slots needed. Use a deterministic `friendly_name` to prevent accumulation, look up existing resources before creating, and deduplicate concurrent requests with a Promise cache.

**Step 1: Deterministic naming to prevent resource accumulation**

```typescript
// ✅ AFTER — friendly_name keyed only by item count (no timestamp)
function friendlyName(itemCount: number): string {
  return `dynamic_list_picker_${itemCount}`;
}
```

**Step 2: Lookup-before-create to survive cold starts**

```typescript
// ✅ Search for existing resource before creating a new one
async function findExistingContentSid(auth: string, itemCount: number): Promise<string | null> {
  const resp = await fetch(`${CONTENT_API_BASE}?PageSize=50`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!resp.ok) return null;
  const data = await resp.json() as ContentListResponse;
  const match = data.contents?.find((c) => c.friendly_name === friendlyName(itemCount));
  return match?.sid ?? null;
}
```

**Step 3: Promise-dedup to prevent concurrent duplicate creates**

```typescript
// ✅ Cache the Promise, not just the resolved value
const inflight = new Map<number, Promise<string | null>>();

export function getListPickerContentSid(itemCount: number): Promise<string | null> {
  if (itemCount < 1 || itemCount > 10) return Promise.resolve(null);
  const cached = sidCache.get(itemCount);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(itemCount);
  if (existing) return existing;  // return same Promise to concurrent callers
  const promise = resolveContentSid(itemCount).finally(() => inflight.delete(itemCount));
  inflight.set(itemCount, promise);
  return promise;
}
```

**Step 4: Transport layer selects static vs dynamic SID**

```typescript
// ✅ Static SID for 6 items, dynamic for all other counts 1-10
export async function sendListPickerTemplate(
  to: string, contentSid: string, _title: string, items: string[]
): Promise<void> {
  const count = items.length;
  let sid = count === 6 ? contentSid : await getListPickerContentSid(count);
  if (!sid) sid = contentSid;  // fallback to static if dynamic creation failed
  const isStaticTemplate = sid === contentSid;
  const slotCount = isStaticTemplate ? 6 : count;
  const variables: Record<string, string> = {};
  for (let i = 0; i < slotCount; i++) {
    const raw = items[i] || '-';
    variables[String(i + 1)] = raw.length > MAX_LIST_ITEM_TITLE_LEN
      ? raw.slice(0, MAX_LIST_ITEM_TITLE_LEN - 1) + '…' : raw;
  }
  return sendTemplateMessage(to, sid, variables);
}
```

**Critical Content resource format** (must match exactly or error 21656):

```typescript
// ✅ Correct format — trailing space in item text, empty description, empty variables object
{
  friendly_name: 'dynamic_list_picker_4',
  language: 'ro',
  variables: {},                          // must be empty object, NOT keyed
  types: {
    'twilio/list-picker': {
      body: 'Am găsit mai multe produse. Care anume?',
      button: 'Selectează o opțiune',
      items: [
        { item: '{{1}} ', id: 'product_1', description: '' },  // trailing space required
        { item: '{{2}} ', id: 'product_2', description: '' },
        // ...
      ],
    },
  },
}
```

**WhatsApp item title limit:** Item variable values must be ≤ 24 characters. Truncate with ellipsis before sending.

# Files Changed

- `lib/whatsapp/content-templates.ts` — new module: deterministic naming, lookup-before-create, Promise dedup
- `lib/whatsapp/transport.ts` — `sendListPickerTemplate`: dynamic SID selection, 24-char truncation
- `lib/whatsapp/selection-resolver.ts` — removed 6-item minimum guard; templates now sent for any count
- `scripts/test-twilio-full-flow.ts` — added `--dry-run` mode: validates structure without sending messages

# Prevention

- [ ] Never pad list-picker variables with placeholder values — create a template with the exact slot count
- [ ] Never store external API resource IDs only in process memory; always include a remote lookup path
- [ ] Use deterministic resource names (not timestamp-based) to enable idempotent create
- [ ] Deduplicate concurrent async operations with a Promise cache, not just a value cache
- [ ] Validate 24-char limit on list-picker item titles before sending; truncate with `…` if needed
- [ ] Use `--dry-run` mode in `test-twilio-full-flow.ts` to validate template structure without consuming sandbox message quota

## Related Solutions

- [`docs/solutions/logic-errors/whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md`](../logic-errors/whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md) — previous error 21656 fix (numeric vs `product_N` key naming)

## See Also
- [twilio-21656-undeclared-variables-dynamic-template-WhatsAppAgent-20260317.md](./twilio-21656-undeclared-variables-dynamic-template-WhatsAppAgent-20260317.md) — follow-up: dynamic templates created with `variables: {}` also trigger 21656; must declare each `{{N}}` in the variables object at creation time
