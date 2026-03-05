# WhatsApp Agent — Runbook (Vercel + Twilio)

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
- `VITE_NOTIFY_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Internal simulator (optional): `POST /api/whatsapp-simulate`

- `WHATSAPP_SIMULATOR_SECRET` (optional; falls back to `VITE_NOTIFY_SECRET`)
- `VITE_ENABLE_WHATSAPP_SIMULATOR=true` (frontend toggle to show simulator panel in Orders page)
- Local Vite dev (`pnpm dev`) serves this endpoint directly (no Vercel URL/proxy needed).
- If `ANTHROPIC_API_KEY` is missing locally, simulator still works with direct order payload:
  - `ORDER:{"customer_name":"...","customer_phone":"+40...","items":[{"name":"...","qty":1}],"pickup_time":"18:30"}`
  - or raw JSON object with same fields (without `ORDER:` prefix).

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
