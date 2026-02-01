---
title: Compound Schema Quick Reference
type: reference
date: 2026-02-01
---

# Compound Schema Quick Reference

Copy-paste ready schema and enums for React/TypeScript stack.

---

## YAML Frontmatter Template

```yaml
---
module: ComponentName
date: 2026-02-01
problem_type: ui_bug
component: react_component
symptoms:
  - "Observable symptom 1"
  - "Observable symptom 2"
root_cause: dependency_array
resolution_type: code_fix
severity: high
tags: [keyword1, keyword2]
related_github_issue: null
commit: null
---
```

---

## Enum Values

### problem_type (12 values)
```
build_error          # Vite, TypeScript compilation errors
runtime_error        # Runtime exceptions, crashes
performance_issue    # Re-renders, memory leaks, slow queries
state_issue          # React state management bugs
api_error            # Supabase, fetch, network issues
ui_bug               # Component rendering, styling issues
scanner_issue        # html5-qrcode specific problems
pwa_issue            # Service worker, manifest, offline
integration_issue    # Third-party library issues
logic_error          # Business logic bugs
developer_experience # DX issues, tooling, workflow
documentation_gap    # Missing or unclear docs
```

### component (11 values)
```
react_component      # React functional components
custom_hook          # useXxx hooks
api_client           # lib/api-provider, supabase-api
scanner              # Scanner component (html5-qrcode)
form_component       # shadcn form elements
dialog_component     # Modal dialogs, sheets
page_component       # Top-level page components
utility              # lib/utils, helpers
type_definition      # TypeScript types
pwa_config           # Service worker, manifest
build_config         # Vite, ESLint, Tailwind config
```

### root_cause (12 values)
```
dependency_array     # useEffect dependency issues
missing_validation   # Input validation missing
state_race           # Concurrent state updates
missing_error_handler # Unhandled errors
wrong_api_usage      # Incorrect API calls
type_error           # TypeScript type mismatches
memory_leak          # Uncleared subscriptions/timers
config_error         # Environment/config issues
logic_error          # Algorithm/business logic bug
missing_cleanup      # useEffect cleanup missing
stale_closure        # Stale React closure issues
csp_violation        # Content Security Policy issues
```

### resolution_type (7 values)
```
code_fix             # Fixed by changing source code
config_change        # Fixed by changing configuration
dependency_update    # Fixed by updating package
type_fix             # Fixed TypeScript types
refactor             # Fixed by restructuring code
environment_setup    # Fixed by environment config
documentation_update # Added/updated documentation
```

### severity (4 values)
```
critical             # Blocks production or development
high                 # Impairs core functionality
medium               # Affects specific feature
low                  # Minor issue or edge case
```

---

## Directory Mapping

| problem_type | Directory |
|--------------|-----------|
| `build_error` | `build-errors/` |
| `runtime_error` | `runtime-errors/` |
| `performance_issue` | `performance-issues/` |
| `state_issue` | `state-issues/` |
| `api_error` | `api-errors/` |
| `ui_bug` | `ui-bugs/` |
| `scanner_issue` | `scanner-issues/` |
| `pwa_issue` | `pwa-issues/` |
| `integration_issue` | `integration-issues/` |
| `logic_error` | `logic-errors/` |
| `developer_experience` | `dx-issues/` |
| `documentation_gap` | `documentation/` |

---

## File Naming Convention

```
{symptom-slug}-{Module}-{YYYYMMDD}.md
```

Examples:
- `continuous-loop-ScannerComponent-20260201.md`
- `csp-black-screen-Vercel-20260201.md`
- `transparent-background-EditProductDialog-20260201.md`

---

## Required vs Optional Fields

### Required (8 fields)
- `module` - Component/module name
- `date` - YYYY-MM-DD
- `problem_type` - enum
- `component` - enum
- `symptoms` - array (1-5 items)
- `root_cause` - enum
- `resolution_type` - enum
- `severity` - enum

### Optional (3 fields)
- `tags` - array (max 8)
- `related_github_issue` - integer
- `commit` - string

---

## Validation Rules

1. All required fields must be present
2. Enum values must match exactly (case-sensitive)
3. `symptoms` array must have 1-5 items
4. `date` must be YYYY-MM-DD format
5. `tags` array max 8 items
6. File must be in directory matching `problem_type` mapping
7. Filename must follow `{symptom}-{module}-{YYYYMMDD}.md` format
