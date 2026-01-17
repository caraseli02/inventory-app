# 08. API Endpoints - HTTP Interface Layer

## API Design Principles

The API layer follows strict rules:

```
┌─────────────────────────────────────────────────────────────────┐
│                    API CONTRACT                                  │
│                                                                  │
│  ✅ CAN: Validate and normalize input                            │
│  ✅ CAN: Delegate to core workflow/projections                   │
│  ✅ CAN: Transform output for clients                            │
│                                                                  │
│  ❌ CANNOT: Contain business logic                               │
│  ❌ CANNOT: Bypass workflow (emit events directly)               │
│  ❌ CANNOT: Mutate database directly                             │
└─────────────────────────────────────────────────────────────────┘
```

**Philosophy**: "HTTP is ingress only. No business rules live here."

## Endpoint Categories

| Category | Purpose | Pattern |
|----------|---------|---------|
| **Ingress** | Accept external events | POST → workflow |
| **Query** | Read projections | GET → projections |
| **Debug** | Time-travel, events | GET → events |
| **Analytics** | Business insights | GET → analytics projections |

## Ingress Endpoints

### POST /api/stock-level-changed

**File**: `server/api/stock-level-changed.post.ts`

**Purpose**: External entry point for stock updates.

```typescript
// Request
POST /api/stock-level-changed
{
  "productId": "milk-2pct",    // Required
  "delta": -5,                  // Required (or provide currentLevel)
  "reason": "SALE",             // Optional: SALE, DELIVERY, ADJUSTMENT
  "threshold": 10,              // Optional: reorder threshold
  "source": "pos-register-1"    // Optional: where this came from
}

// Alternative: provide currentLevel instead of delta
{
  "productId": "milk-2pct",
  "currentLevel": 45,           // System calculates delta from projection
  "previousLevel": 50,          // Optional: override baseline
  "reason": "SALE"
}

// Response
{
  "success": true,
  "eventId": "evt-abc123",
  "proposedActionIds": ["act-xyz789"],
  "message": "Stock level change recorded"
}
```

**Flow**:
1. Validate/normalize input
2. Calculate delta if not provided
3. Delegate to `handleStockLevelChanged()`
4. Return event ID and proposal IDs

### POST /api/human-decision

**File**: `server/api/human-decision.post.ts`

**Purpose**: Record human approval/rejection.

```typescript
// Request
POST /api/human-decision
{
  "actionId": "act-xyz789",    // Required
  "decision": "APPROVED",       // Required: APPROVED or REJECTED
  "reviewerId": "user-john"     // Required (or "humanId")
}

// Response
{
  "success": true,
  "actionId": "act-xyz789",
  "decision": "approved"
}
```

**Decision normalization**:
- Accepts: `approve`, `APPROVE`, `approved`, `APPROVED`
- Accepts: `reject`, `REJECT`, `rejected`, `REJECTED`

**Error responses**:
- 400: Missing fields
- 404: Action not found
- 409: Missing proposal data

## Query Endpoints

### GET /api/events

**File**: `server/api/events.get.ts`

**Purpose**: Query the immutable event log (audit/debug).

```typescript
// Query by product
GET /api/events?productId=milk-2pct&limit=50

// Query by event type
GET /api/events?type=ActionProposed

// Get all events (use with care)
GET /api/events?limit=100

// Response
{
  "events": [
    {
      "id": "evt-abc123",
      "type": "StockLevelChanged",
      "ts": "2024-01-15T10:30:00Z",
      "aggregateType": "Product",
      "aggregateId": "milk-2pct",
      "payload": { "productId": "milk-2pct", "delta": -5, "reason": "SALE" }
    }
  ],
  "count": 1
}
```

### GET /api/actions/pending

**File**: `server/api/actions/pending.get.ts`

**Purpose**: Query actions needing review or by status.

