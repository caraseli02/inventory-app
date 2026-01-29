# 09. UI Pages - User Interface and Interactions

## UI Architecture

The frontend is built with Nuxt 3 + Vue 3 + Tailwind CSS:

```
app/pages/
├── index.vue        → Product Dashboard
├── actions.vue      → Human Review Interface
├── events.vue       → Event Log Explorer
├── time-travel.vue  → Historical State Debugger
├── sales.vue        → Sales Projections
└── analytics.vue    → Analytics Dashboard
```

## Page 1: Product Dashboard (index.vue)

**URL**: `/`

**Purpose**: Overview of current stock levels across all products.

### Features

```
┌──────────────────────────────────────────────────────────────┐
│  Product Dashboard                                            │
│  Current stock levels derived from X events                   │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ milk-2pct   │  │ bread-white │  │ eggs-dozen  │           │
│  │ 45 units    │  │ 100 units   │  │ 5 units     │           │
│  │ ████████░░  │  │ ██████████  │  │ █░░░░░░░░░  │           │
│  │ Updated 2h  │  │ Updated 1h  │  │ Updated 30m │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└──────────────────────────────────────────────────────────────┘
```

### Stock Status Colors

| Quantity | Badge Color | Bar Color |
|----------|-------------|-----------|
| 0 | Red | Red |
| 1-19 | Yellow | Yellow |
| 20-49 | Blue | Blue |
| 50+ | Green | Green |

### Data Flow

```typescript
// Fetches from projection
const { data: products } = await useFetch('/api/products/stock')

// Shows event count (for context)
const { data: eventsData } = await useFetch('/api/events')
```

### Getting Started Helper

If no products exist, shows a curl command:
```bash
curl -X POST http://localhost:3000/api/stock-level-changed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "apple-001",
    "delta": 100,
    "reason": "DELIVERY",
    "threshold": 20
  }'
```

## Page 2: Pending Actions (actions.vue)

**URL**: `/actions`

**Purpose**: Human-in-the-loop review interface.

### Features

```
┌──────────────────────────────────────────────────────────────┐
│  Pending Actions                                              │
│  Actions requiring human review and approval                  │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [REORDER]                    2024-01-15 10:30:00         ││
│  │                                                           ││
│  │ Product: milk-2pct                                        ││
│  │ Confidence: 92.0% ████████████████████░░                 ││
│  │ Reason: "Stock critically low (3/10). Recommend now."    ││
│  │ Experiment: GROCERY_OPT_V1 / A                            ││
│  │                                                           ││
│  │ [Approve]  [Reject]  [Refresh]                            ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Action Type Colors

| Action Type | Badge Color |
|-------------|-------------|
| REORDER | Blue |
| PRICE_INCREASE | Green |
| PRICE_DECREASE | Orange |

### Confidence Visualization

| Confidence | Bar Color |
|------------|-----------|
| ≥ 70% | Green |
| 50-69% | Yellow |
| < 50% | Red |

### Human Decision Flow

```typescript
async function handleDecision(actionId: string, decision: 'approve' | 'reject') {
  await $fetch('/api/human-decision', {
    method: 'POST',
    body: {
      actionId,
      decision,
      reviewerId: 'human-operator'
    }
  });
  await refresh();  // Reload list
}
```

### Key Context Displayed

- **Product ID**: Which product
- **Confidence**: Agent's certainty (with visual bar)
- **Reason**: Human-readable explanation
- **Suggested Change**: Price delta if applicable
- **Experiment**: For A/B testing tracking

## Page 3: Events Log (events.vue)

**URL**: `/events`

**Purpose**: Audit trail - view all events in the system.

### Features

- Filter by product ID
- Filter by event type
- Limit results
- View full event payloads

### Common Filters

```typescript
GET /api/events?productId=milk-2pct
GET /api/events?type=ActionProposed
GET /api/events?limit=50
```

## Page 4: Time Travel Debugger (time-travel.vue)

**URL**: `/time-travel`

**Purpose**: See system state at any point in history.

### Features

```
┌──────────────────────────────────────────────────────────────┐
│  Time Travel Debugger                                         │
│  Scrub through history to see state at any point              │
├──────────────────────────────────────────────────────────────┤
│  Timeline                           Selected: 2024-01-15 10:00 │
│  ●─────────────────────────────────────○                      │
│  2024-01-01                              2024-01-15           │
│                                                               │
│  [⏮ Start] [◀ Step Back] [Step Forward ▶] [Now ⏭]            │
├──────────────────────────────────────────────────────────────┤
│  Stock Levels (3 products)    │  Action States (5 actions)    │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐  │
│  │ milk-2pct: 50 units     │  │  │ REORDER: PROPOSED       │  │
│  │ bread: 100 units        │  │  │ PRICE_DEC: AUTHORIZED   │  │
│  └─────────────────────────┘  │  └─────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Events Up To This Point                                      │
│  [StockLevelChanged: 400] [ActionProposed: 80] [Authorized: 20]│
└──────────────────────────────────────────────────────────────┘
```

### How It Works

```typescript
// Slider position → timestamp
function getTimestampFromSlider(value: number): string {
  const start = new Date(bounds.firstEvent).getTime();
  const end = new Date(bounds.lastEvent).getTime();
  const position = value / timelineSteps;
  return new Date(start + (end - start) * position).toISOString();
}

