# Visual Regression Testing

This project includes automated visual regression testing to detect unintended UI changes.

## Overview

Visual regression testing captures screenshots of key pages and components, then compares them against baseline images to detect visual differences. This helps catch:
- Unintended layout changes
- CSS regressions
- Responsive design issues
- Component rendering bugs

## Running Visual Tests Locally

### Capture Baseline Screenshots (First Time)

```bash
# Build the app first
pnpm build

# Capture baseline screenshots
pnpm test:visual:update
```

This creates baseline screenshots in `tests/visual-baseline/`.

### Run Visual Regression Tests

```bash
# Run visual tests against baseline
pnpm test:visual
```

This compares current screenshots against the baseline and reports any differences.

### Update Baseline Screenshots

When you intentionally change the UI and want to update the baseline:

```bash
pnpm test:visual:update
```

### Interactive Mode

Run visual tests in Playwright UI mode for debugging:

```bash
pnpm test:visual:ui
```

## GitHub Actions Integration

### Trigger Visual Tests on Pull Requests

Visual regression tests can be triggered by commenting on a PR with slash commands:

#### Run Visual Tests

Comment `/visual-test` or `/vrt` on any PR to trigger visual regression testing.

**What happens:**
1. The workflow checks out your PR branch
2. Builds the application
3. Downloads baseline screenshots
4. Captures current screenshots
5. Compares current vs baseline
6. Comments results back on the PR
7. Uploads difference images as artifacts

**Example:**
```
/visual-test
```

The bot will react with 👀 while running, then:
- 👍 if no differences detected
- 😕 if visual differences found

#### Update Baseline

If visual differences are intentional and you want to update the baseline:

Comment `/update-baseline` or `/approve-visual` on the PR.

**What happens:**
1. Captures new baseline screenshots
2. Uploads them as artifacts for future comparisons
3. Comments confirmation on the PR

**Example:**
```
/update-baseline
```

## Test Structure

Visual tests are located in `tests/visual/` and use the `.visual.ts` extension.

### Example Test

```typescript
import { test, expect } from '@playwright/test'

test('home page layout', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Take screenshot and compare against baseline
  await expect(page).toHaveScreenshot('home-page.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
```

### Best Practices

1. **Disable animations**: Use `animations: 'disabled'` to prevent flaky tests
2. **Wait for content**: Ensure pages are fully loaded before capturing
3. **Use descriptive names**: Screenshot names should clearly identify what they test
4. **Test responsive**: Include mobile, tablet, and desktop viewports
5. **Isolate components**: Test individual components in addition to full pages

## Directory Structure

```
tests/
├── visual/                    # Visual regression test files
│   └── pages.visual.ts       # Example: page layout tests
├── visual-baseline/          # Baseline screenshots (gitignored)
├── visual-current/           # Current screenshots (gitignored)
├── visual-diff/              # Difference images (gitignored)
└── visual-results/           # Test output (gitignored)
```

## Configuration

Visual tests use `playwright.visual.config.ts`:

- **Snapshot directory**: `tests/visual-baseline/`
- **Output directory**: `tests/visual-results/`
- **Test match pattern**: `**/*.visual.ts`
- **Workers**: 1 (sequential execution for consistency)
- **Retries**: 0 (visual tests should be deterministic)

## Workflow Files

- **`.github/workflows/visual-regression.yml`**: GitHub Actions workflow for PR-triggered visual tests
- **`playwright.visual.config.ts`**: Playwright configuration for visual tests
- **`tests/visual/pages.visual.ts`**: Example visual regression tests

## Common Issues

### False Positives

If you get differences due to dynamic content (timestamps, random IDs):
- Use fixed test data
- Mock dynamic APIs
- Hide or mask dynamic elements

### Baseline Mismatches

If baseline screenshots are out of date:
1. Verify changes are intentional
2. Update baseline: `pnpm test:visual:update`
3. Commit new baseline screenshots

### CI vs Local Differences

If screenshots differ between CI and local:
- Ensure you're using the same Playwright browser version
- Check for font rendering differences
- Use Docker to run tests in CI-like environment

## Integration with Selective Testing

Visual regression tests are separate from the main test suite and must be triggered manually via PR comments. This prevents:
- Slow CI runs on every commit
- Unnecessary visual checks for non-UI changes
- Baseline screenshot pollution

Run visual tests when:
- Making UI changes
- Updating styles or themes
- Refactoring components
- Before major releases

## Troubleshooting

### No baseline screenshots

**Error**: "Baseline screenshot not found"

**Fix**: Run `pnpm test:visual:update` to create baseline screenshots.

### Screenshots don't match

**Error**: "Screenshot comparison failed"

**Fix**:
1. Review the diff images in `tests/visual-diff/`
2. If changes are intentional: `pnpm test:visual:update`
3. If changes are bugs: fix the UI and re-run tests

### Workflow not triggering

**Error**: PR comment doesn't trigger workflow

**Fix**:
- Ensure comment is exactly `/visual-test` or `/vrt`
- Check GitHub Actions permissions
- Verify workflow file is on the base branch

## Resources

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [GitHub Actions Workflows](https://docs.github.com/en/actions)
- [Pull Request Comments](https://docs.github.com/en/rest/issues/comments)
