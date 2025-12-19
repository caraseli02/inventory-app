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
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/**/*.ts',
        'src/hooks/**/*.ts',
        'src/hooks/**/*.tsx',
        'src/components/**/*.tsx',
      ],
      exclude: [
        'src/lib/database.types.ts', // Generated file
        'src/components/ui/**/*.tsx', // shadcn primitives
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
      ],
      thresholds: {
        // MVP-level coverage thresholds
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
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
