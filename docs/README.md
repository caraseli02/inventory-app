# Documentation Home

Central index for the Grocery Inventory App documentation. Start here to find authoritative specs, onboarding instructions, and historical references. Specs under `docs/specs/` are the single source of truth; archival planning notes live in `docs/archive/`. Last validated: 2025-12-05.

## Quick Start
- [Project README](../README.md) — onboarding, setup, and run commands.
- [Environment Configuration](../.env.example) — required variables and safety reminders.
- [MVP Scope & Prioritization](specs/mvp_scope.md) — feature prioritization and launch blockers.

## Documentation Index
| Document | Purpose | Status | Owner | Last Reviewed | Authority |
| --- | --- | --- | --- | --- | --- |
| [Project README](../README.md) | Setup, scripts, environment basics | ACTIVE | TBD | 2025-12-05 | Authoritative |
| [Docs Home](README.md) | Central navigation and tracking | ACTIVE | TBD | 2025-12-05 | Authoritative |
| [Project Architecture & Structure](project_architecture_structure.md) | Reference architecture and code layout | ACTIVE | TBD | 2025-12-05 | Authoritative |
| [Project Review](project_review.md) | Findings from comprehensive review | ACTIVE | TBD | 2025-12-05 | Reference |
| [Walkthrough](walkthrough.md) | Implementation notes and flows | DRAFT | TBD | 2025-12-05 | Reference |
| [MVP Code Scaffolding](mvp_code_scaffolding.md) | Code examples and scaffolding guidance | ACTIVE | TBD | 2025-12-05 | Reference |
| [Project File List](project_file_list.md) | Current file inventory | ACTIVE | TBD | 2025-12-05 | Reference |
| [Documentation Home Spec](specs/documentation_home.md) | Requirements for this index | IN_PROGRESS | TBD | 2025-12-05 | Spec |

## Specifications (Authoritative)
| Spec | Version | Status | Owner | Last Updated | Notes |
| --- | --- | --- | --- | --- | --- |
| [Backend Proxy](specs/backend_proxy.md) | 0.1.0 (draft) | NOT_STARTED | TBD | 2025-12-05 | Protect Airtable credentials via proxy |
| [Validation Guardrails](specs/validation_guardrails.md) | 0.1.0 (draft) | NOT_STARTED | TBD | 2025-12-05 | Input sanitization requirements |
| [Scanner Error Handling](specs/scanner_error_handling.md) | 0.1.0 (draft) | PARTIAL | TBD | 2025-12-05 | Needs telemetry and UX edge cases |
| [Operations & Safety](specs/operations_safety.md) | 0.1.0 (draft) | NOT_STARTED | TBD | 2025-12-05 | Deployment/runbook details pending |
| [Observability](specs/observability.md) | 0.1.0 (draft) | NOT_STARTED | TBD | 2025-12-05 | Logging/metrics tracing guidance |
| [PWA Offline](specs/pwa_offline.md) | 0.1.0 (draft) | PARTIAL | TBD | 2025-12-05 | Manifest exists; caching strategy pending |
| [Scanner](specs/scanner.md) | 0.1.0 (draft) | PARTIAL | TBD | 2025-12-05 | BDD scenarios; implementation incomplete |
| [Product Management](specs/product_management.md) | 0.1.0 (draft) | PARTIAL | TBD | 2025-12-05 | BDD scenarios; implementation incomplete |
| [Stock Management](specs/stock_management.md) | 0.1.0 (draft) | PARTIAL | TBD | 2025-12-05 | BDD scenarios; implementation incomplete |
| [MVP Scope](specs/mvp_scope.md) | 0.1.0 (draft) | IN_PROGRESS | TBD | 2025-12-05 | Prioritization and launch criteria |

Versioning uses semantic versions for specs: `0.x` indicates drafts or partial implementations; `1.0.0` will mark fully implemented, validated specs.

## Security & Operations
- Operational safeguards and runbooks: [Operations & Safety](specs/operations_safety.md)
- Airtable exposure mitigation: [Backend Proxy](specs/backend_proxy.md)
- Validation and sanitization: [Validation Guardrails](specs/validation_guardrails.md)
- Monitoring and logging: [Observability](specs/observability.md)

## Architecture Decisions
- ADR index and template: [adrs/README.md](adrs/README.md)
- ADR-0001 — Airtable access via backend proxy: [adrs/ADR-0001-airtable-proxy.md](adrs/ADR-0001-airtable-proxy.md)

## Planning & Historical References
| Document | Status | Notes |
| --- | --- | --- |
| [grocery_inventory_mvp_plan.md](archive/grocery_inventory_mvp_plan.md) | HISTORICAL | Checklist format; superseded by specs and tracking here |
| [full_tailwind_shadcn_plan.md](archive/full_tailwind_shadcn_plan.md) | HISTORICAL | Original design exploration |
| [tailwind_shadcn_setup.md](archive/tailwind_shadcn_setup.md) | HISTORICAL | Setup notes; retained for reference |

## How to Use This Index
- Prefer documents marked **Authoritative** when guidance conflicts with drafts or historical notes.
- Update the Status and Last Reviewed fields when modifying documents to keep onboarding accurate.
- Cross-link new specs or guides here to maintain a single navigation entry point.
