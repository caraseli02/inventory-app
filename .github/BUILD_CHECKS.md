# Build Error Prevention

Simple setup to catch TypeScript/build errors before they reach Vercel.

## How It Works

### 🖥️ Local Development
**Pre-commit hook** runs before each commit:
- ✅ TypeScript check (`tsc -b --noEmit`)
- ✅ Lint check (`pnpm lint`)

**Prevents pushing broken code to GitHub/Vercel**

### 🌐 Claude Code Web
**GitHub Action** runs on every PR/push:
- ✅ TypeScript check
- ✅ Lint check
- ✅ Build check

**Catches errors when using Claude Code Web (browser)**

---

## Setup (One-time)

### Local Development

```bash
# Install the pre-commit hook
./setup-hooks.sh
```

That's it! Now errors are caught before commit.

### Claude Code Web

No setup needed! The GitHub Action (`.github/workflows/pr-checks.yml`) runs automatically on all PRs.

---

## Usage

### Local Development

```bash
# Make changes
git add .
git commit -m "fix: something"

# ✅ Pre-commit hook runs automatically
# ❌ If errors found, commit is blocked
# ✅ Fix errors, then commit again
```

**Bypass hook** (not recommended):
```bash
git commit --no-verify
```

### Claude Code Web

When creating PRs via Claude Code Web:

1. **PR is created** → GitHub Action runs checks
2. **If checks fail** → PR shows red ❌
3. **Comment on PR**: `@claude The build is failing, please fix`
4. **Claude fixes** → Pushes new commit
5. **Checks run again** → PR shows green ✅

---

## What Gets Checked

1. **TypeScript**: All type errors must be fixed
2. **Linting**: ESLint rules must pass
3. **Build**: Production build must succeed

---

## Benefits

✅ **Catches errors early** - Before Vercel even sees them
✅ **Fast feedback** - Local checks run in seconds
✅ **Works everywhere** - Local dev + Claude Code Web
✅ **Simple** - One setup script, one workflow file
✅ **No extra dependencies** - Uses existing `pnpm` commands

---

## Troubleshooting

**Pre-commit hook not running?**
```bash
# Re-run setup
./setup-hooks.sh

# Verify hook is installed
ls -la .git/hooks/pre-commit
```

**GitHub Action failing on PR?**
- Check the **Actions** tab for detailed error logs
- Fix the errors locally or comment `@claude please fix the build errors`

**Want to temporarily disable?**
```bash
# Local hook
rm .git/hooks/pre-commit

# GitHub Action
mv .github/workflows/pr-checks.yml .github/workflows/pr-checks.yml.disabled
```

---

## Files

- `.githooks/pre-commit` - Pre-commit hook script
- `setup-hooks.sh` - One-time setup script
- `.github/workflows/pr-checks.yml` - GitHub Action for PRs

That's it! Simple and effective. 🎯
