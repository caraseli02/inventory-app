# 🚀 Auto-Fix Vercel Builds with Claude Code Max

This guide is for users with **Claude Code Max subscription**. No API key needed!

## How It Works

```
Vercel Build Fails
       ↓
GitHub Action Creates Issue
       ↓
@claude is mentioned in the issue
       ↓
Claude Code GitHub App responds automatically
       ↓
Claude fixes the build and commits
       ↓
Vercel rebuilds successfully ✅
```

---

## ⚡ Quick Setup (2 Steps)

### Step 1: Install Claude Code GitHub App

Run this command in your Claude Code CLI:

```bash
/install-github-app
```

Follow the prompts to:
1. Authorize the GitHub App
2. Select this repository: `caraseli02/inventory-app`
3. Grant the necessary permissions (read/write code, create commits, etc.)

**That's it!** The app will now respond to @claude mentions automatically.

---

### Step 2: Enable the Workflow

The workflow file is already in your repository:
- `.github/workflows/vercel-failure-issue.yml`

**It's enabled by default** - no action needed!

---

## 🧪 Test It

Want to see it in action? Create a test build failure:

```bash
# Run the test script
./test-build-automation.sh
```

This will:
1. Create a test branch with a TypeScript error
2. Push to GitHub
3. Vercel will fail to build
4. GitHub Action creates an issue
5. Claude Code responds and fixes it automatically!

---

## 🔍 What Happens When a Build Fails

1. **Vercel deployment fails** on any branch
2. **GitHub Action triggers** (within seconds)
3. **Issue is created** with:
   - Title: "🚨 Vercel Build Failed on [branch-name]"
   - Body: Detailed instructions for Claude with @claude mention
   - Labels: `vercel-build-failure`, `automated`, `bug`
4. **Claude Code GitHub App sees the mention**
5. **Claude analyzes the build error:**
   - Checks out the correct branch
   - Runs `pnpm build` to reproduce
   - Reads error messages
   - Fixes the issues
6. **Claude commits and pushes the fix**
7. **Vercel automatically rebuilds** ✅
8. **Issue is updated** with fix details

---

## 📋 Configuration

### Workflow File: `.github/workflows/vercel-failure-issue.yml`

**Triggers:**
- `deployment_status` - Vercel deployment events
- `check_run` - Vercel check runs (build status)
- `workflow_run` - Any workflow failures

**What it does:**
- Detects Vercel build failures
- Extracts branch name, commit SHA, deployment URL
- Creates or updates an issue with @claude mention
- Provides clear instructions for fixing

### Customize the Instructions

Edit the workflow file to change what Claude does:

```yaml
# In .github/workflows/vercel-failure-issue.yml
# Find the "Your Tasks:" section and modify:

**Your Tasks:**
1. Checkout the branch: \`${branch}\`
2. Run \`pnpm build\` to reproduce the errors
3. Fix all build errors
4. Add your custom steps here...
```

---

## 💡 Advanced: Auto-Close Issues

Want issues to close automatically when the build passes?

Add this workflow:

```yaml
# .github/workflows/vercel-success-close-issue.yml
name: Close Issue on Vercel Success

on:
  deployment_status:

permissions:
  issues: write

jobs:
  close-issue:
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'

    steps:
      - name: Close related build failure issues
        uses: actions/github-script@v7
        with:
          script: |
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
                await github.rest.issues.createComment({
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  issue_number: issue.number,
                  body: '✅ Vercel build now passing! Auto-closing this issue.'
                });
              }
            }
```

---

## 🔧 Troubleshooting

### Claude doesn't respond to the issue

**Check:**
1. Is the GitHub App installed? Run `/install-github-app` again
2. Does the app have permission for this repo? Check GitHub Settings → Applications
3. Is the @claude mention formatted correctly? Must be `@claude` (lowercase)

### Workflow doesn't trigger

**Check:**
1. Go to **Actions** tab → **Workflows** → Check if workflow is enabled
2. Verify Vercel is integrated with GitHub (Vercel dashboard → Project → Git)
3. Check **Actions** tab → **All workflows** for any errors

### Claude creates a fix but it doesn't work

**What to do:**
1. Review the commit Claude made
2. Add a comment to the issue: `@claude The build is still failing. Here's the new error: [paste error]`
3. Claude will respond and iterate on the fix

### How to disable the automation

```bash
# Temporarily disable
mv .github/workflows/vercel-failure-issue.yml \
   .github/workflows/vercel-failure-issue.yml.disabled

# Re-enable
mv .github/workflows/vercel-failure-issue.yml.disabled \
   .github/workflows/vercel-failure-issue.yml
```

---

## 📊 Monitoring

### View All Auto-Fix Issues

```bash
gh issue list --label vercel-build-failure
```

### Check Recent Workflow Runs

```bash
gh run list --workflow=vercel-failure-issue.yml
```

### See Claude's Activity

Go to: https://github.com/caraseli02/inventory-app/issues?q=is%3Aissue+label%3Avercel-build-failure

---

## 💰 Cost

**With Claude Code Max subscription:**
- ✅ No additional API costs
- ✅ Unlimited issue responses
- ✅ Included in your subscription

**GitHub Actions:**
- ✅ Free for public repos
- ✅ 2,000 minutes/month for private repos (this uses ~1 minute per failure)

---

## 🎯 Benefits

✅ **No API key management** - Uses your Claude Code Max subscription
✅ **Zero configuration** - Works out of the box after `/install-github-app`
✅ **Full visibility** - All fixes tracked as GitHub issues
✅ **Audit trail** - Every fix is a documented commit
✅ **Iterative fixes** - Claude can respond to feedback in the issue
✅ **Team collaboration** - Teammates can see and comment on fixes

---

## 🚀 Next Steps

1. **Install the app**: `/install-github-app`
2. **Test it**: `./test-build-automation.sh`
3. **Customize**: Edit the workflow to fit your needs
4. **Enjoy**: Never manually debug Vercel builds again! 🎉

---

## 📚 Documentation

- **GitHub App Commands**: `/help` in Claude Code CLI
- **Workflow File**: `.github/workflows/vercel-failure-issue.yml`
- **Test Script**: `test-build-automation.sh`
- **Vercel Docs**: https://vercel.com/docs/deployments/checks
- **Claude Code Docs**: https://code.claude.com/docs

---

## ❓ FAQ

**Q: Does this work on all branches?**
A: Yes! It monitors all Vercel deployments regardless of branch.

**Q: Can I use this for other build systems (not Vercel)?**
A: Yes! Modify the workflow triggers to listen to other CI events.

**Q: Will Claude fix PRs automatically?**
A: Yes, if the build fails on a PR branch, Claude will commit fixes to that branch.

**Q: Can I review fixes before they're merged?**
A: Yes! Claude commits to the branch but doesn't merge. You still control when to merge.

**Q: How do I stop Claude from auto-fixing?**
A: Comment on the issue: `@claude Thanks, I'll take it from here` or disable the workflow.

---

**Ready to never debug Vercel builds manually again?** 🚀

Run: `/install-github-app`