```typescript
// Get actions needing human review
GET /api/actions/pending?status=NEEDS_HUMAN_REVIEW

// Filter by product
GET /api/actions/pending?productId=milk-2pct&status=NEEDS_HUMAN_REVIEW

// Other statuses
GET /api/actions/pending?status=PROPOSED
GET /api/actions/pending?status=AUTHORIZED
GET /api/actions/pending?status=REJECTED
GET /api/actions/pending?status=EXECUTED

// Response
{
  "actions": [
    {
      "id": "act-xyz789",
      "productId": "milk-2pct",
      "actionType": "REORDER",
      "status": "NEEDS_HUMAN_REVIEW",
      "ts": "2024-01-15T10:30:00Z",
      "proposed": {
        "actionId": "act-xyz789",
        "productId": "milk-2pct",
        "actionType": "REORDER",
        "confidence": 0.92,
        "reason": "Stock critically low (3/10). Recommend reorder now."
      }
    }
  ],
  "count": 1
}
```

**Key feature**: Includes the original proposal payload for context.

### GET /api/products/stock

**File**: `server/api/products/stock.get.ts`

**Purpose**: Get current stock for all products.

```typescript
// Request
GET /api/products/stock

// Response
[
  {
    "productId": "milk-2pct",
    "quantity": 45,
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  {
    "productId": "bread-white",
    "quantity": 100,
    "updatedAt": "2024-01-15T09:00:00Z"
  }
]
```

### GET /api/products/[productId]/stock

**File**: `server/api/products/[productId]/stock.get.ts`

**Purpose**: Get stock for a specific product.

```typescript
// Request
GET /api/products/milk-2pct/stock

// Response
{
  "productId": "milk-2pct",
  "quantity": 45,
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### GET /api/sales

**File**: `server/api/sales.get.ts`

**Purpose**: Query daily sales projection.

```typescript
// Get today's sales
GET /api/sales

// Get specific day
GET /api/sales?day=2024-01-15

// Get product history
GET /api/sales?productId=milk-2pct

// Response (by day)
{
  "day": "2024-01-15",
  "sales": [
    {
      "productId": "milk-2pct",
      "totalSold": 25,
      "totalDelivered": 50,
      "transactionCount": 10
    }
  ],
  "summary": {
    "totalProductsSold": 1,
    "totalUnitsSold": 25,
    "totalUnitsDelivered": 50,
    "totalTransactions": 10
  }
}

// Response (by product)
{
  "productId": "milk-2pct",
  "history": [
    { "day": "2024-01-15", "totalSold": 25, "totalDelivered": 50, "transactionCount": 10 },
    { "day": "2024-01-14", "totalSold": 20, "totalDelivered": 0, "transactionCount": 8 }
  ],
  "totalSold": 45,
  "totalDelivered": 50
}
```

## Debug/Time-Travel Endpoints

### GET /api/state-at-time

**File**: `server/api/state-at-time.get.ts`

**Purpose**: Time-travel debugging - see state at any point in history.

```typescript
// Request
GET /api/state-at-time?timestamp=2024-01-15T10:00:00Z

// Response
{
  "requestedTimestamp": "2024-01-15T10:00:00Z",
  "bounds": {
    "firstEvent": "2024-01-01T00:00:00Z",
    "lastEvent": "2024-01-15T12:00:00Z",
    "totalEvents": 1234
  },
  "eventsProcessed": 500,
  "eventCounts": {
    "StockLevelChanged": 400,
    "ActionProposed": 80,
    "ActionAuthorized": 20
  },
  "state": {
    "stockLevels": [
      { "productId": "milk-2pct", "quantity": 50, "updatedAt": "2024-01-15T09:30:00Z" }
    ],
    "actions": [
      { "actionId": "act-xyz", "productId": "milk-2pct", "status": "PROPOSED", "timestamp": "..." }
    ]
  }
}
```

**Power of event sourcing**: Rebuilds exact state by replaying events up to timestamp.

## Analytics Endpoints

### GET /api/analytics/velocity

**Purpose**: Product sales velocity.

```typescript
GET /api/analytics/velocity?productId=milk-2pct

// Response
{
  "velocity": [
    {
      "productId": "milk-2pct",
      "windowDays": 7,
      "unitsSold": 140,
      "avgPerDay": 20.0,
      "firstSaleTs": "2024-01-08T...",
      "lastSaleTs": "2024-01-15T...",
      "lastUpdated": "2024-01-15T..."
    }
  ]
}
```

### GET /api/analytics/health

**Purpose**: Stock health analysis.

```typescript
GET /api/analytics/health?productId=milk-2pct

