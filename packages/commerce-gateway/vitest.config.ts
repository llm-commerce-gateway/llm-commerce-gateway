/**
 * @betterdata/commerce-gateway - Vitest Configuration
 * 
 * Test configuration for the Universal LLM Gateway.
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
        'tsup.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Setup files run before each test file
    setupFiles: ['./tests/setup.ts'],

    // Include patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'examples'],

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
      enabled: false, // Disable for speed, use separate typecheck script
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});

