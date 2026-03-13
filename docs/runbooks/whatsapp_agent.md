# WhatsApp Agent — Runbook (Vercel + Twilio)

## Local parity check (authoritative)

- Use `pnpm whatsapp:replay --list` to see available replay fixtures.
- Use `pnpm whatsapp:replay --fixture <name>` to replay Twilio-shaped requests through local `POST /api/whatsapp`.
- Replay output includes captured async REST/template sends for that request, not just immediate TwiML.
- This replay flow is the authoritative local parity check for phone behavior.
- Treat `/api/whatsapp-simulate` and the simulator UI as convenience-only tools, not proof that real phone behavior matches.

## Required env vars (Vercel Project → Settings → Environment Variables)

### Webhook: `POST /api/whatsapp`

- `TWILIO_AUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Customer notifications: `POST /api/whatsapp-notify`

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Internal simulator (optional, local-only): `POST /api/whatsapp-simulate`
Notes:
- `/api/whatsapp-notify` now expects an `Authorization: Bearer <supabase_access_token>` header (sent by the web app).
- This is only a strong auth gate if your Supabase project does **not** allow anonymous sign-in.

- `VITE_ENABLE_WHATSAPP_SIMULATOR=true` (frontend toggle to show simulator panel in Orders page)
- Local Vite dev (`pnpm dev`) serves this endpoint directly.
- The Vercel function returns `404`; simulator traffic is not supported in preview/production.
- `WHATSAPP_SIMULATOR_SECRET` is optional for local middleware auth and may fall back to `VITE_NOTIFY_SECRET`.
- `WHATSAPP_PENDING_ORDER_TTL_MINUTES` is optional. Default is `120`; stale pending orders are expired before `DA/NU` or button confirm/cancel.
- For local LLM testing, set `OPENAI_API_KEY` (primary). Optional fallback: `ANTHROPIC_API_KEY`.
- If both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are missing locally, simulator still works with direct order payload:
  - `ORDER:{"customer_name":"...","customer_phone":"+40...","items":[{"name":"...","qty":1}],"pickup_time":"18:30"}`
  - or raw JSON object with same fields (without `ORDER:` prefix).
- The simulator is useful for convenience and debugging, but parity work should use `pnpm whatsapp:replay`.

### Store info (shown in replies)

- `STORE_NAME` (recommended)
- `STORE_ADDRESS` (recommended)
- `STORE_HOURS` (recommended)
- `STORE_PHONE` (optional)

## Redeploy / apply changes

- After changing env vars, trigger a redeploy in Vercel (or wait for next deploy) so functions pick them up.

## Verification checklist (manual)

- Send “Care e adresa?” → reply includes real address (no placeholders).
- Send “Care e programul?” → reply includes real hours (no placeholders).
- Create an order via WhatsApp → order appears in OrdersPage.
- Confirm/cancel in OrdersPage → customer receives WhatsApp message.
- After creating a pending order, send a fresh browse query (example: `Salut, ce aveti de carne?`) → reply must not reuse old item lines or old pickup details.
- Lower `WHATSAPP_PENDING_ORDER_TTL_MINUTES` locally, wait past expiry, then send `DA` / `NU` or a confirm/cancel button payload → reply must say the pending order expired.
- If Twilio quick replies are enabled, confirm/cancel via button payload and verify the result matches the text fallback path.
