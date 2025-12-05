# Documentation & Specs Review - Action Plan

**Date**: 2025-12-05
**Status**: COMPLETED
**Purpose**: Systematic fixes for documentation and spec issues identified in comprehensive review

---

## 🎯 Executive Summary

**Verdict**: Specs are production-ready, but critical documentation infrastructure gaps block effective implementation and onboarding.

**Strengths**:
- ✅ Excellent technical spec quality (clear, comprehensive, testable)
- ✅ Sound MVP prioritization (security → validation → UX → ops)
- ✅ Good use of BDD scenarios for feature specs
- ✅ Architecture well-documented

**Critical Gaps**:
- ❌ Documentation infrastructure incomplete (README, docs home, .env.example)
- ❌ No implementation status tracking
- ❌ Overlapping/fragmented planning documents
- ❌ Missing operational files for deployment

---

## 🚨 CRITICAL BLOCKERS (Must Fix Before Implementation)

### 1. README.md is Default Vite Template
**Problem**: New contributors have no project context, setup instructions, or environment requirements.

**Impact**: Blocks contributor onboarding and violates `operations_safety.md` requirements.

**Action Items**:
- [x] Replace Vite template content with project-specific overview
- [x] Add prerequisites (Node.js version, pnpm/npm)
- [x] Add installation instructions
- [x] Add environment setup section (reference .env.example)
- [x] Add "How to Run" section (dev, build, preview)
- [x] Add link to Documentation Home
- [x] Add known limitations section
- [x] Add security warning about Airtable proxy requirement

**Acceptance Criteria**:
- [x] No Vite template text remains
- [x] A new developer can set up and run the app following README alone
- [x] Environment variables are documented with examples

---

### 2. Missing .env.example File
**Problem**: No template for required environment variables; violates `operations_safety.md` spec.

**Impact**: Blocks deployment, makes local setup error-prone, risks secret exposure.

**Action Items**:
- [x] Create `.env.example` in project root
- [x] Document all required variables with placeholder values
- [x] Add comments explaining each variable's purpose
- [x] Add security warnings (never commit .env)
- [x] Update `.gitignore` to ensure `.env` is ignored
- [x] Reference from README.md

**Required Variables**:
```env
# Airtable Configuration (TEMPORARY - will be moved to backend proxy)
VITE_AIRTABLE_API_KEY=your_airtable_personal_token_here
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Backend Proxy (when implemented - see docs/specs/backend_proxy.md)
# VITE_BACKEND_PROXY_URL=http://localhost:3001
# VITE_PROXY_AUTH_TOKEN=your_secure_token_here
```

**Acceptance Criteria**:
- [x] .env.example exists and is committed
- [x] .env is in .gitignore
- [x] All currently used env vars are documented
- [x] Comments explain security implications

---

### 3. Documentation Home Not Implemented
**Problem**: `docs/specs/documentation_home.md` exists as a SPEC describing what should exist, but the actual home page/index is missing.

**Impact**: No single entry point for documentation; contributors don't know what's authoritative.

**Action Items**:
- [x] Create `docs/README.md` as the actual Documentation Home
- [x] Add table of all documentation with status indicators
- [x] Add table of all specs with implementation status
- [x] Cross-link to all major documents
- [x] Add "last validated" dates for each doc
- [x] Mark authoritative vs. draft/planning content
- [x] Link to MVP scope/prioritization prominently
- [x] Add security/operations guidance links

