# ADR-0002: Product field nullability from Airtable

- **Status**: Accepted
- **Date**: 2025-02-16
- **Deciders**: Engineering
- **Context**: Airtable rows for products occasionally omit optional attributes such as pricing, categorisation, supplier details, or stock thresholds. Our frontend typed these fields as required, which risked runtime failures or misleading displays when Airtable omitted them.
- **Decision**: Treat non-essential Airtable columns (`Price`, `Category`, `Current Stock`, `Ideal Stock`, `Min Stock Level`, `Supplier`, `Expiry Date`) as optional in the shared `Product` type. UI surfaces fall back to neutral labels (e.g., “Uncategorized”, “Price unavailable”, “No expiry date”) and default numeric calculations to zero where appropriate.
- **Consequences**: TypeScript now tolerates missing Airtable properties, and runtime views no longer throw or show misleading zero-values when Airtable omits data. Future features should continue to use defensive checks for these optional fields and extend this ADR if additional fields become nullable.
- **Alternatives Considered**:
  - Keep fields required and enforce Airtable data completeness (rejected: Airtable data is not reliably populated yet).
  - Coerce missing values to zero/empty strings globally (rejected: obscures data quality issues and can mislead users).
