---
title: Full Migration to compound-engineering-plugin Compatible Schema
type: migration
date: 2026-02-01
status: READY_TO_IMPLEMENT
---

# Full Migration to compound-engineering-plugin Compatible Schema

## Context

This plan migrates `docs/solutions/` to be fully compatible with the [compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) `/workflows:compound` command. The schema is adapted for React/TypeScript/Vite stack (not Rails).

### Why This Migration?

The compound-engineering-plugin provides:
- `/workflows:plan` - Turn feature ideas into implementation plans
- `/workflows:work` - Execute plans with task tracking
- `/workflows:review` - Multi-agent code review
- `/workflows:compound` - Document solved problems for reuse

Current schema is incompatible with `/workflows:compound`. This migration fixes that.

---

## Current vs Target Schema

### Current Schema (Incompatible)
```yaml
title: string (required)
category: frontend | backend | infrastructure | security | ux
severity: HIGH | MEDIUM | LOW
date: YYYY-MM-DD
tags: [array]
module: string
related_github_issue: number | null
status: resolved | deprecated
symptoms: [array]
commit: string
```

### Target Schema (Plugin Compatible)
```yaml
module: string (required)
date: YYYY-MM-DD (required)
problem_type: enum (required) # 12 values
component: enum (required)    # 11 values
symptoms: [array, 1-5 items] (required)
root_cause: enum (required)   # 12 values
resolution_type: enum (required) # 7 values
severity: critical | high | medium | low (required)
tags: [array, max 8] (optional)
# Extra fields (kept for our workflow):
related_github_issue: number (optional)
commit: string (optional)
```

---

## New Schema Definition

Create `docs/solutions/schema.yaml`:

```yaml
# Compound-Docs Schema for React/TypeScript/Vite Stack
# Adapted from compound-engineering-plugin for non-Rails projects

required_fields:
  module:
    type: string
    description: "Module/component name (e.g., 'ScannerComponent', 'CheckoutPage')"
    examples:
      - "ScannerComponent"
      - "CheckoutPage"
      - "EditProductDialog"
      - "useProductLookup"

  date:
    type: string
    pattern: '^\d{4}-\d{2}-\d{2}$'
    description: "Date when this problem was solved (YYYY-MM-DD)"

  problem_type:
    type: enum
    values:
      - build_error          # Vite, TypeScript compilation errors
      - runtime_error        # Runtime exceptions, crashes
      - performance_issue    # Re-renders, memory leaks, slow queries
      - state_issue          # React state management bugs
      - api_error            # Supabase, fetch, network issues
      - ui_bug               # Component rendering, styling issues
      - scanner_issue        # html5-qrcode specific problems
      - pwa_issue            # Service worker, manifest, offline
      - integration_issue    # Third-party library issues
      - logic_error          # Business logic bugs
      - developer_experience # DX issues, tooling, workflow
      - documentation_gap    # Missing or unclear docs
    description: "Primary category of the problem"

  component:
    type: enum
    values:
      - react_component      # React functional components
      - custom_hook          # useXxx hooks
      - api_client           # lib/api-provider, supabase-api
      - scanner              # Scanner component (html5-qrcode)
      - form_component       # shadcn form elements
      - dialog_component     # Modal dialogs, sheets
      - page_component       # Top-level page components
      - utility              # lib/utils, helpers
      - type_definition      # TypeScript types
      - pwa_config           # Service worker, manifest
      - build_config         # Vite, ESLint, Tailwind config
    description: "Component type involved"

  symptoms:
    type: array[string]
    min_items: 1
    max_items: 5
    description: "Observable symptoms (error messages, visual issues)"
    examples:
      - "Scanner loops continuously when barcode in view"
      - "White screen after deployment"
      - "Dialog background is transparent"

  root_cause:
    type: enum
    values:
      - dependency_array     # useEffect dependency issues
      - missing_validation   # Input validation missing
      - state_race           # Concurrent state updates
      - missing_error_handler # Unhandled errors
      - wrong_api_usage      # Incorrect API calls
      - type_error           # TypeScript type mismatches
      - memory_leak          # Uncleared subscriptions/timers
      - config_error         # Environment/config issues
      - logic_error          # Algorithm/business logic bug
      - missing_cleanup      # useEffect cleanup missing
      - stale_closure        # Stale React closure issues
      - csp_violation        # Content Security Policy issues
    description: "Fundamental cause of the problem"

  resolution_type:
    type: enum
    values:
      - code_fix             # Fixed by changing source code
      - config_change        # Fixed by changing configuration
      - dependency_update    # Fixed by updating package
      - type_fix             # Fixed TypeScript types
      - refactor             # Fixed by restructuring code
      - environment_setup    # Fixed by environment config
      - documentation_update # Added/updated documentation
    description: "Type of fix applied"

  severity:
    type: enum
    values:
      - critical             # Blocks production or development
      - high                 # Impairs core functionality
      - medium               # Affects specific feature
      - low                  # Minor issue or edge case
    description: "Impact severity"

optional_fields:
  tags:
    type: array[string]
    max_items: 8
    description: "Searchable keywords (lowercase, hyphen-separated)"

  related_github_issue:
    type: integer
    description: "GitHub Issue number if applicable"

  commit:
    type: string
    description: "Git commit hash of the fix"

# Category mapping (problem_type → directory)
category_mapping:
  build_error: build-errors
  runtime_error: runtime-errors
  performance_issue: performance-issues
  state_issue: state-issues
  api_error: api-errors
  ui_bug: ui-bugs
  scanner_issue: scanner-issues
  pwa_issue: pwa-issues
  integration_issue: integration-issues
  logic_error: logic-errors
  developer_experience: dx-issues
  documentation_gap: documentation

# File naming convention
file_naming: "{symptom-slug}-{module}-{YYYYMMDD}.md"
```

