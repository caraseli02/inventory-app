# Documentation Home

Central index for the Grocery Inventory App documentation. Start here to find authoritative specs, onboarding instructions, current project status, and historical references. `docs/project-status.md` is the canonical handoff/control document, `docs/plans/` holds implementation records, and `docs/solutions/` holds resolved learnings. Last validated: 2026-03-29.

## Quick Start
- [Project README](../README.md) — onboarding, setup, and run commands.
- [Project Status](project-status.md) — canonical current priorities, active work, and next steps.
- [Launch Checklist](../LAUNCH_CHECKLIST.md) — **ship to production this week** (step-by-step guide).
- [Lean MVP Scope](specs/mvp_scope_lean.md) — **ACTIVE** - what ships this week.
- [Environment Configuration](../.env.example) — required variables and safety reminders.

## Documentation Index
| Document | Purpose | Status | Owner | Last Reviewed | Authority |
| --- | --- | --- | --- | --- | --- |
| [Project README](../README.md) | Setup, scripts, environment basics | ACTIVE | TBD | 2025-12-05 | Authoritative |
| [Project Status](project-status.md) | Current priorities, active work, handoff layer | ACTIVE | TBD | 2026-03-29 | Canonical control doc |
| [Docs Home](README.md) | Central navigation and documentation entrypoint | ACTIVE | TBD | 2026-03-29 | Authoritative |
| [Project Architecture & Structure](project_architecture_structure.md) | Reference architecture and code layout | ACTIVE | TBD | 2025-12-05 | Authoritative |
| [Project Review](project_review.md) | Findings from comprehensive review | ACTIVE | TBD | 2025-12-05 | Reference |
| [Walkthrough](walkthrough.md) | Implementation notes and flows | DRAFT | TBD | 2025-12-05 | Reference |
| [MVP Code Scaffolding](mvp_code_scaffolding.md) | Code examples and scaffolding guidance | ACTIVE | TBD | 2025-12-05 | Reference |
| [Project File List](project_file_list.md) | Current file inventory | ACTIVE | TBD | 2025-12-05 | Reference |
| [Documentation Home Spec](specs/documentation_home.md) | Requirements for this index | IN_PROGRESS | TBD | 2025-12-05 | Spec |

## Specifications (Authoritative)
| Spec | Version | Status | Owner | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| [**Lean MVP Scope**](specs/mvp_scope_lean.md) | **1.0.0** | **ACTIVE** | TBD | 2025-12-05 | **Ship this week - launch-ready scope** |
| [MVP Scope (original)](specs/mvp_scope.md) | 0.1.0 (draft) | SUPERSEDED | TBD | 2025-12-05 | Replaced by lean MVP scope |
| [Scanner](specs/scanner.md) | 0.1.0 (draft) | COMPLETE | TBD | 2025-12-05 | Implemented and working |
| [Product Management](specs/product_management.md) | 0.1.0 (draft) | COMPLETE | TBD | 2025-12-05 | Implemented and working |
| [Stock Management](specs/stock_management.md) | 0.1.0 (draft) | COMPLETE | TBD | 2025-12-05 | Implemented and working |
| [Backend Proxy](specs/backend_proxy.md) | 0.1.0 (draft) | POST_MVP | TBD | 2025-12-05 | Deferred until post-validation |
| [Validation Guardrails](specs/validation_guardrails.md) | 0.1.0 (draft) | POST_MVP | TBD | 2025-12-05 | Basic validation sufficient for MVP |
| [Scanner Error Handling](specs/scanner_error_handling.md) | 0.1.0 (draft) | COMPLETE | TBD | 2025-12-05 | Basic error handling implemented |
| [Operations & Safety](specs/operations_safety.md) | 0.1.0 (draft) | POST_MVP | TBD | 2025-12-05 | Launch checklist covers MVP needs |
| [Observability](specs/observability.md) | 0.1.0 (draft) | POST_MVP | TBD | 2025-12-05 | Console logging sufficient for MVP |
| [PWA Offline](specs/pwa_offline.md) | 0.1.0 (draft) | POST_MVP | TBD | 2025-12-05 | Online-only for MVP validation |
| [**xlsx Integration**](specs/xlsx_integration.md) | **1.0.0** | **IN_PROGRESS** | TBD | 2025-12-12 | **Phase 1 - Import/Export with SheetJS** |
| [**WhatsApp AI Agent**](specs/whatsapp_agent.md) | **0.3.0** | **IN_PROGRESS** | TBD | 2026-03-12 | Customer Q&A + pickup orders via WhatsApp + MCP (Twilio/Vercel) |
| [**Checkout Flow**](specs/checkout_flow.md) | 0.1.0 | IN_PROGRESS | TBD | 2026-02-01 | Multi-item checkout with pricing tiers |
| [**Invoice Import API Contract**](specs/invoice-import-api-contract.md) | 0.1.0 | IN_PROGRESS | TBD | 2026-02-12 | FastAPI OCR service API contract |
| [**Duplicate Prevention Strategy**](specs/duplicate-prevention-strategy.md) | 0.1.0 | IN_PROGRESS | TBD | 2026-03-01 | Dedup strategy for WhatsApp orders and invoice imports |

