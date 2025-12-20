/**
 * Playwright Visual Regression Testing Configuration
 *
 * This configuration is specifically for visual regression tests.
 * It captures screenshots and compares them against baseline images.
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.visual.ts',

  // Snapshots configuration
  snapshotDir: './tests/visual-baseline',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  // Output directories
  outputDir: './tests/visual-results',

  // Timeout for each test
  timeout: 30 * 1000,

  // Fail the build on CI if visual differences are detected
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for visual tests
  workers: 1, // Run one at a time for consistency

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-visual-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

    // Visual testing specific settings
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: process.env.CI ? 'pnpm preview --port 5173' : 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