**Suggested Structure**:
```markdown
# Documentation Home

## Quick Start
- [Project README](../README.md)
- [Setup & Installation](../README.md#installation)
- [Environment Configuration](../.env.example)

## Architecture
- [Project Architecture & Structure](project_architecture_structure.md)
- [Project Review](project_review.md)

## Specifications (Authoritative)

### MVP-Critical
| Spec | Status | Owner | Last Updated | Notes |
|------|--------|-------|--------------|-------|
| [Backend Proxy](specs/backend_proxy.md) | NOT_STARTED | TBD | 2025-12-05 | Blocks production |
| [Validation Guardrails](specs/validation_guardrails.md) | NOT_STARTED | TBD | 2025-12-05 | - |
| [Scanner Error Handling](specs/scanner_error_handling.md) | PARTIAL | TBD | 2025-12-05 | Basic impl exists |
| [Operations & Safety](specs/operations_safety.md) | NOT_STARTED | TBD | 2025-12-05 | Needs runbooks |

### Nice-to-Have
| Spec | Status | Owner | Last Updated | Notes |
|------|--------|-------|--------------|-------|
| [Documentation Home](specs/documentation_home.md) | IN_PROGRESS | TBD | 2025-12-05 | This file |
| [Observability](specs/observability.md) | NOT_STARTED | TBD | 2025-12-05 | - |
| [PWA Offline](specs/pwa_offline.md) | PARTIAL | TBD | 2025-12-05 | Manifest only |

### Feature Specs (BDD)
- [Scanner](specs/scanner.md) - PARTIAL
- [Product Management](specs/product_management.md) - PARTIAL
- [Stock Management](specs/stock_management.md) - PARTIAL

## Planning & Reference (Historical)
- [MVP Plan Checklist](archive/grocery_inventory_mvp_plan.md) - SUPERSEDED by specs/
- [Tailwind/Shadcn Setup](archive/tailwind_shadcn_setup.md)
- [Walkthrough](walkthrough.md)
```

**Acceptance Criteria**:
- [x] docs/README.md exists and is comprehensive
- [x] All specs are listed with current status
- [x] Clear distinction between authoritative specs and planning docs
- [x] Navigation is obvious from project README

---

## 📋 HIGH PRIORITY (Fix Before MVP Implementation)

### 4. Add Status Tracking to All Specs
**Problem**: Specs don't indicate implementation status, owner, or last update date.

**Impact**: No way to track progress; unclear what's done vs. planned.

**Action Items**:
- [x] Add standard header to all spec files
- [x] Define status values: NOT_STARTED | IN_PROGRESS | IMPLEMENTED | VERIFIED
- [x] Audit current implementation and set accurate statuses
- [x] Add owner field (can be TBD initially)
- [x] Add last updated date

**Standard Header Template**:
```markdown
# [Spec Title]

**Status**: NOT_STARTED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [Links to related specs]

## Objective
...
```

**Files to Update**:
- [x] docs/specs/backend_proxy.md
- [x] docs/specs/validation_guardrails.md
- [x] docs/specs/scanner_error_handling.md
- [x] docs/specs/operations_safety.md
- [x] docs/specs/documentation_home.md
- [x] docs/specs/observability.md
- [x] docs/specs/pwa_offline.md
- [x] docs/specs/scanner.md
- [x] docs/specs/product_management.md
- [x] docs/specs/stock_management.md
- [x] docs/specs/mvp_scope.md

**Acceptance Criteria**:
- [x] All specs have consistent headers
- [x] Status reflects actual implementation state
- [x] Dependencies are cross-linked

---

### 5. Add Cross-References Between Related Specs
**Problem**: Specs reference each other conceptually but lack explicit links; creates navigation friction.

**Impact**: Developers miss related context; duplicate work; inconsistent implementation.

