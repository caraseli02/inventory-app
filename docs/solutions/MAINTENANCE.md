# Solutions Maintenance Guide

## Metrics

To track the adoption and health of the documentation system:

1.  **Creation Rate**:
    ```bash
    git log --since="1 week ago" --name-only --pretty=format: | grep "docs/solutions/" | sort | uniq -c
    ```

2.  **Validator Success**:
    Check CI logs for `pnpm validate-docs` failures to identify common mistakes.

## Backup & Export

The knowledge base is version-controlled in the repository. Standard git backup procedures apply.

To export all solutions as JSON (e.g., for migration to another tool):
```bash
node scripts/search-solutions.js --query "" > solutions-export.json
```

## Rollback Procedure

If invalid or corrupted solutions are committed (bypassing hooks):

1.  **Revert Commit**:
    ```bash
    git revert <commit-hash>
    ```

2.  **Restore File**:
    ```bash
    git checkout HEAD~1 -- docs/solutions/path/to/file.md
    ```

3.  **Recover from Archive**:
    Historical issues are in `docs/archive/TROUBLESHOOTING.md`.
