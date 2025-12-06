# ADR-0002: Product field nullability from Airtable

- **Status**: Accepted
- **Date**: 2025-12-06
- **Deciders**: Engineering
- **Context**: Airtable rows for products occasionally omit optional attributes such as pricing, categorisation, supplier details, or stock thresholds. Our frontend typed these fields as required, which risked runtime failures or misleading displays when Airtable omitted them.
- **Decision**: Treat non-essential Airtable columns (`Price`, `Category`, `Current Stock`, `Ideal Stock`, `Min Stock Level`, `Supplier`, `Expiry Date`) as optional in the shared `ProductFields` interface. UI surfaces fall back to neutral labels (e.g., "Uncategorized", "Price unavailable", "No expiry date") and default numeric calculations to zero where appropriate.
- **Consequences**: TypeScript now tolerates missing Airtable properties, and runtime views no longer throw or show misleading zero-values when Airtable omits data.

  **Implementation pattern**: Components use defensive checks and fallback values:
  - **Prices**: `if (price != null) ? `$${price.toFixed(2)}` : 'Price unavailable'`
  - **Categories**: `category || 'Uncategorized'`
  - **Dates**: `expiryDate || 'No expiry date'`

  **Single source of truth**: The `ProductFields` interface (src/types/index.ts) is the authoritative definition of which fields are required vs optional. Both creation DTOs and retrieved products reference this interface.

  Future features should continue to use this pattern for optional fields. If additional fields become nullable, update `ProductFields` and extend this ADR with new fallback patterns.

- **Alternatives Considered**:
  - Keep fields required and enforce Airtable data completeness (rejected: Airtable data is not reliably populated yet).
  - Coerce missing values to zero/empty strings globally (rejected: obscures data quality issues and can mislead users).