Versioning uses semantic versions for specs: `0.x` indicates drafts or partial implementations; `1.0.0` will mark fully implemented, validated specs.

## Security & Operations
- Operational safeguards and runbooks: [Operations & Safety](specs/operations_safety.md)
- Airtable exposure mitigation: [Backend Proxy](specs/backend_proxy.md)
- Validation and sanitization: [Validation Guardrails](specs/validation_guardrails.md)
- Monitoring and logging: [Observability](specs/observability.md)

## Architecture Decisions
- ADR index and template: [adrs/README.md](adrs/README.md)
- ADR-0001 — Airtable access via backend proxy: [adrs/ADR-0001-airtable-proxy.md](adrs/ADR-0001-airtable-proxy.md)
- ADR-0002 — Product field nullability: [adrs/ADR-0002-product-nullability.md](adrs/ADR-0002-product-nullability.md)
- ADR-0003 — Code splitting strategy: [adrs/ADR-0003-code-splitting-strategy.md](adrs/ADR-0003-code-splitting-strategy.md)
- ADR-0004 — Git hook strategy: [adrs/ADR-0004-git-hook-strategy.md](adrs/ADR-0004-git-hook-strategy.md)
- ADR-0005 — Invoice OCR architecture evolution: [adrs/ADR-0005-invoice-ocr-architecture-evolution.md](adrs/ADR-0005-invoice-ocr-architecture-evolution.md)
- ADR-0006 — EDA event-store pattern: [adrs/ADR-0006-eda-event-store.md](adrs/ADR-0006-eda-event-store.md)
- ADR-0007 — Twilio over Meta WhatsApp Cloud API: [adrs/ADR-0007-twilio-over-meta.md](adrs/ADR-0007-twilio-over-meta.md)

## Planning & Historical References
| Document | Status | Notes |
| --- | --- | --- |
| [project-status.md](project-status.md) | ACTIVE | Canonical control tower above plans and solutions |
| [grocery_inventory_mvp_plan.md](archive/grocery_inventory_mvp_plan.md) | HISTORICAL | Checklist format; superseded by specs and tracking here |
| [full_tailwind_shadcn_plan.md](archive/full_tailwind_shadcn_plan.md) | HISTORICAL | Original design exploration |
| [tailwind_shadcn_setup.md](archive/tailwind_shadcn_setup.md) | HISTORICAL | Setup notes; retained for reference |

## How to Use This Index
- Prefer documents marked **Authoritative** when guidance conflicts with drafts or historical notes.
- Use `project-status.md` to answer "what is active now?" before drilling into `docs/plans/` or `docs/solutions/`.
- Update the Status and Last Reviewed fields when modifying documents to keep onboarding accurate.
- Cross-link new specs or guides here to maintain a single navigation entry point.
