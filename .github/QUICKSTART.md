# 🚀 Quick Start: Auto-Fix Vercel Builds

## 5-Minute Setup

### Step 1: Get API Key
Visit: https://console.anthropic.com
- Sign in
- Go to **API Keys**
- Create a new key
- Copy it (starts with `sk-ant-...`)

### Step 2: Add to GitHub
1. Go to your repo: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Paste your key
5. Save

### Step 3: Test It
```bash
# Create a build error to test
echo "const x: number = 'wrong';" >> src/test-error.ts
git add .
git commit -m "test: Trigger build failure"
git push
```

### Step 4: Watch the Magic ✨
- Go to **Actions** tab
- Wait for Vercel to fail
- Watch "Auto-fix Vercel Build Failures" workflow run
- Claude will commit a fix automatically!

---

## What Happens Next?

Every time a Vercel build fails:
1. ✅ GitHub detects the failure
2. ✅ Workflow triggers automatically
3. ✅ Claude Code analyzes the error
4. ✅ Fixes the issue
5. ✅ Commits and pushes
6. ✅ Vercel rebuilds automatically

**Zero manual intervention required!**

---

## Choose Your Mode

### 🤖 Fully Automatic (Default)
- Uses `.github/workflows/vercel-build-fix.yml`
- Claude fixes and commits automatically
- No human intervention

**Disable issue creation:**
```bash
mv .github/workflows/vercel-failure-issue.yml \
   .github/workflows/vercel-failure-issue.yml.disabled
```

### 👀 Review Before Fixing
- Uses `.github/workflows/vercel-failure-issue.yml`
- Creates an issue, tags `@claude`
- You review before Claude commits

**Disable auto-fix:**
```bash
mv .github/workflows/vercel-build-fix.yml \
   .github/workflows/vercel-build-fix.yml.disabled
```

### 🔀 Both (Safe Start)
- Keep both workflows enabled
- Issue gives you visibility
- Auto-fix runs in parallel
- Review the commits before merging

---

## Troubleshooting

**Workflow not running?**
```bash
# Check if workflows are enabled
gh workflow list

# Check recent runs
gh run list --workflow=vercel-build-fix.yml
```

**Claude Code not fixing?**
- Verify `ANTHROPIC_API_KEY` secret is set
- Check Action logs for errors
- Ensure branch is not protected (or allow Actions bot to push)

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

## Cost Estimate

- **Per fix attempt**: $0.15 - $0.75 (depending on complexity)
- **Only charged when builds actually fail**
- **Typical monthly cost**: $5-20 (assuming 10-30 build failures)

Much cheaper than developer time debugging builds! ⏰💰

---

## Next: Make It Smarter

Customize the prompt in `.github/workflows/vercel-build-fix.yml` to:
- Check specific files first (your common error sources)
- Run additional validation
- Follow your team's commit conventions
- Notify Slack/Discord on fixes

---

**Full docs**: See `.github/CLAUDE_VERCEL_SETUP.md`
