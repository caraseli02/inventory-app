---
module: WhatsAppAgent
date: 2026-03-17
problem_type: integration_issue
component: server_component
symptoms:
  - "Twilio error 21656 at send time even after switching to dynamic Content API template creation"
  - "Dynamic list-picker templates created successfully (200 OK from Content API) but rejected at send time"
  - "Error occurs for all item counts, including the exact count the template was built for"
root_cause: wrong_api_usage
resolution_type: code_fix
severity: high
tags: [twilio, whatsapp, list-picker, content-api, error-21656, template-variables, dynamic-template, stale-cache]
related_github_issue: null
commit: b2be189
---

# Problem Description

After implementing dynamic Twilio Content API template creation (one template per item count, to fix the earlier 21656 issue with padding), the 21656 error persisted. Dynamic templates were being created successfully — a `200 OK` from `POST /v1/Content` was confirmed — but every send still failed with error 21656.

The root cause was in `buildListPickerPayload`: it set `variables: {}` (empty object) in the Content API body, but the template `body` fields used `{{1}}`, `{{2}}`, etc. as placeholders. Twilio's Content API requires that every `{{N}}` placeholder in the template body be declared in the `variables` object at template-creation time. Sending correct `ContentVariables` at message-send time is not sufficient — the validation is against the declared variables on the template resource itself.

Additionally, stale templates from before the fix (which had the same friendly name) were reused from the in-memory cache and from the Content API lookup, meaning new deploys still used bad templates until the friendly name was version-bumped.

# Symptoms

- `POST /v1/Content` returns 200 (template created) but `POST /Messages` returns 400 with code 21656
- All dynamic list-picker sends fail regardless of item count
- No error in the template creation step — the failure is invisible until send time
- Twilio error message: "ContentVariables parameter is invalid"

# Root Cause Analysis

`lib/whatsapp/content-templates.ts` — `buildListPickerPayload` was creating Content resources with:

```typescript
// ❌ BEFORE — variables declared as empty even though body uses {{1}}..{{N}}
const payload = {
  friendly_name: friendlyName,
  language: 'ro',
  variables: {},   // ← empty — Twilio sees "no declared variables"
  types: {
    'twilio/list-picker': {
      body: 'Selectează produsul / Choose product',
      items: items.map((label, i) => ({
        item: `{{${i + 1}}} `,   // ← references {{1}}, {{2}}, etc.
        id: `product_${i + 1}`,
      })),
    },
  },
};
```

Twilio validates `ContentVariables` against the `variables` map declared on the Content resource. If `variables: {}`, then `ContentVariables: {"1": "Lapte", "2": "Brânza"}` is rejected because `"1"` and `"2"` were not declared as valid variable names.

The stale-template problem: the in-memory `sidCache` (a module-level `Map`) persisted bad SIDs across requests within the same warm Vercel instance. The `findExistingContentSid` lookup found the bad template by friendly name and returned the cached SID. New deploys cleared the in-process cache but found the old resource via the Content API. Version-bumping the friendly name (e.g., `dynamic_list_picker_v2_N`) bypassed the stale lookup.

# Solution

1. Populate `variables` to match the item count, with placeholder descriptions:

```typescript
// ✅ AFTER — variables declared to match {{1}}..{{N}}
const variables: Record<string, string> = {};
for (let i = 1; i <= count; i++) {
  variables[String(i)] = `Product ${i}`;
}

const payload = {
  friendly_name: friendlyName,
  language: 'ro',
  variables,  // ← now {"1": "Product 1", "2": "Product 2", ...}
  types: {
    'twilio/list-picker': {
      body: 'Selectează produsul / Choose product',
      items: items.map((label, i) => ({
        item: `{{${i + 1}}}`,   // ← trailing space removed too
        id: `product_${i + 1}`,
      })),
    },
  },
};
```

2. Version-bump the friendly name to force fresh template creation and bypass stale lookups:

```typescript
// v1: 'dynamic_list_picker_N'  ← broken, still in Twilio account
// v2: 'dynamic_list_picker_v2_N'  ← fresh, correct variables
const friendlyName = `dynamic_list_picker_v2_${count}`;
```

# Files Changed

- `lib/whatsapp/content-templates.ts` (buildListPickerPayload — variables declaration + friendly name)

# Prevention

- [ ] When creating any Twilio Content API resource programmatically: every `{{N}}` in every field of `types.*` must be declared in the top-level `variables` object.
- [ ] After changing template structure: always version-bump the friendly name — the `sidCache` and `findExistingContentSid` will find stale resources by name otherwise.
- [ ] `pnpm whatsapp:replay --fixture dynamic-list-picker` covers this — run it after any content-template changes.

## See Also

- [dynamic-list-picker-content-api-any-item-count-WhatsAppAgent-20260316.md](./dynamic-list-picker-content-api-any-item-count-WhatsAppAgent-20260316.md) — earlier fix: creating templates per item count instead of padding to 6
