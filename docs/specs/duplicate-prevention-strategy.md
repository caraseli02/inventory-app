# Duplicate Prevention Strategy for Solutions

## Goal
Prevent parallel creation of multiple solution documents for the same issue, and avoid filename collisions.

## Uniqueness Constraints

1.  **File Path**: `docs/solutions/{category}/{slug}.md`
    *   The file system enforces uniqueness of the full path.
    *   We must ensure `{slug}` is unique across ALL categories?
        *   *Decision*: No, same slug in different categories is technically allowed by FS, but confusing.
        *   *Validation*: We will check if `{slug}.md` exists in ANY other category and warn/fail.

2.  **Related GitHub Issue**: `related_github_issue` in Frontmatter.
    *   A single GitHub issue should generally map to a single Solution document.
    *   *Constraint*: If a new file uses `related_github_issue: 123`, check if any *other* file already uses `123`.
    *   *Action*: Reject commit if duplicate found.
    *   *Exception*: If multiple distinct solutions exist for one complex issue, they should potentially be combined or clearly distinguished. For MVP, we enforce 1:1.

## Validation Logic (Pre-Commit)

The `scripts/validate-docs.js` will perform the following checks:

1.  **Build Index**: Scan all valid `docs/solutions/**/*.md` files.
2.  **Check Filenames**:
    *   For the file being committed: `category/my-slug.md`.
    *   Is `my-slug.md` present in `other-category/`?
    *   If yes -> Error: "Ambiguous slug. 'my-slug' exists in 'other-category'. Please use a more specific filename."
3.  **Check Issue Numbers**:
    *   Extract `related_github_issue` from the committed file (e.g., `42`).
    *   Search index for `related_github_issue: 42`.
    *   If found in `existing-file.md` AND `existing-file.md` != `assigned-file.md`:
        *   Error: "Duplicate Solution. Issue #42 is already solved in 'existing-file.md'."

## Conflict Resolution

*   **If duplicate issue link**: user should check existing solution. If providing an alternative, user can update the existing file (append) or use a composite solution.
*   **If duplicate filename**: user should rename the new file.

## Performance
*   To avoid parsing ALL files on every commit, we can assume the cost is low for < 1000 files.
*   For now, full scan is acceptable (read headers only).
