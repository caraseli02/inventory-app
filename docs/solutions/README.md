# Knowledge Base (Solutions)

This directory contains solutions to common problems, bugs, and configuration issues encountered during development. It serves as a knowledge base to prevent recurring issues and speed up debugging.

## Structure

Solutions are organized by `problem_type`:

```
docs/solutions/
├── api-errors/        # Supabase, fetch, network issues
├── build-errors/      # Vite, TypeScript compilation errors
├── dx-issues/         # Developer experience, tooling
├── integration-issues/# Third-party library issues
├── logic-errors/      # Business logic bugs
├── patterns/          # Critical patterns to follow
├── performance-issues/# Re-renders, memory leaks
├── pwa-issues/        # Service worker, manifest, offline
├── runtime-errors/    # Runtime exceptions, crashes
├── scanner-issues/    # html5-qrcode specific problems
├── state-issues/      # React state management bugs
├── ui-bugs/           # Component rendering, styling issues
└── schema.yaml        # Validation schema
```

## Creating a New Solution

1. Run the compound workflow (if available) or copy `_template.md`.
2. Fill in the required frontmatter fields.
3. Save the file in the appropriate directory with the naming convention: `{symptom-slug}-{module}-{YYYYMMDD}.md`.

### Format

All solution files must follow the schema defined in `schema.yaml`.

```yaml
---
module: ComponentName
date: YYYY-MM-DD
problem_type: ui_bug
component: react_component
symptoms:
  - "Symptom 1"
root_cause: logic_error
resolution_type: code_fix
severity: high
---
```

## Searching

Use the search script to find solutions:

```bash
npm run search-solutions "scanner loop"
```

## Validation

All files are validated via pre-commit hook using `scripts/validate-docs.js`.
