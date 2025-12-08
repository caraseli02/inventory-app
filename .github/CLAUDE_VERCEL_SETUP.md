# Automated Claude Code Vercel Build Fixes - Setup Guide

This guide explains how to set up automatic Claude Code triggering when Vercel builds fail.

## Prerequisites

- GitHub repository with Vercel integration
- Anthropic API key (get from https://console.anthropic.com)
- Claude Code installed locally (optional, for testing)

## Setup Options

We've configured **two automation approaches**. Choose the one that fits your workflow:

### Option 1: Direct Fix with Claude Code Action ✨ (Recommended)

**Best for:** Immediate automated fixes without manual intervention

**How it works:**
- GitHub Action monitors Vercel deployment status
- On failure, Claude Code Action runs automatically
- Claude analyzes the error, fixes it, commits, and pushes
- All automated, no human interaction needed

**Setup:**
1. Get your Anthropic API key from https://console.anthropic.com
2. Add it to GitHub repository secrets:
   - Go to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your API key (starts with `sk-ant-...`)
3. The workflow `.github/workflows/vercel-build-fix.yml` is already configured
4. **Done!** Next Vercel failure will trigger automatic fixes

**Testing:**
- Push a commit with a TypeScript error to trigger a build failure
- Watch the Actions tab for the auto-fix workflow
- Check commits for Claude's automated fix

---

### Option 2: Issue-Based Workflow 📝

**Best for:** Review fixes before they're applied, or using Claude Code GitHub App

**How it works:**
- GitHub Action creates an issue when Vercel fails
- Mentions `@claude` in the issue
- Claude Code GitHub App (if installed) responds automatically
- OR you can manually review and approve the fix

**Setup:**
1. Install Claude Code GitHub App:
   ```bash
   # Run this in your Claude Code CLI
   /install-github-app
   ```
   Follow the prompts to connect to this repository

2. Configure the app to respond to issues automatically:
   - In `.github/claude-code.yml`, set:
     ```yaml
     automation:
       respond_to_mentions: true
       auto_assign: true
     ```

3. The workflow `.github/workflows/vercel-failure-issue.yml` is already configured

4. **Done!** Next Vercel failure will create an issue, and Claude will respond

**Testing:**
- Push a commit with a build error
- Check the **Issues** tab for a new automated issue
- Watch Claude respond with a fix

---

## Configuration

### Workflow Customization

Both workflows can be customized in their respective YAML files:

**`.github/workflows/vercel-build-fix.yml`** (Option 1):
- Modify the `prompt` section to change Claude's instructions
- Add more context about your project structure
- Adjust the tools Claude can use

**`.github/workflows/vercel-failure-issue.yml`** (Option 2):
- Customize the issue template
- Add custom labels
- Change the `@claude` mention format

### Enable/Disable Workflows

To disable a workflow temporarily:
```bash
# Disable direct fix workflow
mv .github/workflows/vercel-build-fix.yml .github/workflows/vercel-build-fix.yml.disabled

# Disable issue creation workflow
mv .github/workflows/vercel-failure-issue.yml .github/workflows/vercel-failure-issue.yml.disabled
```

---

## Troubleshooting

### Workflow not triggering

**Check:**
1. Workflows are enabled in **Settings** → **Actions** → **General**
2. The workflow file syntax is valid (GitHub will show errors in Actions tab)
3. Vercel is properly integrated with GitHub (check Vercel dashboard)

### Claude Code Action fails

**Common issues:**
1. **Missing API key**: Verify `ANTHROPIC_API_KEY` secret is set correctly
2. **Permission errors**: Ensure workflow has `contents: write` permission
3. **Branch protection**: If branch is protected, add the GitHub Actions bot to allowed users

### Issue created but Claude doesn't respond (Option 2)

**Check:**
1. Claude Code GitHub App is installed: `/install-github-app`
2. App has permission to read issues and comment
3. The `@claude` mention is formatted correctly

---

## Advanced: Vercel Webhook Integration

For more granular control, you can set up a Vercel webhook that triggers Claude Code directly:

### Using Claude Hub (Advanced)

1. Deploy [Claude Hub](https://github.com/claude-did-this/claude-hub) as a webhook receiver
2. Add webhook in Vercel dashboard:
   - Go to **Project Settings** → **Webhooks**
   - Add endpoint: `https://your-claude-hub.com/webhook/vercel`
   - Select "Deployment Failed" event
3. Configure Claude Hub to run your fix script

This approach provides:
- Real-time response to failures
- Long-running autonomous fixes (hours if needed)
- Direct integration with Vercel's deployment system

---

## Cost Considerations

**Option 1 (Claude Code Action):**
- Uses your Anthropic API credits
- Typical fix attempt: ~10,000-50,000 tokens ($0.15-$0.75 per fix)
- Only charges when builds fail

**Option 2 (GitHub App):**
- Pricing depends on your Claude Code plan
- Check https://claude.ai/pricing for details

**Recommendation:** Start with Option 2 (issue-based) to review fixes manually, then switch to Option 1 when you're confident in the automation.

---

## Security Notes

- **API Keys**: Never commit API keys to the repository
- **Permissions**: Workflows only have write access to the repository, not your Vercel account
- **Review fixes**: Initially review automated commits before merging to production
- **Rate limiting**: GitHub Actions has usage limits; monitor in Settings → Billing

---

## Next Steps

1. Choose Option 1 or Option 2 (or use both!)
2. Add `ANTHROPIC_API_KEY` to repository secrets
3. Test with an intentional build failure
4. Monitor the automation and refine prompts as needed

**Questions?** Check:
- [Claude Code GitHub Actions Docs](https://code.claude.com/docs/en/github-actions)
- [Vercel Webhooks](https://vercel.com/docs/observability/webhooks-overview)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
