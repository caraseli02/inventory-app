# Runbook: Supabase Operations

Operational procedures for the Supabase backend. All commands assume `supabase` CLI is installed and authenticated.

---

## Applying Migrations

**Preconditions**: Supabase project linked (`supabase link --project-ref <ref>`).

```bash
# Apply all pending migrations to remote
supabase db push

# Check migration status
supabase migration list

# Apply a single migration locally for testing
supabase db reset  # resets local DB and applies all migrations
```

**Rollback**: Migrations are not auto-reversible. Write a new down-migration file in `supabase/migrations/` with the inverse DDL.

---

## Regenerating TypeScript Types

Run after any schema change (new table, column, or RLS policy):

```bash
supabase gen types typescript --project-id <your-project-id> --schema public > src/lib/database.types.ts
```

**Verify**: `pnpm typecheck` should pass after regeneration. Check that new tables appear in the generated types.

**Note**: `src/lib/database.types.ts` is currently hand-authored for `products` and `stock_movements` tables. WhatsApp tables (`conversation_history`, `orders`, `whatsapp_message_dedup`, `whatsapp_rate_limit`) are not yet in the generated types — tracked in todo #136.

---

## Verifying RLS Policies

```sql
-- List all policies on a table
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'products';

-- Test as anon role (simulate client-side access)
SET ROLE anon;
SELECT * FROM products LIMIT 5;
RESET ROLE;
```

If RLS is blocking legitimate access, check the policy `qual` expression. Common issue: `auth.uid()` returns null for unauthenticated requests — ensure public read policies use `true` not `auth.uid() = user_id`.

---

## Edge Function Deployment

```bash
# Deploy a single edge function
supabase functions deploy invoice-ocr

# Deploy all edge functions
supabase functions deploy

# View logs
supabase functions logs invoice-ocr --tail

# Set secrets (server-side API keys)
supabase secrets set GOOGLE_VISION_API_KEY=... OPENAI_API_KEY=...
```

**Rollback**: Redeploy the previous function version from git:
```bash
git checkout <previous-commit> -- supabase/functions/invoice-ocr/
supabase functions deploy invoice-ocr
```

---

## WhatsApp State: Manual Operational Procedures

### Clear a stuck pending order

When a customer has a non-null `pending_order` and cannot proceed:

```sql
UPDATE conversation_history
SET pending_order = NULL, pending_order_created_at = NULL
WHERE phone_number = '+<phone>';
```

### Reset a rate-limited phone number

```sql
DELETE FROM whatsapp_rate_limits
WHERE phone_number = '+<phone>';
```

### Dedup table maintenance

`processed_message_sids` has no TTL job — entries accumulate. Run periodically:

```sql
DELETE FROM processed_message_sids
WHERE processed_at < now() - interval '7 days';
```

### Check if consume_pending_order RPC is installed

If you see `[whatsapp] consume_pending_order RPC unavailable` in logs, the migration was not applied:

```bash
supabase db push  # apply pending migrations
```

Verify: `supabase migration list` should show `20260313000003_consume_pending_order_rpc.sql` as applied.

---

## Monitoring

- Supabase dashboard → Database → Logs for query errors
- Supabase dashboard → Edge Functions → Logs for function invocations
- Vercel dashboard → Functions → Logs for `/api/whatsapp` webhook logs
