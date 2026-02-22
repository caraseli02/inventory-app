# Feature: WhatsApp AI Agent for Customer Q&A & Pickup Orders

**Version**: 0.2.0
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2026-02-22
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

**R04 — Pickup Order Creation**
Customer can place a pickup order by specifying items and pickup time. Order is saved to Supabase `orders` table.

*Acceptance criteria:*
- Given a customer requests to order specific items
- When the agent collects: item(s), quantity, customer name, pickup time
- Then an order record is created in Supabase with status `pending`
- And customer receives confirmation with order number and total price

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

```
WhatsApp Cloud API (Meta)
        ↓ webhook POST
Supabase Edge Function: whatsapp-webhook
        ↓ message + conversation history
Claude API (Haiku model)
  + System prompt (store config)
  + MCP Tools ──────────────────────────────────────────┐
        ↓ tool calls                                     │
Supabase Edge Functions (MCP Server):                   │
  - search_products(query: string)                      │
  - get_product_details(product_id: string)             │
  - create_pickup_order(items, name, pickup_time)       │
  - get_store_info()                                    │
        ↓ data                                          │
Supabase PostgreSQL (existing tables + new orders table)│
        ↑                                               │
React App (new Orders page) ─────────────────────────── ┘
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

**`conversation_history`** (for multi-turn context)
```sql
id            uuid PRIMARY KEY
phone_number  text NOT NULL
messages      jsonb NOT NULL       -- [{role, content, timestamp}]
updated_at    timestamptz DEFAULT now()
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
| Conversation history TTL — how long to keep context? 24h? 7 days? | Engineering | No | TBD |
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
- `api/whatsapp.ts` — Vercel webhook: Meta verification + Claude Haiku AI loop + order creation

### Remaining (GitHub Issues)
- [ ] **#123** Apply Supabase migration (P0 blocker — 5min setup)
- [ ] **#124** Configure Meta WhatsApp Cloud API + Vercel env vars (P0 blocker — 30min setup)
- [ ] **#120** OrdersPage real-time updates via Supabase Realtime (P1 — 30min)
- [ ] **#121** WhatsApp reply to customer on owner confirm/cancel (P1 — 1h)
- [ ] **#122** Store info config (name, address, hours) in env vars (P1 — 30min)

---

## Changelog

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