---

## Directory Structure Changes

### Before
```
docs/solutions/
├── backend/          (empty)
├── frontend/         (4 files)
├── infrastructure/   (1 file)
├── security/         (1 file)
├── ux/               (1 file)
├── _template.md
├── MAINTENANCE.md
└── README.md
```

### After
```
docs/solutions/
├── api-errors/
├── build-errors/           # CSP, chunk load failures
├── dx-issues/
├── integration-issues/
├── logic-errors/
├── patterns/
│   └── critical-patterns.md
├── performance-issues/
├── pwa-issues/
├── runtime-errors/
├── scanner-issues/         # All scanner-related issues
├── state-issues/           # React state bugs
├── ui-bugs/                # Dialog, styling issues
├── _archive/               # Old directories (temporary)
├── _template.md
├── MAINTENANCE.md
├── README.md
└── schema.yaml
```

---

## File Migration Map

| Current Path | New Path | problem_type | component |
|--------------|----------|--------------|-----------|
| `frontend/scanner-loop-continuous-item-additions.md` | `scanner-issues/continuous-loop-ScannerComponent-20260201.md` | `scanner_issue` | `scanner` |
| `frontend/scanner-active-during-modal-interaction.md` | `scanner-issues/modal-interference-ScannerComponent-20260201.md` | `scanner_issue` | `scanner` |
| `frontend/mobile-checkout-scanner-always-active.md` | `scanner-issues/always-active-CheckoutPage-20260201.md` | `scanner_issue` | `scanner` |
| `frontend/checkout-infinite-loop-on-non-existent-products.md` | `state-issues/nonexistent-product-loop-CheckoutPage-20260201.md` | `state_issue` | `page_component` |
| `infrastructure/black-screen-after-deployment-chunk-load-failed.md` | `build-errors/chunk-load-failed-PWA-20260201.md` | `build_error` | `pwa_config` |
| `security/production-app-shows-black-screen.md` | `build-errors/csp-black-screen-Vercel-20260201.md` | `build_error` | `build_config` |
| `ux/transparent-dialog-background.md` | `ui-bugs/transparent-background-EditProductDialog-20260201.md` | `ui_bug` | `dialog_component` |

---

## Updated Template