// Response
{
  "health": [
    {
      "productId": "milk-2pct",
      "currentStock": 45,
      "avgDailyConsumption": 20.0,
      "daysUntilStockout": 2.25,
      "healthStatus": "LOW",
      "lastUpdated": "2024-01-15T..."
    }
  ]
}
```

**Health statuses**: `HEALTHY`, `LOW`, `CRITICAL`, `OUT_OF_STOCK`

### GET /api/analytics/performance

**Purpose**: Agent confidence vs approval metrics.

```typescript
GET /api/analytics/performance

// Response
{
  "performance": [
    {
      "confidenceBucket": "0.9-1.0",
      "totalProposals": 50,
      "approvedCount": 48,
      "rejectedCount": 2,
      "approvalRate": 0.96,
      "lastUpdated": "2024-01-15T..."
    }
  ]
}
```

### GET /api/analytics/latency

**Purpose**: Decision latency tracking.

```typescript
GET /api/analytics/latency?productId=milk-2pct

// Response
{
  "latency": [
    {
      "actionId": "act-xyz789",
      "productId": "milk-2pct",
      "actionType": "REORDER",
      "confidence": 0.92,
      "proposedAt": "2024-01-15T10:00:00Z",
      "decidedAt": "2024-01-15T10:15:00Z",
      "latencySeconds": 900,
      "decision": "APPROVED",
      "lastUpdated": "2024-01-15T..."
    }
  ]
}
```

### POST /api/analytics/rebuild

**Purpose**: Rebuild analytics projections from events.

```typescript
POST /api/analytics/rebuild

// Response
{
  "success": true,
  "message": "Analytics projections rebuilt",
  "eventsProcessed": 1234
}
```

### POST /api/sales/rebuild

**Purpose**: Rebuild sales projections from events.

```typescript
POST /api/sales/rebuild

// Response
{
  "success": true,
  "message": "Sales projections rebuilt"
}
```

## Error Handling

All endpoints follow consistent error patterns:

```typescript
// 400 - Bad Request (validation)
{
  "statusCode": 400,
  "message": "Missing required field: productId"
}

// 404 - Not Found
{
  "statusCode": 404,
  "message": "Action act-xyz789 not found"
}

// 409 - Conflict
{
  "statusCode": 409,
  "message": "Action act-xyz789 is missing proposal data"
}
```

## API Layer Pattern

All endpoints follow this structure:

```typescript
export default defineEventHandler(async (event) => {
  // 1. Parse and validate input
  const body = await readBody(event);
  if (!body.requiredField) {
    throw createError({ statusCode: 400, message: "..." });
  }

  // 2. Normalize input
  const normalized = body.field.toUpperCase();

  // 3. Delegate to core (workflow/projection)
  const result = coreFunction(normalized);

  // 4. Handle errors
  if (!result.ok) {
    throw createError({ statusCode: 404, message: "..." });
  }

  // 5. Return response
  return { success: true, data: result };
});
```

## Five Dimensions Connection

| Dimension | How It Applies |
|-----------|----------------|
| **Product Management** | APIs enable the product features |
| **Spec Creation** | API contracts define input/output |
| **Systems Architecture** | Thin layer, delegates to core |
| **Context Engineering** | APIs provide context to frontends |
| **Workflow Orchestration** | POST endpoints trigger workflows |

## Key Files

- `server/api/stock-level-changed.post.ts` - Main ingress
- `server/api/human-decision.post.ts` - Human decisions
- `server/api/events.get.ts` - Event log queries
- `server/api/actions/pending.get.ts` - Action status
- `server/api/state-at-time.get.ts` - Time travel
- `server/api/analytics/*.ts` - Analytics endpoints

## Mental Model

APIs are like **restaurant waiters**:
- Take orders (validate input)
- Pass to kitchen (delegate to core)
- Serve dishes (return responses)
- Never cook themselves (no business logic)
