# Architecture Decision Records (ADRs)

ADRs capture key technical decisions with their context, options, and consequences. Create a new ADR using the naming pattern `ADR-XXXX-title.md` with a monotonic number.

## Template

```markdown
# ADR-XXXX: Title

- **Status**: Proposed | Accepted | Superseded
- **Date**: YYYY-MM-DD
- **Deciders**: names/roles
- **Context**: What problem this solves and constraints.
- **Decision**: The chosen option.
- **Consequences**: Positive, negative, and follow-ups.
- **Alternatives Considered**: Briefly list rejected options and why.
```

## Index
- [ADR-0001: Airtable access via backend proxy](ADR-0001-airtable-proxy.md)
- [ADR-0002: Product field nullability from Airtable](ADR-0002-product-nullability.md)
- [ADR-0003: Code splitting strategy](ADR-0003-code-splitting-strategy.md)
- [ADR-0004: Git hook strategy](ADR-0004-git-hook-strategy.md)
- [ADR-0005: Invoice OCR architecture evolution](ADR-0005-invoice-ocr-architecture-evolution.md)
- [ADR-0006: EDA event-store pattern adoption](ADR-0006-eda-event-store.md)
- [ADR-0007: Twilio over Meta WhatsApp Cloud API](ADR-0007-twilio-over-meta.md)
