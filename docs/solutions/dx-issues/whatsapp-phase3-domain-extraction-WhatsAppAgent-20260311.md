---
module: WhatsAppAgent
date: 2026-03-11
problem_type: developer_experience
component: api_client
symptoms:
  - "`api/whatsapp.ts` still contained deterministic conversation, inventory, and order-intent logic after the phase 1 helper split"
  - "Unit tests for follow-up parsing and order extraction still depended on `api/whatsapp.ts` internals instead of stable module seams"
  - "Phase 4 orchestration extraction was blocked because the route file still mixed webhook flow with domain logic"
root_cause: logic_error
resolution_type: refactor
severity: medium
tags: [whatsapp, twilio, refactor, domain-extraction, conversation, inventory, order-intent, developer-experience]
related_github_issue: null
commit: null
---

# Problem Description

After the phase 1 helper extraction, the WhatsApp webhook was smaller, but the core deterministic domain logic still lived in `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`. Conversation heuristics, inventory resolution, and `ORDER:` parsing were still embedded in the route module.

That left the refactor stuck in an awkward middle state: helpers were modular, but the main file still owned too much logic for phase 4 to proceed safely. It also kept tests coupled to the route module instead of the extracted domain boundaries.

# Symptoms

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts` still contained `classifyIncomingText`, search-candidate extraction, menu/follow-up handling, inventory summary generation, and `ORDER:` parsing/processing.
- Unit tests in `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts` and `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts` imported route internals rather than dedicated modules.
- The phase 3 goals in `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md` could not honestly be marked complete while the route still contained deterministic domain logic.

# Root Cause Analysis

The first extraction pass only moved pure helpers. That was correct for reducing initial risk, but it left a second boundary collapse in place: the webhook route still owned domain logic that should have been reusable and directly testable.

The actual issue was not just file size. The deeper problem was that stable seams for the WhatsApp domain did not exist yet:

- conversation heuristics and order follow-up shaping were tied to the route file
- inventory search and item resolution were mixed with webhook orchestration
- `ORDER:` extraction and pending-order assembly remained embedded in the route
- tests still validated the domain indirectly through the route instead of at the domain boundary

```typescript
// ❌ BEFORE
// api/whatsapp.ts still defined functions like:
function classifyIncomingText(text: string): IncomingIntent { ... }
function maybeHandleOrderFollowup(args: ...) { ... }
async function getInventorySummary(sb, args) { ... }
function extractOrderJson(text: string) { ... }
async function processOrderIntent(sb, replyText: string) { ... }
```

# Solution

Phase 3 extracted the deterministic WhatsApp domains into focused modules and rewired the webhook route to consume them.

## 1) Create a conversation domain module

Added `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/conversation.ts`.

This module now owns:

- language detection
- store-info and overload fallback replies
- intent classification
- search-candidate extraction
- pickup time normalization
- menu-selection handling
- deterministic follow-up shaping
- cancellation request handling
- ORDER repair heuristics

```typescript
// ✅ AFTER
import {
  buildOverloadedReply,
  buildStoreInfoReply,
  classifyIncomingText,
  detectEnglish,
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  looksLikeOrderRequest,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  maybeRepairOrderReply,
  handleCancellationRequest,
} from './whatsapp/conversation.js';
```

## 2) Create an inventory domain module

Added `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/inventory.ts`.

This module now owns:

- inventory summary generation
- markup-aware store pricing
- product-by-id and product-by-name resolution
- order-item resolution with stock checks
- fuzzy matching/scoring logic

This removed product/query logic from the route file and made item-resolution behavior reusable for order processing.

## 3) Create an order-intent module

Added `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/order-intent.ts`.

This module now owns:

- `extractOrderJson`
- `createPendingOrderFromPending`
- `processOrderIntent`

That isolates `ORDER:` parsing and pending-order creation from the webhook route and clarifies the split between orchestration and deterministic transactional logic.

## 4) Rewire tests to target modules directly

Updated:

- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts`

These tests now import from the extracted modules directly instead of reaching through `api/whatsapp.ts` internals. That removed the need for route-level `__private__` coupling for the covered functions.

## 5) Mark the phase complete only after verification

Updated `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md` to check off the phase 3 extraction and success criteria only after the implementation and validation were complete.

Verified with:

- `pnpm typecheck`
- `pnpm test:unit -- --run tests/unit/whatsappAgent.test.ts tests/unit/whatsappInventory.test.ts tests/unit/api/whatsapp-webhook.test.ts`

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/conversation.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/inventory.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp/order-intent.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-11-refactor-whatsapp-module-split-plan.md`

# Prevention

- [x] Extract deterministic domain logic before orchestration layers when refactoring a large route module
- [x] Move tests to the new module seam immediately after extraction instead of keeping route-level test hooks
- [x] Run typecheck after large deletions from the original file to catch stale references during the split
- [ ] Add direct tests for `processOrderIntent` error branches, not only indirect coverage through webhook flows
- [ ] Add direct tests for `resolveOrderItems` ambiguity and out-of-stock branches in the inventory module
- [ ] Keep phase checkboxes in the refactor plan aligned with the actual branch state, not intended state

# Related Documentation

- See also: [whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/dx-issues/whatsapp-phase1-helper-extraction-WhatsAppAgent-20260311.md)
- See also: [followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- See also: [twilio-webhook-forged-requests-whatsapp-webhook-20260304.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md)
