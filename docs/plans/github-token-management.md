# GitHub Token Management for Git Hooks

To validate `docs/solutions/` entries, the pre-commit hook needs to check if referenced GitHub Issues exist and are valid. This requires authentication with the GitHub API.

## Startegy: Personal Access Tokens (PAT)

We will use Personal Access Tokens (PAT) stored in the developer's local environment. This approach is simple, secure (tokens are not checked in), and uses existing tools (`dotenv`, `gh`).

### Setup Instructions

1.  **Generate a PAT:**
    *   Go to GitHub Settings -> Developer settings -> Personal access tokens -> Tokens (classic).
    *   Generate a new token with `repo` scope (read access to issues is sufficient, but `repo` covers private repos).
    *   Copy the token.

2.  **Configure `.env`:**
    *   Create or edit `.env` in the project root.
    *   Add:
        ```bash
        GITHUB_TOKEN=ghp_your_token_here
        ```

3.  **Environment Variable Alternative:**
    *   You can also export it in your shell profile:
        ```bash
        export GITHUB_TOKEN=ghp_your_token_here
        ```

### Permissions

The token requires **Read-only** access to issues and metadata.
If using fine-grained tokens:
*   Repository permissions: `Issues` (Read-only), `Metadata` (Read-only).

### Security

*   **Never commit `.env` files.** The `.gitignore` file is configured to exclude them.
*   The pre-commit hook will attempt to load `GITHUB_TOKEN` from `.env` using `dotenv` or from the shell environment.
*   If `GITHUB_TOKEN` is missing, the hook will warn but allow the commit (graceful degradation) or skip only the GitHub validation part.

## CI/CD Environment

In CI environments (e.g., GitHub Actions), the `GITHUB_TOKEN` is usually automatically provided. The validation script should be compatible with the standard `GITHUB_TOKEN` secret provided by Actions.
