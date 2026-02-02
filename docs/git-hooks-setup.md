# Git Hooks Setup

To ensure documentation quality, this repository uses `pre-commit` hooks enforced by `simple-git-hooks`.

## Validation

The hook runs `scripts/validate-docs.js` which checks:
1.  **YAML integrity**: Frontmatter parsing.
2.  **Schema**: Required fields (`title`, `category`, etc.) and Enums.
3.  **Path Consistency**: File must be in the correct category directory.
4.  **GitHub Issues**: References to `related_github_issue` are validated against GitHub API (if token present).

## Setup

1.  **Install Hooks**:
    The hooks are automatically installed when you run `pnpm install` via the `prepare` script.
    To manually reinstall:
    ```bash
    pnpm prepare
    ```

2.  **GitHub Token (Optional)**:
    For validation of `related_github_issue` links, ensure reasonable rate limits and access to private issues:
    - Create a `.env` file with `GITHUB_TOKEN=ghp_...`
    - OR export it in your shell: `export GITHUB_TOKEN=...`
    
    If no token is found, GitHub validation issues are treated as warnings or skipped (graceful degradation).

## Troubleshooting

-   **Validation Failed**: Read the error message. It usually points to invalid line or missing field.
-   **Bypass**: If you absolutely must commit despite errors (e.g. WIP), use:
    ```bash
    git commit --no-verify
    ```
    *Use with caution.*

## Testing Hooks

You can run the validation script manually on staged files:
```bash
pnpm validate-docs
```
(Note: It only checks staged files)
