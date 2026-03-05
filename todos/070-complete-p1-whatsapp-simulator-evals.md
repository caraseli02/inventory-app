---
status: complete
priority: p1
issue_id: "070"
tags: [whatsapp, simulator, evals, testing]
dependencies: ["069"]
---

# Goal

Have a repeatable local “eval” command that validates the order submission flow (ORDER → DB insert) without relying on real WhatsApp or LLM behavior.

# Delivered

- `pnpm whatsapp:eval` (posts to local `/api/whatsapp-simulate`, asserts order exists in Supabase, then deletes it).
- Supports `--mode direct` (deterministic) and `--mode agent` (smoke; LLM-dependent).