Replace `docs/solutions/_template.md`:

```markdown
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

# Problem Description

Brief description of the issue. What went wrong? What was the impact?

# Symptoms

- List observable behaviors
- Error messages (if any)
- Steps to reproduce

# Root Cause Analysis

Why did this happen? Technical details of the failure.

```typescript
// ❌ BEFORE - The problematic code
```

# Solution

Step-by-step explanation of the fix.

```typescript
// ✅ AFTER - The fixed code
```

# Files Changed

- `src/path/to/file.tsx` (lines X-Y)

# Prevention

How do we ensure this doesn't happen again?

- [ ] Added unit test for this scenario
- [ ] Updated linting rules
- [ ] Added to critical patterns
```

---

## Validation Script Updates

Update `scripts/validate-docs.js`:

### Changes Required

1. **Load schema from YAML file**
```javascript
import yaml from 'js-yaml';
const schema = yaml.load(fs.readFileSync('docs/solutions/schema.yaml', 'utf8'));
```

2. **New enum validations**
```javascript
const VALID_PROBLEM_TYPES = ['build_error', 'runtime_error', 'performance_issue', 'state_issue', 'api_error', 'ui_bug', 'scanner_issue', 'pwa_issue', 'integration_issue', 'logic_error', 'developer_experience', 'documentation_gap'];

const VALID_COMPONENTS = ['react_component', 'custom_hook', 'api_client', 'scanner', 'form_component', 'dialog_component', 'page_component', 'utility', 'type_definition', 'pwa_config', 'build_config'];

const VALID_ROOT_CAUSES = ['dependency_array', 'missing_validation', 'state_race', 'missing_error_handler', 'wrong_api_usage', 'type_error', 'memory_leak', 'config_error', 'logic_error', 'missing_cleanup', 'stale_closure', 'csp_violation'];

const VALID_RESOLUTION_TYPES = ['code_fix', 'config_change', 'dependency_update', 'type_fix', 'refactor', 'environment_setup', 'documentation_update'];

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
```

3. **Updated required fields**
```javascript
const requiredFields = ['module', 'date', 'problem_type', 'component', 'symptoms', 'root_cause', 'resolution_type', 'severity'];
```

4. **Symptoms array validation**
```javascript
if (!Array.isArray(frontmatter.symptoms) || frontmatter.symptoms.length < 1 || frontmatter.symptoms.length > 5) {
  return { valid: false, error: 'symptoms must be array with 1-5 items' };
}
```

5. **Path validation update**
```javascript
const categoryMapping = {
  'build_error': 'build-errors',
  'scanner_issue': 'scanner-issues',
  // ... etc
};
const expectedDir = path.join('docs', 'solutions', categoryMapping[frontmatter.problem_type]);
```

---

## Search Script Updates

Update `scripts/search-solutions.js`:

### Changes Required

1. **Add problem_type and component to scoring**
```javascript
const problemType = (doc.frontmatter.problem_type || '').toLowerCase();
const component = (doc.frontmatter.component || '').toLowerCase();
const rootCause = (doc.frontmatter.root_cause || '').toLowerCase();

qTerms.forEach(term => {
  // Problem type match (+5)
  if (problemType === term || problemType.includes(term)) score += 5;

  // Component match (+5)
  if (component === term || component.includes(term)) score += 5;

  // Root cause match (+5)
  if (rootCause === term || rootCause.includes(term)) score += 5;
});
```

2. **Update output to include new fields**
```javascript
const output = results.map(r => ({
  score: r.score,
  module: r.doc.frontmatter.module,
  path: path.relative(projectRoot, r.doc.filePath),
  problem_type: r.doc.frontmatter.problem_type,
  component: r.doc.frontmatter.component,
  severity: r.doc.frontmatter.severity,
  summary: r.doc.body.trim().split('\n').slice(0, 2).join(' ').replace(/[#*]/g, '').trim()
}));
```

---

## Patterns Directory

Create `docs/solutions/patterns/critical-patterns.md`:

