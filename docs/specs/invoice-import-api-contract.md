# Invoice Import API Contract (MVP - Simple Mode)

Date: 2026-02-11
Status: MVP Scope
Related Plan: `docs/plans/2026-02-11-feat-invoice-import-pricing-parity-plan.md`

## Scope (Build Now)
- `POST /extract`: add `row_id` and optional `weight_kg_candidate`.
- `POST /invoice/preview-pricing`: validate + compute prices; row status `ok` or `needs_input`.
- Frontend performs final DB writes using existing app API layer (Supabase/Airtable path).
- Matching for writes is handled in frontend import flow: barcode first, else normalized name, else create.
- Rounding from preview response fixed to 4 decimals.

## Deferred (v2)
- backend `POST /invoice/import` transactional write endpoint
- backend idempotency record table and replay behavior
- parse confidence / size token / preview match hints
- rich error taxonomy + advanced warnings

## Constants (Server-Side for Preview)
- `FX_LEI_TO_EUR = 19.5`
- `TRANSPORT_RATE_PER_KG = 1.5`
- Liquid approximation: `1L = 1kg`, `1000ml = 1kg`

## Endpoint 1: Extract (extended)
`POST /extract`

Request:
- `multipart/form-data`
- field `file` (PDF)

Response `200` (MVP fields):
```json
{
  "supplier": "JLC",
  "invoice_number": "INV-2026-001",
  "date": "2026-02-11",
  "total_amount": 1234.56,
  "products": [
    {
      "row_id": "r1",
      "name": "200G UNT CIOCOLATA JLC",
      "quantity": 10,
      "unit_price": 20.0,
      "total_price": 200.0,
      "raw_code": "1234567890123",
      "weight_kg_candidate": 0.2
    }
  ]
}
```

Notes:
- `weight_kg_candidate` is optional (`null`/missing allowed).

## Endpoint 2: Preview Pricing
`POST /invoice/preview-pricing`

Request:
```json
{
  "invoice_meta": {
    "supplier": "JLC",
    "invoice_number": "INV-2026-001",
    "date": "2026-02-11"
  },
  "rows": [
    {
      "row_id": "r1",
      "name": "200G UNT CIOCOLATA JLC",
      "barcode": "1234567890123",
      "quantity": 10,
      "line_total_lei": 200.0,
      "weight_kg": 0.2
    }
  ]
}
```

Response `200`:
```json
{
  "rows": [
    {
      "row_id": "r1",
      "status": "ok",
      "computed": {
        "base_price_eur": 1.0256,
        "transport_eur": 0.3000,
        "price_50": 1.9884,
        "price_70": 2.2535,
        "price_100": 2.6512
      }
    },
    {
      "row_id": "r2",
      "status": "needs_input",
      "computed": null
    }
  ]
}
```

Row status enum:
- `ok`
- `needs_input`

## Error Model (MVP)
Error response:
```json
{
  "error": {
    "code": "MISSING_WEIGHT",
    "message": "Weight is required"
  }
}
```

Supported codes (preview path):
- `INVALID_PAYLOAD`
- `MISSING_WEIGHT`
- `INTERNAL_ERROR`

## Frontend Expectations
- Keep weight editable per row.
- Call `preview-pricing` before import confirm.
- Block import when any row status is `needs_input`.
- Use preview `computed` values as source for persisted pricing.
- Persist rows through existing frontend DB APIs (create/update + stock movement).
