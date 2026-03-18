# Feature: WhatsApp AI Agent for Customer Q&A & Pickup Orders

**Version**: 0.4.0
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2026-03-17
**Dependencies**: [stock_management.md], [product_management.md], [checkout_flow.md]

---

## Problem Statement

Customers of the grocery store have no way to check product availability, prices, or place pickup orders outside of physically visiting the store. The store owner currently handles all customer inquiries manually via personal WhatsApp messages, which is time-consuming and inconsistent. This creates lost sales opportunities and a poor customer experience, especially for time-sensitive purchases.

---

## Goals

- **G1**: Reduce owner time spent answering repetitive customer questions by 80% (availability, price, stock)
- **G2**: Enable customers to place pickup orders 24/7 without owner involvement
- **G3**: Give the owner a single in-app view of all pending pickup orders
- **G4**: Response time under 5 seconds for any customer message
- **G5**: Support both Romanian and English naturally (auto-detected from customer message)

---

## Non-Goals

- **No delivery tracking** — pickup only for v1; delivery logistics is a separate problem
- **No payment processing** — orders are reserved/confirmed, payment happens in-store
- **No Instagram DM support** — same infrastructure can support it later, but out of scope for v1
- **No multi-store support** — single store instance only
- **No customer accounts/auth** — customers identified by name + phone number only (WhatsApp provides phone automatically)

---

## User Stories

### Customer Stories

**As a customer**, I want to ask if a product is in stock via WhatsApp so that I don't make a wasted trip to the store.

**As a customer**, I want to know the price of a product before visiting so that I can plan my shopping budget.

**As a customer**, I want to place a pickup order via WhatsApp so that my items are ready when I arrive.

**As a customer**, I want to receive an order confirmation with a reference number so that I can reference it when I arrive.

**As a customer**, I want to ask in Romanian and receive a response in Romanian so that the experience feels natural and local.

**As a customer**, I want to receive a clear message if a product is out of stock so that I can ask about alternatives.

### Store Owner Stories

**As the store owner**, I want to see all pending pickup orders in the app so that I can prepare them before the customer arrives.

**As the store owner**, I want to confirm or cancel a pickup order with one tap so that customers are notified immediately.

**As the store owner**, I want the agent to reflect live inventory data so that customers are never told a product is available when it isn't.

**As the store owner**, I want to configure the store name, hours, and address once so that the agent always gives accurate store info.

---

## Requirements

### P0 — Must Have (v1 cannot ship without these)

**R01 — WhatsApp Webhook**
Receive incoming messages from WhatsApp Cloud API via a Supabase Edge Function webhook. Respond within 5 seconds.

*Acceptance criteria:*
- Given a customer sends a WhatsApp message to the store number
- When the webhook receives the message
- Then the message is processed and a response is sent back within 5 seconds

**R02 — Product Search Tool (MCP)**
AI agent can search products by name or partial match against live Supabase inventory.

*Acceptance criteria:*
- Given the customer asks "do you have milk"
- When the agent calls `search_products("milk")`
- Then it returns matching products with name, price (€), and current stock
- And out-of-stock products are clearly indicated

**R03 — Natural Language Q&A**
Agent answers product availability and price questions in natural language, in the customer's language (Romanian/English auto-detected).

*Acceptance criteria:*
- Given a customer asks "Aveti lapte?" (Romanian)
- When the agent processes the message
- Then the response is in Romanian
- And includes stock status and price in EUR (€)
- And a fresh browse query does not reuse an older pending order's items or pickup details

**R04 — Pickup Order Creation**
Customer can place a pickup order by specifying items and pickup time. Order is saved to Supabase `orders` table.

*Acceptance criteria:*
- Given a customer requests to order specific items
- When the agent collects: item(s), quantity, customer name, pickup time
- Then an order record is created in Supabase with status `pending`
- And customer receives confirmation with order number and total price
- And order creation is based on current-turn evidence or explicit confirmation signals, not history-only reconstruction
- And `DA/NU` or button confirm/cancel only act on one fresh pending order

**R05 — Orders Page in App**
New page in the React app showing pending pickup orders with confirm/cancel actions.

*Acceptance criteria:*
- Given there are pending orders
- When the owner opens the Orders page
- Then they see: customer name, items, quantities, total, requested pickup time, order number
- And they can tap Confirm or Cancel on each order
- And the customer receives a WhatsApp notification when confirmed or cancelled