```markdown
# Critical Patterns

Patterns that must be followed to avoid recurring issues. These are extracted from solved problems that occurred multiple times or had significant impact.

---

## Pattern 1: Scanner Callback Stability

**Problem:** Scanner loops continuously when callback changes on every render

**Root Cause:** `onScanSuccess` in useEffect dependencies causes restart on every render

**Solution Pattern:**
```typescript
// ❌ WRONG
useEffect(() => {
  scanner.start(onScanSuccess);
}, [onScanSuccess]); // Restarts every render!

// ✅ CORRECT
const callbackRef = useRef(onScanSuccess);
useEffect(() => { callbackRef.current = onScanSuccess; }, [onScanSuccess]);
useEffect(() => {
  scanner.start((code) => callbackRef.current(code));
}, []); // Stable - never restarts
```

**Related Solutions:**
- `docs/solutions/scanner-issues/continuous-loop-ScannerComponent-20260201.md`
- `docs/solutions/scanner-issues/modal-interference-ScannerComponent-20260201.md`

---

## Pattern 2: Modal Scanner Cleanup

**Problem:** Scanner stays active when modal opens, causing interference

**Solution Pattern:**
```typescript
// ❌ WRONG
<Dialog open={isOpen}>
  {/* Scanner still running in background */}
</Dialog>

// ✅ CORRECT
useEffect(() => {
  if (isModalOpen) {
    scanner.pause();
    return () => scanner.resume();
  }
}, [isModalOpen]);
```

**Related Solutions:**
- `docs/solutions/scanner-issues/modal-interference-ScannerComponent-20260201.md`
- `docs/solutions/scanner-issues/always-active-CheckoutPage-20260201.md`

---

## Pattern 3: CSP for Production Builds

**Problem:** App shows black screen in production due to CSP violations

**Solution Pattern:**
```
# vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

**Related Solutions:**
- `docs/solutions/build-errors/csp-black-screen-Vercel-20260201.md`
```

---

## Implementation Steps

Execute in order:

### Step 1: Create Schema File
```bash
# Create docs/solutions/schema.yaml with content above
```

### Step 2: Create New Directories
```bash
mkdir -p docs/solutions/{api-errors,build-errors,dx-issues,integration-issues,logic-errors,patterns,performance-issues,pwa-issues,runtime-errors,scanner-issues,state-issues,ui-bugs,_archive}
```

### Step 3: Migrate Each Solution File
For each file in the migration map:
1. Read current content
2. Transform YAML frontmatter to new schema
3. Keep markdown body unchanged
4. Write to new location with new filename
5. Move old file to `_archive/`

### Step 4: Update Template
Replace `docs/solutions/_template.md` with new template.

### Step 5: Create Patterns File
Create `docs/solutions/patterns/critical-patterns.md`.

### Step 6: Update Validation Script
Apply changes to `scripts/validate-docs.js`.

### Step 7: Update Search Script
Apply changes to `scripts/search-solutions.js`.

### Step 8: Update README
Update `docs/solutions/README.md` to document new schema.

### Step 9: Update Learnings-Researcher Skill
Update `.config/opencode/skills/learnings-researcher/SKILL.md`.

### Step 10: Update CLAUDE.md
Update Bug Fix Workflow section.

### Step 11: Run Validation
```bash
node scripts/validate-docs.js
```

### Step 12: Clean Up
```bash
# After verification, remove old directories
rm -rf docs/solutions/frontend docs/solutions/backend docs/solutions/infrastructure docs/solutions/security docs/solutions/ux
```

---

## Verification Checklist

- [ ] `node scripts/validate-docs.js` passes on all 7 migrated files
- [ ] `node scripts/search-solutions.js --query "scanner"` returns scanner-issues results
- [ ] Pre-commit hook validates new solution file correctly
- [ ] Old directories archived in `_archive/`
- [ ] README.md documents new schema
- [ ] CLAUDE.md references new workflow

---

## Rollback

If migration fails:
1. Restore from `docs/solutions/_archive/`
2. Revert validation script changes
3. Remove new directories

Keep `_archive/` for 1 week after successful migration.