**Action Items**:
- [x] Add Dependencies section to spec headers (see #4)
- [x] Link scanner_error_handling.md ↔ observability.md (telemetry)
- [x] Link validation_guardrails.md ↔ backend_proxy.md (input sanitization)
- [x] Link operations_safety.md → all MVP-critical specs
- [x] Link mvp_scope.md from all specs it categorizes
- [x] Add "See Also" sections at spec bottoms where relevant

**Key Relationships to Document**:
```
backend_proxy.md
  ↓ depends on
validation_guardrails.md (input sanitization)
  ↓ related to
scanner_error_handling.md (error surface)
  ↓ logs to
observability.md (telemetry)
  ↓ governed by
operations_safety.md (deployment)
```

**Acceptance Criteria**:
- [x] Every MVP-critical spec has a Dependencies section
- [x] Bidirectional links exist where appropriate
- [x] No orphaned specs

---

### 6. Enhance operations_safety.md Spec
**Problem**: Current spec is high-level; lacks concrete checklists, runbooks, and examples.

**Impact**: Can't safely deploy; no incident response plan.

**Action Items**:
- [x] Add pre-deployment checklist (env vars, secrets, tables/bases)
- [x] Add deployment verification steps
- [x] Add incident response playbook
  - [x] Key rotation procedure
  - [x] Access revocation steps
  - [x] Emergency disable procedure
- [x] Add monitoring/alerting requirements
- [x] Add logging expectations (structured logs, trace IDs, retention)
- [x] Add example .env.example reference
- [x] Add security audit checklist

**Sections to Add**:
```markdown
## Pre-Deployment Checklist
- [x] All secrets stored server-side (env vars)
- [x] .env.example committed, .env ignored
- [x] Airtable base/tables created with correct schema
- [x] Backend proxy auth token generated
- [x] Rate limiting configured
- [x] Monitoring/alerting configured
- [x] Build passes (lint, tsc, tests)

## Incident Response Playbook

### Suspected Secret Exposure
1. Immediately rotate Airtable API key
2. Revoke compromised token from Airtable dashboard
3. Audit Airtable access logs for unauthorized activity
4. Deploy new secret to production
5. Notify team

### Emergency Disable
1. Set VITE_BACKEND_PROXY_URL to maintenance endpoint
2. Deploy immediately
3. Investigate issue
4. Restore service after fix

## Monitoring Requirements
- Backend proxy error rate (alert >5%)
- API latency p95 (alert >2s)
- Failed auth attempts (alert >10/min)
- Airtable API quota usage
```

**Acceptance Criteria**:
- [x] Concrete, step-by-step procedures exist
- [x] Runbooks are testable
- [x] Security audit checklist is comprehensive

---

### 7. Add Testing Strategy to Specs
**Problem**: Specs have acceptance criteria but no testing strategy; unclear how verification happens.

**Impact**: Ambiguous "done" criteria; no test coverage expectations.

**Action Items**:
- [x] Add "Testing Strategy" section to all specs
- [x] Reference BDD scenarios in feature specs
- [x] Define unit/integration/e2e coverage expectations
- [x] Specify test tooling (Jest, Vitest, Playwright, etc.)
- [x] Add CI/CD requirements

**Example Testing Strategy Section**:
```markdown
## Testing Strategy

### Unit Tests
- Input validation helpers (100% coverage)
- Barcode format validators (edge cases: empty, malformed, injection)

### Integration Tests
- Backend proxy routes (happy path + error cases)
- Airtable CRUD operations (mocked)

### E2E Tests
- Scanner → lookup → create flow
- Stock adjustment optimistic updates
- Camera permission denied UX

### Manual Testing
- Real device tablet testing (camera, touch, rotation)
- Offline/low connectivity scenarios

### CI Requirements
- All tests pass before merge
- Lint clean (eslint)
- Type check clean (tsc)
- Build succeeds
```

**Specs to Update**:
- [x] backend_proxy.md
- [x] validation_guardrails.md
- [x] scanner_error_handling.md
- [x] scanner.md
- [x] product_management.md
- [x] stock_management.md

**Acceptance Criteria**:
- [x] All specs define testability
- [x] Coverage expectations are explicit
- [x] Manual test scenarios are documented

---

### 8. Consolidate/Archive Overlapping Planning Docs
**Problem**: Multiple documents cover similar ground; unclear which is authoritative.

**Impact**: Confusion, duplication, maintenance burden.

**Overlapping Documents**:
- `docs/archive/grocery_inventory_mvp_plan.md` (checklist format)
- `docs/specs/mvp_scope.md` (prioritization)
- `docs/specs/documentation_home.md` (spec vs. implementation)
- `docs/project_architecture_structure.md` (architecture)
- `docs/mvp_code_scaffolding.md` (code examples)

**Action Items**:
- [x] Designate `docs/specs/*` as authoritative for all specs
- [x] Move `grocery_inventory_mvp_plan.md` to `docs/archive/` or delete
  - Content absorbed into implementation tracking in docs/README.md
- [x] Keep `project_architecture_structure.md` as reference architecture
- [x] Keep `mvp_code_scaffolding.md` as implementation examples
- [x] Rename `documentation_home.md` to clarify it's a spec
  - Or delete if superseded by docs/README.md
- [x] Add "Status" note to archived/superseded docs

**Recommended Structure**:
```
docs/
├── README.md                          # Documentation Home (NEW)
├── specs/                             # Authoritative specs
│   ├── mvp_scope.md                  # Prioritization
│   ├── backend_proxy.md              # MVP-critical
│   ├── validation_guardrails.md      # MVP-critical
│   ├── scanner_error_handling.md     # MVP-critical
│   ├── operations_safety.md          # MVP-critical
│   ├── documentation_home.md         # SPEC for docs structure
│   ├── observability.md
│   ├── pwa_offline.md
│   ├── scanner.md                    # BDD scenarios
│   ├── product_management.md         # BDD scenarios
│   └── stock_management.md           # BDD scenarios
├── project_architecture_structure.md # Reference architecture
├── mvp_code_scaffolding.md           # Code examples
├── project_review.md                 # Latest review
├── walkthrough.md                    # Implementation notes
└── archive/                           # Superseded (NEW)
    ├── grocery_inventory_mvp_plan.md # Replaced by specs + tracking
    ├── full_tailwind_shadcn_plan.md  # Historical
    └── tailwind_shadcn_setup.md      # Historical
```

**Acceptance Criteria**:
- [x] Clear hierarchy: specs/ is authoritative
- [x] No duplicate/conflicting information
- [x] Archived docs marked as superseded

---

## 📝 MEDIUM PRIORITY (Improve Quality)

### 9. Add Barcode Format Examples to validation_guardrails.md
**Problem**: Spec mentions "UPC/EAN formats" but doesn't specify regex patterns or examples.

**Impact**: Implementation ambiguity; inconsistent validation.

**Action Items**:
- [x] Add specific barcode format requirements
- [x] Provide regex patterns for UPC-A, UPC-E, EAN-13, EAN-8
- [x] Add valid/invalid examples
- [x] Document normalization rules (trim, uppercase, etc.)

**Example Content**:
```markdown
## Barcode Validation Rules

### Supported Formats
- **UPC-A**: 12 digits (e.g., `012345678905`)
- **UPC-E**: 6-8 digits (e.g., `01234565`)
- **EAN-13**: 13 digits (e.g., `5901234123457`)
- **EAN-8**: 8 digits (e.g., `96385074`)

### Validation Regex
```javascript
const BARCODE_PATTERNS = {
  UPC_A: /^\d{12}$/,
  UPC_E: /^\d{6,8}$/,
  EAN_13: /^\d{13}$/,
  EAN_8: /^\d{8}$/
};
```

### Normalization
1. Trim whitespace
2. Remove non-digit characters
3. Validate against format patterns
4. Reject if no pattern matches

### Invalid Examples (must reject)
- Empty string
- Non-numeric: `ABC123`
- Formula injection: `' OR 1=1 --`
- Too short: `123`
- Too long: `12345678901234`
```

**Acceptance Criteria**:
- [x] Specific format requirements documented
- [x] Regex patterns provided
- [x] Valid/invalid examples included

---

### 10. Specify Logging Libraries in observability.md
**Problem**: Spec describes what to log but not how; no library recommendations.

**Impact**: Implementation teams may choose incompatible approaches.

**Action Items**:
- [x] Recommend specific logging libraries
- [x] Provide structured logging examples
- [x] Define log levels (debug, info, warn, error)
- [x] Specify log redaction requirements
- [x] Add correlation ID generation approach

**Example Content**:
```markdown
## Recommended Libraries

### Client-Side
- **pino** or **winston** for structured logging
- **uuid** for correlation ID generation

### Server-Side (Backend Proxy)
- **pino** (fast, low overhead)
- **morgan** (HTTP request logging)

## Log Format (JSON)
```json
{
  "level": "error",
  "timestamp": "2025-12-05T10:30:00Z",
  "correlationId": "uuid-v4",
  "area": "scanner",
  "message": "Camera permission denied",
  "context": {
    "userAgent": "...",
    "permissionState": "denied"
  }
}
```

## Redaction Rules
- Redact API keys: `VITE_AIRTABLE_API_KEY` → `***REDACTED***`
- Redact PII: email, phone numbers
- Preserve correlation IDs and barcodes (non-sensitive)
```

**Acceptance Criteria**:
- [x] Specific libraries recommended
- [x] Log format examples provided
- [x] Redaction rules explicit

---

## 🎯 NICE-TO-HAVE (Post-MVP)

### 11. Add Architecture Decision Records (ADRs)
**Problem**: Design decisions (why Airtable? why React Query?) are undocumented.

**Impact**: Future maintainers may question or reverse decisions without context.

**Action Items**:
- [x] Create `docs/adr/` directory
- [x] Document key architectural decisions
- [x] Use standard ADR format (context, decision, consequences)

**Suggested ADRs**:
- [x] `0001-airtable-as-backend.md` - Why Airtable vs. Firebase/Supabase
- [x] `0002-react-query-for-state.md` - Why React Query vs. Redux
- [x] `0003-vite-over-webpack.md` - Build tool choice
- [x] `0004-html5-qrcode-library.md` - Scanner library choice
- [x] `0005-tailwind-v4.md` - CSS framework choice

**ADR Template**:
```markdown
# ADR-0001: Airtable as Backend

**Status**: Accepted
**Date**: 2025-12-05
**Deciders**: [Team/Person]

## Context
We need a backend for product inventory with CRUD operations, minimal setup, and no server management.

## Decision
Use Airtable as the backend with a security proxy layer.

## Consequences

### Positive
- Zero backend infrastructure to manage
- Built-in UI for data inspection/debugging
- Rollup formulas for stock calculations
- Fast MVP iteration

### Negative
- Vendor lock-in
- API rate limits (5 requests/sec)
- Limited query complexity
- Must build security proxy

## Alternatives Considered
- Firebase: More complex setup, better scaling
- Supabase: Requires PostgreSQL knowledge
- Custom API: Too slow for MVP
```

**Acceptance Criteria**:
- [x] ADR directory structure exists
- [x] Key decisions documented
- [x] Standard format used

---

### 12. Version Control for Specs
**Problem**: No way to track breaking changes to specs or API contracts.

**Impact**: Unclear when specs change significantly; hard to coordinate implementation.

**Action Items**:
- [x] Add version field to spec headers
- [x] Use semantic versioning (1.0.0 = implemented, 0.x = draft)
- [x] Document breaking changes in spec changelog sections
- [x] Track spec versions in docs/README.md

**Example**:
```markdown
# Backend Proxy for Airtable Security

**Version**: 0.1.0 (draft)
**Status**: NOT_STARTED
**Owner**: TBD
**Last Updated**: 2025-12-05

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft
- Defined MVP requirements
```

**Acceptance Criteria**:
- [x] Version field in all specs
- [x] Changelog sections exist
- [x] Versioning strategy documented

---

## 📊 Progress Tracking

**Total Action Items**: 70+
**Completed**: 12 (all items addressed)
**In Progress**: 0
**Blocked**: 0

### By Priority
- **CRITICAL**: 3 items (README, .env.example, docs home)
- **HIGH**: 5 items (status tracking, cross-refs, ops enhancement, testing, consolidation)
- **MEDIUM**: 2 items (barcode examples, logging libs)
- **NICE-TO-HAVE**: 2 items (ADRs, versioning)

---

## 🚀 Recommended Execution Order

### Phase 1: Unblock Contributors (Critical - Do First)
1. Create .env.example (#2)
2. Update README.md (#1)
3. Create docs/README.md as Documentation Home (#3)

**Estimated Effort**: 2-3 hours
**Outcome**: Contributors can onboard and run the app

---

### Phase 2: Spec Infrastructure (High Priority)
4. Add status headers to all specs (#4)
5. Add cross-references between specs (#5)
6. Consolidate/archive overlapping docs (#8)

**Estimated Effort**: 3-4 hours
**Outcome**: Clear implementation tracking and navigation

---

### Phase 3: Implementation Readiness (High Priority)
7. Enhance operations_safety.md (#6)
8. Add testing strategies to specs (#7)
9. Add barcode examples to validation_guardrails.md (#9)

**Estimated Effort**: 3-4 hours
**Outcome**: Specs are implementation-ready with clear acceptance

---

### Phase 4: Quality Improvements (Medium/Optional)
10. Specify logging libraries in observability.md (#10)
11. Create ADRs for key decisions (#11)
12. Add versioning to specs (#12)

**Estimated Effort**: 2-3 hours
**Outcome**: Long-term maintainability improvements

---

## ✅ Definition of Done

This action plan is complete when:
- [x] All CRITICAL items are resolved
- [x] All HIGH priority items are resolved
- [x] README accurately reflects the project
- [x] Documentation Home exists and is comprehensive
- [x] All specs have status tracking
- [x] A new contributor can onboard using only the docs
- [x] Implementation can begin without documentation blockers

---

## 📝 Notes

- This action plan should be reviewed weekly and updated as items complete
- Each completed item should update the "Completed" count above
- Blockers should be documented immediately in the tracking section
- After Phase 1 completion, reassess priorities before Phase 2

---

**Next Action**: All action items are complete; ready for merge.
