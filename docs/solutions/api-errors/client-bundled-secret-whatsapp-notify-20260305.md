---
module: WhatsAppNotify
date: 2026-03-05
problem_type: api_error
component: webhook_handler
symptoms:
  - "Serverless notify endpoint relied on a client-shipped VITE_ shared secret for authorization"
  - "Authorization boundary was weaker than expected because VITE_ values can be exposed in the bundle"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [whatsapp, twilio, vercel, authorization, vite-env]
related_github_issue: null
commit: null
---

# Problem Description

`/api/whatsapp-notify` previously accepted a shared secret sent from the browser (`VITE_NOTIFY_SECRET` via `x-notify-secret`). Because `VITE_` variables are intended for client exposure, this was not a robust authorization mechanism.

This endpoint can trigger Twilio WhatsApp messages, so an authorization weakness is a cost/abuse risk.

# Symptoms

- The browser sent `x-notify-secret` based on `import.meta.env.VITE_NOTIFY_SECRET`.
- The serverless function compared the header to `process.env.VITE_NOTIFY_SECRET`.
- This pattern can leak because `VITE_` variables are commonly bundled into frontend builds.

# Root Cause Analysis

Environment naming and trust boundary mismatch:
- `VITE_` variables are meant for frontend use and can be inspected in the built bundle.
- Using them as “secrets” creates a false sense of authorization.

# Solution

Removed the client-shipped shared secret from the notify authorization path.

```ts
// ✅ AFTER: serverless requires a Supabase Bearer token
const authHeader = String(req.headers.authorization ?? '')
const match = authHeader.match(/^Bearer\\s+(.+)$/i)
const accessToken = match?.[1]?.trim() ?? ''
if (!accessToken) return res.status(401).json({ error: 'Unauthorized' })
```

Serverless validates the token via Supabase Auth:
- `sb.auth.getUser(accessToken)`

Client now sends:
- `Authorization: Bearer <supabase_access_token>`

Docs/env notes were updated to remove `VITE_NOTIFY_SECRET` as a requirement for `/api/whatsapp-notify`.

Important caveat:
- This becomes a strong authorization boundary only if your Supabase project does **not** allow anonymous sign-in (or you add real operator auth/roles).

# Files Changed

- `api/whatsapp-notify.ts`
- `src/pages/orders/OrderCard.tsx`
- `docs/runbooks/whatsapp_agent.md`
- `.env.example`

# Prevention

- [x] Avoid using `VITE_` variables as secrets for server authorization.
- [ ] Prefer server-side triggers for notifications (DB trigger / Edge Function) to remove the browser from the trust boundary.
- [ ] If keeping a client-callable endpoint, enforce real operator auth and consider rate-limiting / idempotency keys.

