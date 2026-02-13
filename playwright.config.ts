import { defineConfig, devices } from '@playwright/test';

const PORT = 5176;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use preview (production build) in CI, dev server locally
    command: process.env.CI
      ? `pnpm build && pnpm preview --port ${PORT} --strictPort`
      : `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
    // Make e2e runs deterministic even when developers have dev-only invoice env vars set.
    // Invoice smoke tests validate proxy path behavior; forcing an empty direct-dev URL keeps
    // the client calling `/api/extract-invoice` in dev-server mode.
    env: {
      ...process.env,
      VITE_INVOICE_API_URL: '',
    },
  },
});
