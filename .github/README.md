# GitHub Workflows Documentation

This directory contains GitHub Actions workflows for automated Vercel build fixing.

## 📁 Files

### Active Workflows

- **`vercel-failure-issue.yml`** - Creates issues when Vercel builds fail
  - Triggers on Vercel deployment failures
  - Creates GitHub issue with @claude mention
  - Claude Code GitHub App responds automatically
  - **Status**: ✅ Active

### Disabled Workflows

- **`vercel-build-fix.yml.disabled`** - Direct API-based fixing (disabled)
  - Requires Anthropic API key
  - Not needed with Claude Code Max subscription
  - **Status**: ⏸️ Disabled

### Documentation

- **`SETUP_WITH_CLAUDE_MAX.md`** - Complete setup guide for Claude Code Max users
- **`QUICKSTART.md`** - 2-minute quick start guide
- **`CLAUDE_VERCEL_SETUP.md`** - Original setup guide (includes API key option)

---

## 🚀 Quick Start

**For Claude Code Max subscribers (no API key needed):**

1. Install the GitHub App:
   ```bash
   /install-github-app
   ```

2. The workflow is already active - no other setup needed!

3. Test it:
   ```bash
   ./test-build-automation.sh
   ```

**That's it!** When Vercel builds fail, Claude will automatically fix them.

---

## 📖 How It Works

```mermaid
graph TD
    A[Vercel Build Fails] --> B[GitHub Action Triggers]
    B --> C[Create GitHub Issue]
    C --> D[@claude mentioned in issue]
    D --> E[Claude Code App Responds]
    E --> F[Claude analyzes error]
    F --> G[Claude fixes code]
    G --> H[Claude commits & pushes]
    H --> I[Vercel rebuilds]
    I --> J{Build Success?}
    J -->|Yes| K[Issue updated with success]
    J -->|No| L[Claude iterates on fix]
    L --> F
```

---

## 🔧 Configuration

### Current Setup

**Authentication**: Claude Code Max subscription (via GitHub App)
**Workflow**: Issue-based automation
**Triggers**: Vercel deployment failures, check run failures

### Customization

Edit `.github/workflows/vercel-failure-issue.yml` to:
- Change issue labels
- Modify Claude's instructions
- Add notification integrations (Slack, Discord, etc.)
- Customize branch filtering

Example:
```yaml
# Only trigger for specific branches
if: |
  (github.event.deployment_status.state == 'failure') &&
  (contains(github.ref, 'main') || contains(github.ref, 'staging'))
```

---

## 🎯 Use Cases

### Automatic Build Fixes
- TypeScript errors
- Import/export errors
- Syntax errors
- Missing dependencies

### Manual Intervention
You can interact with Claude in the issue:
```
@claude The build is still failing. Here's the new error:
[paste error log]
```

Claude will respond and iterate on the fix.

### Testing on Branches
The automation works on **all branches**, not just main:
```bash
git checkout -b feature/my-feature
# Make changes that break the build
git push
# Claude will create an issue and fix it
```

---

## 🔍 Monitoring

### View Active Issues
```bash
gh issue list --label vercel-build-failure
```

### Check Workflow Runs
```bash
gh run list --workflow=vercel-failure-issue.yml
```

### View Claude's Commits
```bash
git log --author="claude" --oneline
```

---

## 🛠️ Troubleshooting

### Workflow not triggering

1. **Check workflow is enabled**:
   - Go to Actions tab → All workflows
   - Ensure "Create Issue on Vercel Build Failure" is enabled

2. **Verify Vercel integration**:
   - Vercel must be connected to GitHub
   - Check Vercel dashboard → Project → Git

3. **Check permissions**:
   ```bash
   # Workflow needs these permissions:
   # - issues: write
   # - contents: read
   # - checks: read
   ```

### Claude not responding

1. **Verify GitHub App is installed**:
   ```bash
   /install-github-app
   ```

2. **Check app permissions**:
   - GitHub Settings → Applications → Claude Code
   - Ensure it has access to this repository

3. **Check @claude mention**:
   - Must be lowercase: `@claude`
   - Should be in issue body or comments

### Build still failing after fix

1. **Comment on the issue**:
   ```
   @claude The build is still failing. Error:
   [paste the new error]
   ```

2. **Claude will iterate** and try again

3. **Manual override**:
   ```
   @claude I've fixed it manually. You can close this issue.
   ```

---

## 💡 Advanced Features

### Auto-close issues when build passes

Create `.github/workflows/vercel-success-close-issue.yml`:
```yaml
name: Close Issue on Success
on:
  deployment_status:
permissions:
  issues: write
jobs:
  close-issue:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            // Find and close related issues
            const branch = github.event.deployment_status.deployment.ref;
            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: 'open',
              labels: 'vercel-build-failure'
            });
            for (const issue of issues.data) {
              if (issue.title.includes(branch)) {
                await github.rest.issues.update({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: issue.number,
                  state: 'closed'
                });
              }
            }
```

### Slack notifications

Add to workflow:
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚨 Vercel build failed on ${{ github.ref }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Custom error handling

Add specific instructions for common errors:
```yaml
body: |
  @claude Fix the Vercel build failure.

  Common issues in this repo:
  - Missing environment variables in vercel.json
  - TypeScript strict mode errors in src/types/
  - Import path issues with @/ alias

  Please check these first before running the build.
```

---

## 📊 Metrics

Track automation effectiveness:

```bash
# Count auto-fixed issues
gh issue list --label vercel-build-failure --state closed | wc -l

# Average time to fix (from issue creation to close)
gh issue list --label vercel-build-failure --json createdAt,closedAt

# Success rate (closed vs open)
echo "Open: $(gh issue list --label vercel-build-failure --state open | wc -l)"
echo "Closed: $(gh issue list --label vercel-build-failure --state closed | wc -l)"
```

---

## 🆘 Getting Help

1. **Documentation**: Start with `SETUP_WITH_CLAUDE_MAX.md`
2. **Quick start**: See `QUICKSTART.md`
3. **Claude Code help**: Run `/help` in CLI
4. **GitHub Actions docs**: https://docs.github.com/actions
5. **Vercel docs**: https://vercel.com/docs

---

## 🔐 Security

- No API keys stored in repository
- Uses GitHub App authentication (OAuth)
- Workflows run with minimal permissions
- All changes tracked in git history
- Issues are public by default (use private repo if needed)

---

## 📝 License

These workflows are part of the inventory-app project and follow the same license.
