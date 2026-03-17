# ADR-0007: Twilio over Meta WhatsApp Cloud API

- **Status**: Accepted
- **Date**: 2026-02-23
- **Deciders**: Engineering team
- **Context**: The original WhatsApp agent spec (v0.1–v0.2) was designed around Meta's WhatsApp Cloud API with Supabase Edge Functions as the runtime. During implementation, two blockers emerged: (1) Meta's API approval process for interactive message templates (list pickers, quick replies) requires business verification that was not yet complete; (2) Supabase Edge Functions added cold-start latency incompatible with Twilio's 15-second webhook response timeout.
- **Decision**: Switch to Twilio WhatsApp API with Vercel serverless functions as the runtime. Twilio provides: pre-approved sandbox for development, Content API for template management (`list-picker`, `call-to-action`, `quick-reply`), and a simpler HMAC-SHA1 webhook validation model. Vercel serverless functions eliminate cold-start issues and align with the existing frontend deployment.
- **Consequences**:
  - Positive: Faster development iteration via Twilio sandbox; Vercel functions match existing infra; Content API templates support list-picker flows.
  - Negative: Twilio per-message cost vs. Meta's free tier; Twilio 21656 template variable validation errors require careful template authoring (see `docs/solutions/integration-issues/`); vendor lock-in to Twilio.
  - Follow-ups: Migrate to Meta production API when business verification completes, if cost becomes an issue; keep transport layer abstracted in `lib/whatsapp/transport.ts` to ease future migration.
- **Alternatives Considered**:
  - Meta WhatsApp Cloud API — original design; blocked by approval timeline and Edge Function latency.
  - WhatsApp Business API self-hosted — rejected: operational complexity too high.
- **Reference**: `docs/specs/whatsapp_agent.md` changelog 0.3.0, `lib/whatsapp/transport.ts`, `api/whatsapp.ts`
