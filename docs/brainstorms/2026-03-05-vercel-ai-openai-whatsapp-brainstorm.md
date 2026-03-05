---
date: 2026-03-05
topic: vercel-ai-openai-whatsapp
---

# Vercel AI SDK + OpenAI for WhatsApp agent (keep Anthropic fallback)

## What We’re Building

Add a new WhatsApp LLM call path (Vercel AI SDK + OpenAI) used by:
- Simulator UI: `src/pages/WhatsAppSimulatorPage.tsx` → `POST /api/whatsapp-simulate`

…while keeping the real WhatsApp webhook behavior stable:
- Real webhook: `POST /api/whatsapp` (Twilio) stays on the current “working” path by default.
- Optional (future): enable OpenAI/Vercel-AI path for the real webhook via an explicit env flag (for controlled rollout).

In the new path, use **OpenAI as primary** and **Anthropic as fallback** (complimentary, not removed).

Hard constraints:
- Keep existing “store info” fast-path (no LLM call).
- Keep existing inventory summary injection + ORDER JSON protocol (`ORDER:{...}` suffix) + order creation logic.
- Keep local-dev “no key” simulator behavior (ORDER/JSON direct create).

## Why This Approach

Goal: stop reinventing “chat simulator / chat plumbing”, and use the simulator to exercise the full LLM interaction layer safely. Use Vercel AI SDK primitives (provider adapters + unified call shape) while keeping existing domain logic (inventory/order handling) untouched.

## Approaches Considered

### Approach A: Vercel AI SDK only for OpenAI; keep Anthropic SDK fallback (minimal diff)
Pros:
- Lowest risk / smallest change set.
- Anthropic-specific overload retry stays as-is.
Cons:
- Two different LLM calling stacks remain.
- Slightly more complexity long-term.

### Approach B (Recommended): Vercel AI SDK for both OpenAI + Anthropic; runtime fallback
Pros:
- One “LLM client” surface in `api/whatsapp.ts`.
- Cleaner provider switching + future provider adds.
Cons:
- Bigger refactor of the current Anthropic call.

### Approach C: OpenAI only for simulator; webhook stays Anthropic (default)
Pros:
- Zero risk to production webhook; simulator becomes the primary test harness.
Cons:
- Doesn’t modernize production path unless explicitly enabled later.

## Recommendation

Approach C now (production-safety): implement Vercel AI SDK path for the simulator only, and keep the Twilio webhook on the current path by default.

Enablement:
- Simulator uses the new path (when keys exist).
- Webhook enablement is explicitly deferred (not needed for current goal).

Fallback order inside the new path:
1) OpenAI primary
2) Anthropic fallback on OpenAI errors/rate-limit/5xx/timeouts
3) If neither key exists in dev, simulator path keeps “ORDER/JSON direct create” mode

## Key Decisions

- Provider routing: OpenAI primary, Anthropic fallback.
- Model: use the cheapest OpenAI text model by default: `gpt-4.1-nano` (configurable). See OpenAI pricing/model docs for current rates.
- Production safety: keep Twilio webhook on current path unless explicitly enabled via env.
- Non-streaming responses (Twilio expects one reply string; simulator just displays last reply).
- Keep store info intent handler (regex) before any LLM call.
- Preserve `ORDER:{...}` protocol as the only “tool” interface (no tool-calling yet).

## Config / Env

- Add `OPENAI_API_KEY` (server env; Vercel project settings).
- Keep `ANTHROPIC_API_KEY` as optional fallback.
- Add model overrides (names TBD in planning): e.g. `WHATSAPP_OPENAI_MODEL`, `WHATSAPP_ANTHROPIC_MODEL`.
- Add enablement flag for webhook rollout (name TBD in planning): e.g. `WHATSAPP_USE_VERCEL_AI=true`.

## Open Questions

- Exact default model naming/overrides (pick stable env var names).
- “Fallback conditions” detail: which OpenAI errors trigger fallback vs “fail fast”.
- Do we want to keep the existing “Anthropic overloaded retry” logic, or rely on AI SDK + our own retry wrapper.
- Simulator-vs-webhook divergence: ensure both paths share the same prompt + post-processing so simulator remains representative.

## Next Steps

→ `/workflows:plan` to turn this into implementation steps (deps, files, tests, env docs updates).
