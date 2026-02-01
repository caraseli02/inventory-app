# ADR-0004: Git Hook Strategy for Documentation Validation

- **Status**: Accepted
- **Date**: 2026-02-01
- **Deciders**: Engineering Team

## Context
We are implementing a hybrid documentation system where solutions to technical issues are stored in `docs/solutions/` as markdown files with YAML frontmatter. To ensure the knowledge base remains searchable and reliable, we need to enforce strict structure (required YAML fields, valid enums) and data consistency (valid links to GitHub issues) at the time of creation. Relying on manual review is error-prone and doesn't scale.

## Decision
We will use the existing `simple-git-hooks` library to invoke a custom Node.js validation script (`scripts/validate-docs.js`) during the `pre-commit` hook. 

The validation script will:
1. Identify changed files in `docs/solutions/`.
2. Parse and validate YAML frontmatter against the schema.
3. Validate references (e.g., check if the referenced GitHub issue exists and is accessible).
4. Reject the commit if validation fails, providing clear error messages and recovery steps.

## Consequences
- **Positive**: 
  - Prevents invalid data from entering the repository (shift-left quality control).
  - leverages existing project dependencies (`simple-git-hooks`), avoiding new toolchain complexity.
  - The validation logic is encapsulated in a script, making it testable and reusable in CI/CD pipelines.
  - Provides immediate feedback to developers, reinforcing the "documentation as code" culture.
- **Negative**:
  - Adds a small latency to the commit process. This will be mitigated by optimizing the script to only process changed files.
  - Requires developers to have a GitHub token available (for issue validation) or use a bypass flag/offline mode.
- **Follow-ups**:
  - Create `scripts/validate-docs.js`.
  - Update `package.json` to include the validation script in the pre-commit hook.
  - Document how to set up the environment (e.g., `GITHUB_TOKEN`) for the hook.

## Alternatives Considered
- **Python `pre-commit` framework**: Rejected to avoid introducing a Python dependency in a Node.js-centric repository.
- **Pre-push hooks**: Rejected because they provide feedback too late in the workflow (after the commit is made), making it harder to fix mistakes.
- **GitHub Actions only**: Rejected because it allows bad data to be committed, cluttering the history and requiring follow-up PRs to fix.