// Fetch state at timestamp
const data = await $fetch('/api/state-at-time', {
  query: { timestamp }
});
```

### What It Demonstrates

**Event sourcing power**: The system rebuilds exact historical state by replaying events up to the selected timestamp. This is only possible because:
- Events are immutable
- State is derived from events
- Same events → same state

## Page 5: Sales Dashboard (sales.vue)

**URL**: `/sales`

**Purpose**: Daily sales aggregation from projections.

### Features

- View today's sales
- Select specific date
- View product history
- Aggregated metrics (units sold, delivered, transactions)

## Page 6: Analytics Dashboard (analytics.vue)

**URL**: `/analytics`

**Purpose**: Business insights from the analytics consumer.

### Sections

#### 1. Stock Health

| Product | Current Stock | Avg Daily Use | Days Until Stockout | Status |
|---------|---------------|---------------|---------------------|--------|
| milk-2pct | 45 | 20.00 | 2.3 | LOW |
| bread | 100 | 10.00 | 10.0 | HEALTHY |

**Health Statuses**:
- `HEALTHY` (green) - Normal stock levels
- `LOW` (yellow) - Below threshold
- `CRITICAL` (red) - Very low
- `OUT_OF_STOCK` (red) - Zero stock
- `OVERSTOCKED` (blue) - Excess inventory

#### 2. Product Velocity (7-Day Window)

| Product | Units Sold | Avg Per Day | Last Sale |
|---------|------------|-------------|-----------|
| milk-2pct | 140 | 20.00 | Jan 15, 10:00 |

#### 3. Agent Performance by Confidence

| Confidence Range | Total Proposals | Approved | Rejected | Approval Rate |
|------------------|-----------------|----------|----------|---------------|
| 0.9-1.0 | 50 | 48 | 2 | 96.0% |
| 0.7-0.8 | 30 | 25 | 5 | 83.3% |
| 0.5-0.7 | 20 | 10 | 10 | 50.0% |

**Insight**: Higher confidence correlates with higher approval rates.

#### 4. Decision Latency

Summary cards:
- Total Decisions
- Average Latency
- Min Latency
- Max Latency

Individual decision details with timing.

### Rebuild Button

```typescript
async function rebuildAnalytics() {
  await $fetch('/api/analytics/rebuild', { method: 'POST' });
  await fetchAnalytics();
}
```

**Why rebuild?** Analytics projections are independent from the main workflow. Rebuilding ensures they're synchronized with the event log.

## UI/UX Patterns

### 1. Loading States

All pages show spinners while fetching:
```vue
<div v-if="pending" class="text-center py-12">
  <div class="animate-spin ..."></div>
  <p>Loading...</p>
</div>
```

### 2. Empty States

Clear guidance when no data:
```vue
<div v-if="actions.length === 0">
  <p>All caught up!</p>
  <p>No actions currently require human review.</p>
</div>
```

### 3. Status Badges

Consistent color coding across pages:
```typescript
function getStatusClass(status: string) {
  const classes = {
    'PROPOSED': 'bg-purple-100 text-purple-800',
    'NEEDS_HUMAN_REVIEW': 'bg-orange-100 text-orange-800',
    'AUTHORIZED': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800',
  };
  return classes[status];
}
```

### 4. Toast Notifications

Success/error feedback:
```vue
<div v-if="successMessage" class="fixed bottom-4 right-4 bg-green-50 ...">
  {{ successMessage }}
</div>
```

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | UI = product delivery to users |
| **Spec Creation** | API contracts define what UI can do |
| **Systems Architecture** | UI reads projections, triggers workflows |
| **Context Engineering** | UI presents context for human decisions |
| **Workflow Orchestration** | Actions page is human-in-the-loop UI |

## Key Files

- `app/pages/index.vue` - Dashboard
- `app/pages/actions.vue` - Human review
- `app/pages/events.vue` - Event log
- `app/pages/time-travel.vue` - Debugger
- `app/pages/sales.vue` - Sales
- `app/pages/analytics.vue` - Analytics

## Mental Model

The UI is like a **control room**:
- Dashboard = overview monitors
- Actions = decision console
- Events = activity log
- Time Travel = flight recorder playback
- Analytics = business intelligence screens