**R06 — Store Info Tool (MCP)**
Agent can return static store info: name, address, opening hours.

*Acceptance criteria:*
- Given a customer asks "what are your hours"
- When the agent calls `get_store_info()`
- Then the response includes opening hours and address

**R06b — Stock Deduction on Confirmation**
Stock is deducted from inventory only when the owner confirms an order in the app — not when the order is created. Cancelled orders never affect stock.

*Acceptance criteria:*
- Given a customer places a pickup order for 2x milk
- When the order is created (status: `pending`)
- Then inventory stock count does not change
- When the owner taps Confirm
- Then a stock OUT movement of 2 is recorded for each item
- When the owner taps Cancel
- Then no stock movement is recorded

---

**R07 — Out-of-Stock Handling**
When a requested product has 0 stock, agent informs the customer clearly and does not create an order for that item.

*Acceptance criteria:*
- Given a product has 0 current stock
- When a customer asks about it or tries to order it
- Then the agent says it's currently unavailable
- And does not include it in any order

---

### P1 — Nice to Have

**R08 — Low Stock Warning**
When a product has fewer than `min_stock_level` units, agent mentions limited availability ("only 2 left").

**R09 — Order Cancellation by Customer**
Customer can cancel their own order by replying with their order number + "cancel".

**R10 — Daily Order Digest**
Owner receives a WhatsApp summary at end of day: total orders, total value, items to restock.

**R11 — Suggested Alternatives**
When a product is out of stock, agent suggests similar products from the same category.

---

### P2 — Future Considerations (design for, don't build now)

**R12 — Instagram DM support** — same agent/MCP, different webhook source
**R13 — Telegram bot** — lightweight alternative channel
**R14 — Multi-language expansion** — Hungarian, German for tourist areas
**R15 — Scheduled pickup slots** — time slot management to avoid customer overlap

---

## Architecture

### Components

> **Architecture as of 0.3.0+** (see [ADR-0007](../adrs/ADR-0007-twilio-over-meta.md)):
> Switched from Meta WhatsApp Cloud API + Supabase Edge Functions → **Twilio Content API + Vercel serverless**.

```
Twilio WhatsApp API (Content API for templates)
        ↓ webhook POST (HMAC-SHA1 validated)
Vercel serverless function: api/whatsapp.ts
        ↓ message + conversation history + pending_selection state
lib/whatsapp/ (server components):
  - webhook.ts        — request routing & state machine orchestration
  - conversation.ts   — intent classification, LLM call
  - selection-resolver.ts — cart-flow state transitions
  - conversation-state.ts — DB read/write (history, pending_order, pending_selection)
  - transport.ts      — Twilio send (REST + Content templates)
  - inventory.ts      — product search, category listing
  - llm.ts            — Claude API integration
  - dedup.ts          — message deduplication (SID-based)
  - rate-limit.ts     — per-phone rate limiting
        ↓ tool calls / DB queries
Supabase PostgreSQL (products, stock_movements, orders, conversation_history)
        ↑
React App (OrdersPage: list orders, confirm/cancel → stock deduction)
```

### New Supabase Tables

**`orders`**
```sql
id            uuid PRIMARY KEY
order_number  text UNIQUE          -- human-readable e.g. "ORD-047"
customer_name text NOT NULL
customer_phone text NOT NULL       -- from WhatsApp
items         jsonb NOT NULL       -- [{ product_id, name, qty, unit_price }]
total_price   numeric(10,2)
pickup_time   text                 -- free text from customer e.g. "tomorrow 10am"
status        text DEFAULT 'pending'  -- pending | confirmed | cancelled | completed
created_at    timestamptz DEFAULT now()
notes         text
```

**`conversation_history`** (for multi-turn context + cart state machine)
```sql
id                 uuid PRIMARY KEY
phone_number       text NOT NULL
messages           jsonb NOT NULL         -- [{role, content, timestamp}], last 20 messages
pending_order      jsonb                  -- transactional order state; contains pending_order_created_at for TTL
pending_selection  jsonb                  -- cart-flow state machine: {selection_type, items, cart, created_at}
                                          --   selection_type: 'category_list' | 'product_list' |
                                          --                   'awaiting_qty' | 'building_order' |
                                          --                   'awaiting_pickup_time' | {} (cleared)
                                          --   TTL: 30 minutes (PENDING_SELECTION_TTL_MS)
language           text                   -- preferred language, e.g. 'ro' or 'en'
updated_at         timestamptz DEFAULT now()
```

