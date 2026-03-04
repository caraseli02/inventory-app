---
title: "feat: Close WhatsApp agent gaps (tracker, realtime, config, hardening)"
type: feat
date: 2026-03-04
origin:
  - docs/specs/whatsapp_agent.md
  - claude-progress.md
  - feature_list.json
---

# feat: Close WhatsApp agent gaps (tracker, realtime, config, hardening)

## Overview

Close the remaining WhatsApp Agent (F030) gaps called out in docs/progress:

- P0: tracker integrity (F030 incorrectly stored under `_deprecated_known_bugs`)
- P1: user-visible improvements (#120 realtime OrdersPage, #122 store info config)
- P2: security/perf/quality/UX (#125 Twilio signature validation, #126 prompt+payload optimization, #127 conversation TTL, #128 out-of-stock alternatives)

## Problem Statement / Motivation

Current state works end-to-end (webhook → order created → owner confirm/cancel → customer notified), but:

- Tracking is inconsistent (F030 not in `features[]`), which breaks reporting/tooling trust.
- OrdersPage is “pull-based” (React Query refetch) instead of realtime.
- Store info is operationally incomplete (production env vars not finalized).
- Webhook hardening is missing (no Twilio signature verification) and is heavier than needed (inventory text built from up to 200 products + all stock movements each request).
- Conversation context has message-count cap but no time-based expiry policy.
- Out-of-stock UX asks for “alternatives” but no concrete suggestion logic exists.

## Research Summary

### Internal references

- Tracker issue (F030 under deprecated list):
  - `feature_list.json` (`metadata.total_features` is 29 but claude-progress assumes 30)
  - F030 object currently lives under `_deprecated_known_bugs` and includes open items #120/#122
- Orders realtime prerequisites:
  - `supabase/migrations/20260220000000_create_orders_tables.sql` already adds `orders` to `supabase_realtime` publication
  - `src/pages/OrdersPage.tsx` currently relies on `useQuery` + invalidation/refetch
  - `src/lib/supabase.ts` exports browser Supabase client (supabase-js v2)
- Store config placeholders:
  - `api/whatsapp.ts` uses `(adresă neconfigurată)` / `(program neconfigurat)` fallbacks
  - `api/whatsapp-notify.ts` uses STORE_NAME/STORE_PHONE in customer messages
- Webhook inventory payload:
  - `api/whatsapp.ts:getInventorySummary()` selects `products.limit(200)` and selects all `stock_movements` rows (no limit)
- Conversation history:
  - `api/whatsapp.ts` stores `conversation_history.messages` and truncates to last 20 messages (no TTL)

### External references (for implementation)

- Twilio request validation: X-Twilio-Signature verification using auth token + request URL + params (Twilio docs / helper libs).
- Supabase Realtime client pattern: `supabase.channel(...).on('postgres_changes', ...)` for INSERT/UPDATE/DELETE events (supabase-js v2 docs).

## Scope / Work Breakdown

### P0 — Tracker integrity (do first)

#### Goal

Make F030 show up in `feature_list.json.features[]` so counters + tooling reflect reality.

#### Tasks

- Move the full F030 entry from `feature_list.json._deprecated_known_bugs[]` into `feature_list.json.features[]`.
  - Keep the entry as-is (same steps + scenarios) except for placement.
  - Keep BUG-001 in `_deprecated_known_bugs`.
- Update `feature_list.json.metadata` to match the new structure:
  - `total_features` should reflect the real count in `features[]` after the move.
  - Recompute `implemented` and `tested` counts based on `features[]`.
  - Keep the “ONLY modify implemented/tested booleans” warning text, but treat this move as a one-time repair for integrity.
- Align “progress” docs:
  - `claude-progress.md`: update metrics (total/implemented/tested) + mark #121 as done if it is done (see Status note below).
  - `docs/specs/whatsapp_agent.md`: ensure the “Remaining (GitHub Issues)” section reflects current truth (#121 done).

#### Acceptance criteria

- F030 appears under `features[]` and is included in the top-level counters.
- `feature_list.json.metadata.total_features` matches the length of `features[]`.
- `claude-progress.md` and `docs/specs/whatsapp_agent.md` no longer contradict tracker status for #121.

---

### P1 — Finish user-visible functionality

#### #120 — Realtime updates on OrdersPage

##### Goal

OrdersPage updates without refresh:

- New orders appear automatically.
- Confirm/cancel status changes reflect automatically.
- Pending count updates automatically.

##### Proposed approach

- In `src/pages/OrdersPage.tsx`, add a Supabase Realtime subscription to `public.orders` via `supabase.channel(...)`.
- On any `postgres_changes` event for `orders` (INSERT/UPDATE/DELETE):
  - Invalidate all order-related queries (prefix `['orders']`) so existing query logic refetches.
  - Keep this minimal first (invalidate), then optionally optimize later (patch cache with payload).
- Ensure:
  - Subscription is created once on mount.
  - Subscription is cleaned up on unmount.
  - Realtime failure is non-fatal (fallback is current polling/refetch behavior).

##### Acceptance criteria

- Given owner is on OrdersPage, when a new row is inserted into `orders`, then UI shows it without manual refresh.
- Given owner is on OrdersPage, when an order status changes, then UI reflects the new status without refresh.
- Given there are pending orders, title badge count updates in realtime.

##### Testing

- Minimal: manual verification by inserting an order (via webhook or direct DB insert) while OrdersPage is open.
- Preferred: Playwright flow that:
  - Opens OrdersPage
  - Triggers order creation (test helper / direct Supabase insert)
  - Asserts the new order card appears without navigation/reload

---

#### #122 — Store info config (operational)

##### Goal

Production is configured so the agent never replies with placeholders like `(adresă neconfigurată)` / `(program neconfigurat)`.

##### Tasks

- Finalize Vercel environment variables:
  - `STORE_NAME`
  - `STORE_ADDRESS`
  - `STORE_HOURS`
  - `STORE_PHONE` (optional but recommended)
- Add a short runbook doc update (either `docs/specs/whatsapp_agent.md` or a new `docs/runbooks/whatsapp_agent.md`):
  - Where to set env vars in Vercel
  - Required redeploy behavior
  - “Verification checklist” (see below)

##### Verification checklist (manual)

- Send: “Care e adresa?” → response includes configured address.
- Send: “Care e programul?” → response includes configured hours.
- Create an order; confirm/cancel; customer receives message with correct store name/phone where applicable.

##### Acceptance criteria

- No customer-facing message includes store placeholders.
- Store name/address/hours match the runbook values.

---

### P2 — Security / perf / quality / UX hardening

#### #125 — Twilio signature validation (inbound webhook)

##### Goal

Reject forged webhook calls to `POST /api/whatsapp`.

##### Tasks

- Implement request verification using:
  - `X-Twilio-Signature` header
  - `TWILIO_AUTH_TOKEN`
  - The exact request URL Twilio used (protocol + host + path)
  - The request params (Twilio sends `application/x-www-form-urlencoded`)
- Fail closed:
  - Missing/invalid signature → `403` (and do not call Anthropic or Supabase).
- Be careful about URL reconstruction on Vercel:
  - Use `x-forwarded-proto` + `host` to rebuild absolute URL.
  - Ensure path matches `/api/whatsapp` exactly.

##### Acceptance criteria

- Valid Twilio request passes verification.
- Same payload with modified `Body` fails verification.
- Requests without signature are rejected.

##### Testing

- Unit tests for a pure `validateTwilioSignature({ url, params, signature, authToken })` helper.
- Optional: integration test with a recorded Twilio webhook sample.

---

#### #126 — Prompt payload + performance optimization

##### Goal

Reduce per-webhook latency + prompt tokens by avoiding “full inventory dump” every request.

##### Current bottleneck

- `api/whatsapp.ts:getInventorySummary()`:
  - `products.limit(200)` every request
  - `stock_movements` fetch with no limit every request
  - Builds a long bullet list with IDs

##### Proposed strategy (phased)

**Phase A (fast win, minimal risk)**

- Limit inventory context size:
  - Remove internal `[id:...]` from the prompt unless strictly needed.
  - Include only fields needed for Q&A: `name`, `category`, `price`, `current_stock`.
- Prefer aggregated stock:
  - Query a stock view if available (`product_stock`) or fetch/compute stock only for the subset of products being included.

**Phase B (targeted retrieval)**

- Detect intent from inbound text (simple heuristic first):
  - If user asks about a product name, fetch only top-N matching products (`ilike` on `products.name`) and their stock.
  - If user asks about store hours/address, skip inventory fetch entirely.
  - If user asks “what do you have / list products”, return a short curated list (e.g., by category or most-recently-updated) instead of 200 items.

**Phase C (cache)**

- Cache an “inventory digest” for broad questions:
  - Store in a small Supabase table (or KV) with a timestamp + hash.
  - Refresh on interval or on stock change (later: DB trigger / realtime listener on server side).

##### Acceptance criteria

- Typical “hours/address” messages do not query products/movements.
- Typical “do you have X?” queries fetch only a small subset (target: ≤ 20 products).
- P95 webhook response time improves (track via serverless logs).

---

#### #127 — Conversation history TTL / expiry

##### Goal

Define and enforce a time-based retention policy for `conversation_history`.

##### Proposed policy

- TTL: choose 7 days (default) or 24 hours (more privacy-friendly).
- Keep existing “last 20 messages” cap as the second guardrail.

##### Implementation options

- **On-read cleanup**: if `updated_at < now - TTL`, treat as empty history and overwrite on next write.
- **Scheduled cleanup**: add a Vercel Cron job that deletes rows older than TTL (recommended for hygiene).

##### Acceptance criteria

- Conversation context older than TTL is not used for replies.
- Table size does not grow unbounded over time.

---

#### #128 — Out-of-stock alternative suggestions

##### Goal

When a queried item is out of stock, suggest in-stock alternatives (2–3) that are likely relevant.

##### Proposed approach (minimal viable)

- Ensure inventory context includes `category` for candidate products.
- When responding about an unavailable product:
  - Suggest 2–3 in-stock items from the same category (or name-similar fallback).
- Keep it safe:
  - Only suggest products present in live inventory context.
  - Don’t suggest out-of-stock items.

##### Acceptance criteria

- Given an out-of-stock product query, reply includes:
  - Unavailable statement
  - 2–3 in-stock alternatives (name + price)
  - Same language as customer (existing rule)

## Status note: #121

Current code indicates #121 is implemented:

- `src/pages/OrdersPage.tsx` calls `POST /api/whatsapp-notify` on confirm/cancel.
- `api/whatsapp-notify.ts` sends WhatsApp messages via Twilio REST API.

Plan assumes #121 stays “done” and only tracker/docs are updated to reflect it consistently.

## Dependencies & Risks

- Supabase Realtime + RLS:
  - If RLS blocks realtime event delivery for anon key, subscription may not receive events. Validate Supabase policies for `orders`.
- Twilio signature verification:
  - URL reconstruction must exactly match Twilio’s signed URL; proxies/rewrites can break verification.
- Perf optimizations:
  - Must not regress correctness (never claim stock without checking live data).

## Rollout Plan

1. P0 tracker integrity + doc alignment (prevents drift).
2. #120 realtime subscription (visible UX win).
3. #122 env config runbook + production verification.
4. #125 signature validation (security hardening).
5. #126 prompt/payload optimization (perf).
6. #127 TTL policy.
7. #128 alternatives.

## Success Metrics

- Owner reports “OrdersPage updates instantly” (no refresh).
- Store info in replies is always correct (no placeholders).
- Webhook rejects invalid signatures and reduces average latency after optimization.

