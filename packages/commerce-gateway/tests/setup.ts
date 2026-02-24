/**
 * @betterdata/commerce-gateway - Test Setup
 * 
 * Global test configuration and utilities.
 * 
 * @license MIT
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { resetLogger, setLogger, NoOpLogger } from '../src/observability/index';

// ============================================================================
// Environment Setup
// ============================================================================

// Set test environment
(process.env as Record<string, string>).NODE_ENV = 'test';

// ============================================================================
// Global Mocks
// ============================================================================

// Mock console to reduce noise during tests
const originalConsole = { ...console };

beforeEach(() => {
  // Use NoOpLogger during tests to reduce noise
  setLogger(new NoOpLogger());
  
  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  // Reset logger
  resetLogger();
  
  // Restore timers if fake timers were used
  vi.useRealTimers();
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, duration: Date.now() - start };
}

/**
 * Generate a random ID for testing
 */
export function randomId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Helper to create partial mock objects with type safety
 */
export function createPartialMock<T>(partial: Partial<T>): T {
  return partial as T;
}

// Export vitest utilities for convenience
export { vi, expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

