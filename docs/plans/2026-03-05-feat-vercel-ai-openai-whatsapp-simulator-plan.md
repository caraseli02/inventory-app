---
title: "feat: Local WhatsApp simulator with Vercel AI + OpenAI (no production changes)"
type: feat
date: 2026-03-05
origin:
  - docs/brainstorms/2026-03-05-vercel-ai-openai-whatsapp-brainstorm.md
  - api/whatsapp.ts
  - api/whatsapp-simulate.ts
  - src/pages/WhatsAppSimulatorPage.tsx
---

# feat: Local WhatsApp simulator with Vercel AI + OpenAI (no production changes)

## Overview

Add a local-first LLM call path using Vercel AI SDK + OpenAI for the existing simulator so we can debug the order agent without sending real WhatsApp messages.

Explicit non-goal: change production webhook behavior (`POST /api/whatsapp`) in this iteration.

## Problem / Motivation

- We want a fast, cheap LLM path (OpenAI) and standard “chat plumbing” (Vercel AI SDK).
- Simulator must be usable for multi-turn debugging (not just “last reply”).

## Proposed Solution (High-level)

1) Keep `POST /api/whatsapp` untouched.
2) Introduce a new “vercel-ai” reply builder (for simulator):
   - Inputs: `phone`, `name`, `text`, `inventoryText`, `history`, `systemPrompt`
   - Output: assistant reply text (plain text, no markdown, includes optional `ORDER:{...}` suffix).
3) Update simulator endpoint to call the new path by default (OpenAI primary).
4) Optional fallback: if OpenAI fails and `ANTHROPIC_API_KEY` exists, use Anthropic.

## Technical Considerations

- Runtime: Vercel serverless (`api/*`), ESM (`type: module`).
- Security:
  - Keep Twilio signature validation as the first step (no LLM call before validate). See `docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`.
  - Keep simulator auth (`x-notify-secret`) unchanged.
- Latency target: WhatsApp replies under ~5s (`docs/specs/whatsapp_agent.md`).
- Cost: default to a “cheap” OpenAI model; keep `max_tokens` bounded.
- Determinism:
  - No streaming needed (Twilio requires a single TwiML response; simulator shows last reply).
  - Preserve existing heuristics: store-info fast-path, inventory summary injection, `ORDER:{...}` parsing + order creation.

## Configuration / Env

Add server env vars:
- `OPENAI_API_KEY` (required for new path).
- `ANTHROPIC_API_KEY` (fallback; optional but recommended).
- `WHATSAPP_OPENAI_MODEL` (default: cheap model; set in env).
- `WHATSAPP_ANTHROPIC_MODEL` (fallback model; set in env).

Update docs:
- `.env.example` (add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, model vars).
- `docs/runbooks/whatsapp_agent.md` (document simulator key + how to verify locally).

## Work Breakdown

### 1) Dependencies

- Add Vercel AI SDK + providers:
  - `ai`
  - `@ai-sdk/openai`
  - (optional if we migrate fallback too) `@ai-sdk/anthropic`

Reference examples:
- `generateText` + OpenAI provider (`openai(...)`): Vercel AI SDK docs
- `generateText` + Anthropic provider (`anthropic(...)`): Vercel AI SDK docs

### 2) New “vercel-ai” reply builder (shared)

- Implement a single function that:
  - Builds the same `messages` array from conversation history + current user message.
  - Uses `generateText()` with OpenAI primary.
  - On eligible OpenAI errors (429/5xx/timeouts): calls Anthropic fallback (either via AI SDK provider, or the existing Anthropic SDK).
  - Returns reply text for downstream `processOrderIntent(...)` (unchanged).
- Keep “store_info” fast-path before any LLM call.
- Keep local-dev “no key” simulator fallback:
  - If no `OPENAI_API_KEY` and no `ANTHROPIC_API_KEY`: accept `ORDER:{...}` / raw JSON and create order directly (current behavior intent).

### 3) Simulator wiring

- Change `POST /api/whatsapp-simulate` to use the new path by default.
- Keep request auth (`x-notify-secret`) as-is.
- Improve simulator UX for debugging (recommended):
  - Show a transcript (user + assistant) vs only “last reply”.
  - Add a reset button (clear transcript + optionally switch phone).
  - Show which provider was used (OpenAI vs Anthropic fallback) in UI (dev-only).

## Acceptance Criteria

- Simulator:
  - When `OPENAI_API_KEY` is set, simulator replies are generated via the new Vercel AI path.
  - When OpenAI fails (forced/mocked), simulator falls back to Anthropic (if key exists).
  - When no keys exist in dev, simulator still supports ORDER/JSON direct create mode.
- Webhook safety:
  - `POST /api/whatsapp` behavior is unchanged.
- Order protocol:
  - `ORDER:{...}` suffix still results in order creation + “✅ Comanda ORD-…” response.

## Testing Plan

- Unit:
  - New “LLM router” function: OpenAI success, OpenAI failure → Anthropic fallback, no keys → local simulation mode.
  - Ensure error classification doesn’t fallback on “bad request” / prompt errors (fail fast).
- Manual:
  - Simulator: run a few prompts (store info, product query, order creation).

## Risks / Mitigations

- Risk: webhook regressions → mitigation: do not change webhook.
- Risk: LLM cost spikes → mitigation: cheap default model + token caps + rate-limited fallback.
- Risk: simulator stops being representative → mitigation: share system prompt + post-processing code paths between both builders.

## Next

1) Review plan.
2) Start `/workflows:work` on this plan.
