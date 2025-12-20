import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Global test utilities
    globals: true,

    // Include patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/integration/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e/**/*', // E2E tests handled by Playwright
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Only measure coverage for files we have tests for
      include: [
        'src/lib/errors.ts',
        'src/lib/logger.ts',
        'src/lib/filters.ts',
        'src/lib/ai/index.ts', // Category mapping - has tests
        'src/hooks/useLowStockAlerts.ts',
      ],
      exclude: [
        'src/lib/ai/openFoodFacts.ts', // External API - would need fetch mocking
        'src/lib/ai/types.ts', // Type definitions only
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
      ],
      thresholds: {
        // High coverage for tested files (they should be well-tested)
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },

    // Timeout for tests
    testTimeout: 10000,

    // Reporter
    reporters: ['verbose'],
  },

  // Path aliases matching vite.config.ts
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
