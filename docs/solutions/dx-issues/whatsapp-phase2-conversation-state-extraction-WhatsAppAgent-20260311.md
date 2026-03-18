---
module: WhatsAppAgent
date: 2026-03-11
problem_type: developer_experience
component: server_component
symptoms:
  - "`api/whatsapp.ts` still mixed Supabase client creation, conversation history access, pending-order persistence, and route orchestration after Phase 1"
  - "State behavior for WhatsApp conversations had no focused module boundary, making the planned Phase 3 split riskier"
  - "Simulator reset still depended on the main webhook module instead of a dedicated state seam"
root_cause: logic_error
resolution_type: refactor
severity: medium
tags: [whatsapp, twilio, refactor, conversation-state, supabase, pending-order, developer-experience]
related_github_issue: null
commit: null
---

# Problem Description

Phase 1 extracted pure WhatsApp helpers, but `api/whatsapp.ts` still owned all Supabase client creation and conversation-state access. That left the most mutation-heavy part of the webhook flow embedded in the main route file:

- reading conversation history
- appending history through the RPC fallback path
- storing and consuming pending orders
- resetting simulator conversation state

That was enough to keep the route working, but it was not a good base for the next split. Any attempt to move order or conversation logic in Phase 3 would still need to cut across live database state code inside the route entrypoint.

# Symptoms

- `api/whatsapp.ts` still mixed route handling with `conversation_history` and `pending_order` reads/writes.
- Shared conversation-state behavior could only be exercised indirectly through the large webhook module.
- `api/whatsapp-simulate.ts` imported reset behavior from the main WhatsApp module instead of a dedicated state module.
- The refactor plan explicitly blocked deeper work on adding a stable conversation-state seam first.

# Root Cause Analysis

The root problem was not Supabase itself. The problem was ownership: database client creation and state mutations had no focused module boundary.

Phase 1 intentionally stopped short of moving persistence logic. That kept the first change small, but it also meant the next refactor stage still faced a route file that knew too much about state storage.

```typescript
// ❌ BEFORE
// api/whatsapp.ts owned:
function createSupabaseClient() { ... }
async function storePendingOrder(...) { ... }
async function getPendingOrder(...) { ... }
async function getHistory(...) { ... }
async function appendHistory(...) { ... }
export async function resetConversationHistory(...) { ... }
```

With all of that still embedded in the webhook file, future extractions of conversation, order-intent, or simulator logic would continue to cross the same stateful seam.

# Solution

Phase 2 extracted a shared database/state boundary without changing end-user behavior.

## 1) Create a dedicated Supabase module

Added:

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/db.ts`

This module now owns server-side Supabase client creation and exports the shared `ServerSupabaseClient` type.

## 2) Create a dedicated conversation-state module

Added:

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/conversation-state.ts`

This module now owns:

- `resetConversationHistory`
- `hasConversationHistory`
- `storePendingOrder`
- `getPendingOrder`
- `getHistory`
- `appendHistory`

```typescript
// ✅ AFTER
import { createSupabaseClient, type ServerSupabaseClient } from './whatsapp/db.js';
import {
  appendHistory,
  getHistory,
  getPendingOrder,
  hasConversationHistory,
  storePendingOrder,
} from './whatsapp/conversation-state.js';
```

## 3) Rewire the webhook and simulator to use the seam

`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` now imports its Supabase/state helpers instead of defining them inline.

`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts` now resets conversation history through the extracted state module instead of the main webhook module.

This keeps behavior stable while making the state boundary explicit for later phases.

## 4) Add focused module tests

Added:

- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts`

This test file covers:

- conversation-history presence checks
- pending-order store/read-clear behavior
- TTL-based history expiry
- RPC-first history append with upsert fallback
- reset behavior using a fresh Supabase client

The simulator reset test in `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts` was also retargeted to mock the extracted state module directly.

## 5) Verify no customer-visible behavior changed

Ran:

- `pnpm typecheck`
- `pnpm vitest run tests/unit/api/whatsapp-conversation-state.test.ts tests/unit/api/whatsapp-webhook.test.ts tests/unit/api/whatsapp-simulate.test.ts tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts`
- `pnpm vitest run tests/integration/whatsapp-agent.test.ts`

All passed.

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/db.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/conversation-state.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-conversation-state.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/api/whatsapp-simulate.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`

# Prevention

- [x] Extract stateful seams before attempting deeper orchestration splits
- [x] Move simulator reset/state access behind a dedicated module boundary
- [x] Add direct module tests as soon as a new seam exists
- [x] Keep route behavior verification alongside refactor phases
- [ ] Add real webhook coverage for typed `DA/NU` and `YES/NO` pending-order fallback before Phase 3
- [ ] Continue moving WhatsApp tests away from broad `__private__` exports as domain modules are extracted

# Related Documentation

- See also: [whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/dx-issues/whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md)
- See also: [followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- See also: [quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md)
- Review follow-up: `/Users/vladislavcaraseli/Documents/inventory-app/todos/090-pending-p2-webhook-da-nu-fallback-coverage.md`
