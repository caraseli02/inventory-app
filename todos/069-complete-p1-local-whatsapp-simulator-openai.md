---
status: complete
priority: p1
issue_id: "069"
tags: [whatsapp, simulator, ai, openai, vercel]
dependencies: []
---

# Goal

Local WhatsApp simulator can run multi-turn order-agent conversations without sending real WhatsApp messages.

# Scope

- Add OpenAI (Vercel AI SDK) to `POST /api/whatsapp-simulate` (primary).
- Optional fallback to Anthropic if OpenAI fails and `ANTHROPIC_API_KEY` exists.
- Improve simulator UI: show transcript + reset.
- Do not change `POST /api/whatsapp` behavior.

# Checklist

- [x] Add deps: `ai`, `@ai-sdk/openai`
- [x] Add simulator LLM path (OpenAI primary)
- [x] Keep local “no key” ORDER/JSON create mode
- [x] Return `provider` in simulator response (debug)
- [x] UI: transcript + reset (no raw HTML controls)
- [x] Update `.env.example` + runbook for local usage
- [x] Run `pnpm typecheck` + `pnpm lint`
