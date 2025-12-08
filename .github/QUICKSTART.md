# 🚀 Quick Start: Auto-Fix Vercel Builds

## 2-Minute Setup (Claude Code Max)

### Step 1: Install Claude Code GitHub App

In your Claude Code CLI, run:
```bash
/install-github-app
```

Follow the prompts to:
1. Authorize the app
2. Select this repository: `caraseli02/inventory-app`
3. Grant permissions

**That's it!** No API keys needed with Claude Code Max subscription.

### Step 2: Test It
```bash
# Create a build error to test
echo "const x: number = 'wrong';" >> src/test-error.ts
git add .
git commit -m "test: Trigger build failure"
git push
```

### Step 3: Watch the Magic ✨
- Go to **Issues** tab
- Wait for the automated issue to appear
- Watch Claude respond with a fix
- Claude will commit the fix to your branch!

---

## What Happens Next?

Every time a Vercel build fails:
1. ✅ GitHub detects the failure
2. ✅ Workflow creates an issue automatically
3. ✅ @claude is mentioned in the issue
4. ✅ Claude Code analyzes the error
5. ✅ Fixes the issue
6. ✅ Commits and pushes
7. ✅ Vercel rebuilds automatically
8. ✅ Issue is updated with fix details

**Zero manual intervention required!**

---

## How It Works

### 🤖 Issue-Based Automation (Enabled)
- Uses `.github/workflows/vercel-failure-issue.yml`
- Creates an issue when Vercel fails
- @claude mention triggers Claude Code GitHub App
- Claude responds, fixes, and commits automatically
- You can comment on the issue to give Claude feedback

**Benefits:**
✅ Full visibility - every fix is tracked in an issue
✅ Audit trail - all fixes documented
✅ Iterative - Claude can respond to your comments
✅ No API keys needed - uses your Claude Code Max subscription

**To temporarily disable:**
```bash
mv .github/workflows/vercel-failure-issue.yml \
   .github/workflows/vercel-failure-issue.yml.disabled
```

**To re-enable:**
```bash
mv .github/workflows/vercel-failure-issue.yml.disabled \
   .github/workflows/vercel-failure-issue.yml
```

---

## Troubleshooting

**Workflow not running?**
```bash
# Check if workflows are enabled
gh workflow list

# Check recent runs
gh run list --workflow=vercel-failure-issue.yml
```

**Claude not responding to issues?**
- Run `/install-github-app` again to verify installation
- Check GitHub Settings → Applications → Claude Code
- Ensure @claude mention is lowercase in the issue
- Check the issue has the `vercel-build-failure` label

**Want to test without breaking things?**
```bash
# Create a test branch
git checkout -b test-auto-fix

# Add a simple TypeScript error
echo "const badVar: string = 123;" >> src/test.ts

# Commit and push
git add . && git commit -m "test: intentional error" && git push -u origin test-auto-fix

# Create a PR and watch it get fixed automatically
gh pr create --fill
```

---

## Cost

**With Claude Code Max subscription:**
- ✅ **No additional API costs**
- ✅ **Unlimited issue responses**
- ✅ **Included in your subscription**

**GitHub Actions:**
- ✅ Free for public repos
- ✅ 2,000 minutes/month for private repos
- ✅ This workflow uses ~1 minute per build failure

Much cheaper than developer time debugging builds! ⏰💰

---

## Next: Make It Smarter

Customize the issue template in `.github/workflows/vercel-failure-issue.yml` to:
- Check specific files first (your common error sources)
- Run additional validation before committing
- Follow your team's commit conventions
- Add custom labels or assignees
- Integrate with Slack/Discord notifications

**Example customization:**
```yaml
# In .github/workflows/vercel-failure-issue.yml
# Edit the "Your Tasks:" section:

**Your Tasks:**
1. Checkout the branch: \`${branch}\`
2. First check common error files: src/types/*.ts
3. Run \`pnpm build\` to reproduce errors
4. Fix all TypeScript errors
5. Run \`pnpm lint\` to check code style
6. Commit with format: \`fix(build): [description]\`
7. Push to: \`${branch}\`
```

---

**Full docs**: See `.github/SETUP_WITH_CLAUDE_MAX.md`
