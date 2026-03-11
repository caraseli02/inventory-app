---
module: Vercel
date: 2026-03-11
problem_type: build_error
component: build_config
symptoms:
  - "Vercel deploy failed on main with TS2322 in api/whatsapp.ts while local pre-commit and CI were green"
  - "pnpm typecheck and pnpm build did not type-check api/*.ts serverless entrypoints"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [vercel, typescript, ci, pre-commit, serverless, api, whatsapp]
related_github_issue: null
commit: null
---

# Problem Description

Vercel caught TypeScript errors in `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` that were invisible locally and in GitHub Actions:

> `api/whatsapp.ts(528,5): error TS2322: Type '"local"' is not assignable to type '"openai" | "anthropic"'`
>
> `api/whatsapp.ts(586,5): error TS2322: Type '{ debug?: { intent: "store_info" | "cancel_order"; }; provider: "local"; reply: string; }' is not assignable to type 'WhatsAppSimulatorResult'`

This blocked deploys on `main` even though pre-commit and CI had already passed.

# Symptoms

- Vercel deploy logs failed while compiling the serverless function `api/whatsapp.ts`.
- Local `pnpm typecheck` passed.
- CI `Lint & Type Check` job passed.
- Root TypeScript config only covered `src/` and `vite.config.ts`, not `api/*.ts`.

# Root Cause Analysis

The repository had a frontend-focused TypeScript project boundary:

- `/Users/vladislavcaraseli/Documents/inventory-app/tsconfig.app.json` included only `src`
- `/Users/vladislavcaraseli/Documents/inventory-app/tsconfig.node.json` included only `vite.config.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/package.json` ran only those projects plus the MCP server check

So `api/*.ts` serverless entrypoints were not part of:

- pre-commit `pnpm typecheck`
- CI `Check TypeScript`
- `pnpm build`

Vercel, however, compiles files declared under `api/` as serverless functions during deploy, so it type-checked code that local/CI never saw.

There was also a real app-level type mismatch in `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`:

```typescript
// ❌ BEFORE
async function runConversationTurn(args: {
  sb: ReturnType<typeof createClient>;
  llmProvider: Exclude<WhatsAppSimulatorProvider, 'local'>;
}): Promise<WhatsAppSimulatorResult>
```

The function already had legitimate local-response branches, but its internal type excluded `'local'`, and the result debug shape was stricter than some deterministic branches actually returned.

# Solution

## 1) Add a dedicated TypeScript project for serverless API files

Created `/Users/vladislavcaraseli/Documents/inventory-app/tsconfig.api.json` to type-check the deployed serverless entrypoints:

- `api/upload.ts`
- `api/whatsapp.ts`
- `api/whatsapp-simulate.ts`
- `api/whatsapp-notify.ts`

This matches the Node/Vercel runtime shape better than the frontend `tsconfig.app.json`.

## 2) Make local and CI typecheck use the API project

Updated `/Users/vladislavcaraseli/Documents/inventory-app/package.json`:

```json
"typecheck": "tsc -b --noEmit && tsc --project tsconfig.api.json --noEmit && tsc --project mcp/tsconfig.server.json --noEmit"
```

Updated `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`:

```yaml
- name: Check TypeScript
  run: pnpm typecheck
```

That removes the drift between:

- pre-commit
- CI validate
- the actual serverless deploy surface

## 3) Fix the serverless typing issue exposed by the new check

Updated `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` to:

- allow `llmProvider: WhatsAppSimulatorProvider`
- use a concrete `ServerSupabaseClient` alias from `createSupabaseClient()`
- make `WhatsAppSimulatorResult.debug` fields optional so deterministic local branches remain type-safe

Also added `/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.d.ts` so the existing JS helper can participate in TypeScript checking without reintroducing the duplicate `.js`/`.ts` Vercel path conflict.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/tsconfig.api.json`
- `/Users/vladislavcaraseli/Documents/inventory-app/package.json`
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.d.ts`

# Prevention

- [x] Add a dedicated TS project for deployed `api/*.ts` files
- [x] Make CI call the same `pnpm typecheck` command used locally
- [x] Keep JS helper declarations in `.d.ts` when a real `.ts` file would collide with Vercel route/module naming
- [ ] Add a small smoke check that enumerates Vercel-deployed entrypoints and asserts each is included in at least one TS project
- [ ] Consider adding `vercel build` or equivalent serverless parity build in CI for highest-fidelity deploy validation

# Related Documentation

- See also: [vercel-conflicting-api-paths-twilio-signature-Vercel-20260305.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/build-errors/vercel-conflicting-api-paths-twilio-signature-Vercel-20260305.md)