### MCP Tool Definitions

```typescript
// search_products
Input:  { query: string }
Output: { products: Array<{ id, name, category, price, currentStock, unit }> }

// get_product_details
Input:  { product_id: string }
Output: { id, name, barcode, price, currentStock, minStockLevel, category, imageUrl }

// create_pickup_order
Input:  { items: Array<{ product_id, quantity }>, customer_name: string, pickup_time: string }
Output: { order_id, order_number, total_price, status }

// get_store_info
Input:  {}
Output: { name, address, phone, hours: { mon_fri, saturday, sunday } }
```

### Agent System Prompt (template)

```
You are the friendly assistant for {STORE_NAME}, a local grocery store in {CITY}.

Store info:
- Address: {ADDRESS}
- Hours: {HOURS}
- Phone: {PHONE}

You help customers:
1. Check if products are available and their prices
2. Place pickup orders (payment is always in-store)
3. Answer questions about the store

Rules:
- Always respond in the same language the customer uses
- Prices are always in EUR (€)
- Never confirm stock you haven't checked with search_products
- For orders, always confirm: items, quantities, customer name, pickup time before creating
- Be friendly, brief, and natural — like a helpful shop assistant
- If a product is unavailable, apologize and offer to check similar items
```

---

## Cart-Flow State Machine

The cart-flow is a parallel path to the LLM order-creation path. It uses `pending_selection` in `conversation_history` as its persistent state store.

### States & Transitions

```
idle
  │  (browse intent detected by LLM or button tap)
  ▼
category_list        pending_selection.selection_type = 'category_list'
  │                  items = [list of categories], cart = []
  │  (user selects category via list-picker button or numeric text)
  ▼
product_list         pending_selection.selection_type = 'product_list'
  │                  items = [product names for selected category], cart = []|[...]
  │  (user selects product)
  ▼
awaiting_qty         pending_selection.selection_type = 'awaiting_qty'
  │                  product_name = <selected product>, cart = [...]
  │  (user sends a numeric quantity, e.g. "2")
  ▼
building_order       pending_selection.selection_type = 'building_order'
  │                  cart = [{name, qty}, ...]
  │  "1" / add more ──────────────────────► category_list (preserveCart=true)
  │  "2" / confirm cart
  ▼
awaiting_pickup_time pending_selection.selection_type = 'awaiting_pickup_time'
  │                  cart = [{name, qty}, ...]
  │  (user sends pickup time text, e.g. "mâine 10:30")
  ▼  handleCartPickupTime() — resolves cart items against inventory, writes pending_order
pending_order set    (LLM path takes over)
  │  DA / button confirm ──────────────────► confirmed (order created in DB)
  │  NU / button cancel ───────────────────► cancelled (pending_order cleared)
  │  TTL expired (120 min default) ─────────► expired (pending_order cleared on next read)
```

**Key invariant**: `pending_selection` must NEVER be cleared before the dependent state write succeeds.
- `storePendingOrder` propagates errors (never swallows) — cart is preserved if order write fails.
- `storePendingProductSelection` returns `Promise<boolean>` — state-advancing callers abort on `false`.

### handleCartPickupTime (parallel path to LLM)

`handleCartPickupTime` in `lib/whatsapp/selection-resolver.ts` is the cart-flow equivalent of the LLM order-creation path. It:
1. Reads `pending_selection` (must be `awaiting_pickup_time`)
2. Resolves cart items against live inventory (throws on out-of-stock or ambiguous)
3. Writes `pending_order` (propagates errors — does NOT clear cart on failure)
4. Clears `pending_selection` (best-effort, only after `storePendingOrder` succeeds)
5. Sends confirmation summary + DA/NU prompt

### BDD Scenarios

