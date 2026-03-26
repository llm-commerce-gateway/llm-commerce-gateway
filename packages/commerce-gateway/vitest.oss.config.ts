/**
 * @betterdata/commerce-gateway - OSS Vitest Configuration
 * 
 * Test configuration for OSS-only tests (no Prisma/database dependencies).
 * Run with: pnpm vitest --config vitest.oss.config.ts
 * 
 * @license Apache-2.0
 */

import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  test: {
    // Use global test APIs
    globals: true,

    // Node environment for server-side testing
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/**',
        'examples/**',
        'docs/**',
        '**/*.d.ts',
        '**/types.ts',
        'vitest.config.ts',
        'vitest.oss.config.ts',
        'tsup.config.ts',
      ],
    },

    // Setup files run before each test file
    setupFiles: ['./tests/setup.ts'],

    // OSS-only tests: no Prisma, no Better Data SaaS modules
    include: [
      'tests/unit/errors.test.ts',
      'tests/unit/logger.test.ts',
      'tests/unit/validation.test.ts',
      'tests/unit/capabilities.test.ts',
    ],

    // Exclude cloud/SaaS tests that depend on Prisma or Better Data modules
    exclude: [
      'node_modules',
      'dist',
      'examples',
      // Explicitly exclude cloud/SaaS tests
      'tests/unit/admin/**',
      'tests/unit/analytics/**',
      'tests/unit/catalog/**',
      'tests/unit/tools/**',
      'tests/e2e/**',
      'tests/integration/**',
    ],

    // Timeout for tests
    testTimeout: 10000,

    // Pool options for parallel tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Reporter configuration
    reporters: ['verbose'],

    // Type checking
    typecheck: {
      enabled: false,
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});

