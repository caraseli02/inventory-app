---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - data-integrity-guardian
  - architecture-strategist
  - performance-oracle
---

## Project Context

TypeScript/Node.js WhatsApp ordering bot built on:
- **Runtime**: Node.js with TypeScript (ESM)
- **Backend**: Supabase (PostgreSQL)
- **Messaging**: Twilio WhatsApp API (welcome + confirmation use Content Templates; middle is text-only)
- **Framework**: Next.js API routes (Vercel serverless)

### Key domains to watch
- `lib/whatsapp/` — webhook handler, conversation state machine, transport layer
- `lib/whatsapp/conversation-state.ts` — Supabase-backed state (pending_order, pending_selection, history)
- `lib/whatsapp/selection-resolver.ts` — list-picker flow logic, cart accumulation
- `lib/whatsapp/webhook.ts` — entry point: button payloads, text interception, LLM fallback

### Critical invariants
- `pending_selection` is a state machine: category_list → product_list → awaiting_qty → building_order → awaiting_pickup_time
- Cart (`CartItem[]`) must thread through every state transition without loss
- `storePendingOrder` is a transactional write — must only fire after full cart + pickup time confirmed
- `sendTemplateMessage` returns boolean; callers must handle `false` with text fallback
- Twilio 21656: every `{{N}}` in template body must be declared in `variables` object

### What NOT to flag
- `docs/plans/*.md` and `docs/solutions/*.md` — pipeline artifacts, never suggest deletion
- Airtable legacy code in `lib/api.ts` / `lib/airtable.ts` — intentionally kept for backward compat