```
Scenario: Browse intent triggers category list
    Given a customer sends "Caut un produs" (browse text)
    When the webhook classifies intent as browse_inventory
    Then sendCategoryPicker() is called
    And pending_selection.selection_type = 'category_list' is persisted
    And a category list-picker template (or numbered text) is sent to the customer

Scenario: Category selection advances to product list
    Given pending_selection.selection_type = 'category_list'
    And items = ['Lactate', 'Carne', 'Legume']
    When the customer sends "1" or taps the 'Lactate' button
    Then resolveSelectionByIndex() returns {outcome: 'category_selected', category: 'Lactate'}
    And handleCategorySelected() is called
    And pending_selection.selection_type = 'product_list' is persisted before the message is sent
    And a product list for 'Lactate' is sent to the customer

Scenario: Product selection advances to quantity prompt
    Given pending_selection.selection_type = 'product_list'
    And items = ['Lapte 1L', 'Smântână 20%']
    When the customer sends "1" or taps 'Lapte 1L'
    Then handleProductSelected() is called
    And pending_selection.selection_type = 'awaiting_qty' is persisted before the prompt is sent
    And the customer receives a quantity prompt

Scenario: Quantity input advances to building_order
    Given pending_selection.selection_type = 'awaiting_qty'
    And product_name = 'Lapte 1L', cart = []
    When the customer sends "2"
    Then handleQtyInput() returns true (intercepted)
    And pending_selection.selection_type = 'building_order', cart = [{name:'Lapte 1L', qty:2}]
    And the customer receives a cart summary with add-more / confirm options

Scenario: Add more items loops back to category list
    Given pending_selection.selection_type = 'building_order'
    And cart = [{name:'Lapte 1L', qty:2}]
    When the customer sends "1" (add more)
    Then sendCategoryPicker(preserveCart=true) is called
    And pending_selection.selection_type = 'category_list', cart = [{name:'Lapte 1L', qty:2}]
    And the category list is sent again with the existing cart preserved

Scenario: Cart confirmation advances to awaiting_pickup_time
    Given pending_selection.selection_type = 'building_order'
    And cart = [{name:'Lapte 1L', qty:2}]
    When the customer sends "2" (confirm cart)
    Then pending_selection.selection_type = 'awaiting_pickup_time' is persisted
    And the customer is prompted for a pickup time

Scenario: Pickup time creates pending_order
    Given pending_selection.selection_type = 'awaiting_pickup_time'
    And cart = [{name:'Lapte 1L', qty:2}]
    When the customer sends "mâine la 10:30"
    Then handleCartPickupTime() is called
    And resolveOrderItems() validates inventory (stock levels, no duplicates)
    And storePendingOrder() writes the order (propagates errors)
    And pending_selection is cleared to {} (best-effort, only after order write succeeds)
    And the customer receives an order summary with DA/NU confirmation

Scenario: Store failure during cart state write aborts the flow
    Given pending_selection.selection_type = 'awaiting_qty'
    And the Supabase write fails (transient error)
    When the customer sends "2"
    And storePendingProductSelection() returns false
    Then the customer receives "A apărut o eroare. Încearcă din nou."
    And no state is advanced (selection remains 'awaiting_qty' or stale)
    And the customer can retry

Scenario: Pending order expiry prevents stale confirmation
    Given pending_order was created more than 120 minutes ago
    When the customer sends "DA"
    Then getPendingOrderState() returns {status: 'expired'}
    And clearPendingOrder() is called
    And the customer receives an expiry message (not a confirmation)

Scenario: Fresh browse query does not resurrect a prior pending order
    Given a pending_order exists from a prior session
    When the customer sends a fresh browse query (no quantity, no pickup time)
    Then the LLM path does not produce an ORDER: payload
    And the prior pending_order is not confirmed or modified
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Messages responded to within 5s | >95% | Edge Function logs |
| Order conversion rate (inquiry → order) | >20% | orders table / message count |
| Owner manual WhatsApp time reduction | >80% | Owner self-report |
| Customer satisfaction | Positive tone in follow-up messages | Manual review |
| Orders per week (30 days post-launch) | >10 | orders table |

---

## Open Questions

| Question | Owner | Blocking? | Decision |
|----------|-------|-----------|----------|
| Does the store already have WhatsApp Business? Separate number needed for API | Store Owner | ✅ Yes — need number before Meta setup | TBD |
| What is the store name, address, hours for system prompt? | Store Owner | ✅ Yes — needed for agent config | TBD |
| Should orders reduce stock immediately on creation, or only on confirmation? | Product | Yes — affects inventory accuracy | ✅ **Stock reduces on owner confirmation only** — prevents phantom reductions from cancelled orders |
| Conversation history TTL — how long to keep context? 24h? 7 days? | Engineering | No | 7 days |
| Pending-order expiry window for `DA/NU` and button confirm/cancel | Engineering | No | 120 minutes default via env override |
| Should the agent handle complaints or only product Q&A? | Store Owner | No | TBD |

---

## Implementation Phases

### Phase 1 — Foundation (no WhatsApp yet)
1. Create `orders` + `conversation_history` tables in Supabase
2. Build Orders page in React app (list + confirm/cancel)
3. Build MCP Edge Functions (`search_products`, `create_pickup_order`, `get_store_info`)
4. Test agent logic end-to-end with direct API calls (no WhatsApp)

### Phase 2 — WhatsApp Integration
5. Set up Meta Business account + WhatsApp Cloud API
6. Build `whatsapp-webhook` Edge Function
7. Wire agent + MCP tools to webhook
8. End-to-end test with real WhatsApp messages

### Phase 3 — Polish
9. Conversation history for multi-turn context
10. Owner notification on new order
11. Customer confirmation/cancellation messages

---

## Implementation Status

### Done ✅
- `supabase/migrations/20260220000000_create_orders_tables.sql` — orders + conversation_history tables
- `src/types/orders.ts` — Order, OrderItem, CreateOrderInput types
- `src/lib/orders-api.ts` — CRUD: createOrder, confirmOrder (deducts stock), cancelOrder, getOrders
- `src/pages/OrdersPage.tsx` — owner view: list orders, confirm/cancel actions
- `api/whatsapp.ts` — Vercel webhook: Twilio + Claude Haiku AI loop + order creation + store price fix

### Remaining (GitHub Issues)

#### P0 — Blockers
- [x] **#123** Apply Supabase migration (done ✅)
- [x] **#124** Configure Twilio sandbox + Vercel env vars (done ✅)

#### P1 — Next up
- [x] **#120** OrdersPage real-time updates via Supabase Realtime (~30min)
- [x] **#121** WhatsApp reply to customer on owner confirm/cancel (~1h)
- [ ] **#122** Store info config (STORE_NAME/ADDRESS/HOURS in Vercel env vars) (~30min)
  - Runbook: `docs/runbooks/whatsapp_agent.md`

#### P2 — Quality & robustness
- [x] **#125** Validate Twilio request signature (security)
- [x] **#126** Avoid sending full inventory in every Claude prompt (performance)
- [x] **#127** Conversation history TTL / expiry (quality)
- [x] **#128** Suggest alternative products when item out of stock — R11 (UX)

---

## Changelog

### 0.4.0 (2026-03-17)
- Added state machine section with all cart-flow states and transitions
- Added `pending_selection` column to DB schema block
- Added BDD scenarios for all 9 state transitions
- Documented `handleCartPickupTime` as parallel cart-flow path (separate from LLM order path)
- Updated Architecture section: Meta WhatsApp Cloud API + Supabase Edge Functions → Twilio Content API + Vercel serverless (ADR-0007)
- Hardening since 0.3.0: cart-flow templates (list-picker parity for text + button), atomic `consume_pending_order` RPC, message deduplication, per-phone rate limiting, security hardening (`HMAC-SHA1`, path traversal guard), `storePendingProductSelection` → `Promise<boolean>` to prevent silent cart loss

### 0.3.0 (2026-02-23)
- Switched from Meta to Twilio (phone validation issues with Meta)
- Fixed store price: now shows tier price (price_50/70/100) instead of purchase cost
- End-to-end tested: ORD-001 created + cancelled successfully
- Closed #123 (migration applied) and #124 (Twilio configured)
- Added issues #125–#128 for security, performance, quality, UX improvements

### 0.2.0 (2026-02-22)
- Status → IN_PROGRESS
- Implemented: DB migration, types, orders API, OrdersPage, WhatsApp webhook with Claude AI loop
- Documented remaining work as GitHub issues #120–#124

### 0.1.1 (2026-02-20)
- Resolved open question: stock deducts on owner confirmation only (R06b)
- Added R06b as explicit P0 requirement with acceptance criteria

### 0.1.0 (2026-02-20)
- Initial draft based on brainstorm session
- Defined 4-component architecture: WhatsApp → Edge Function → Claude + MCP → Supabase
- Scoped v1 to pickup orders only (no delivery, no payment, no Instagram)
