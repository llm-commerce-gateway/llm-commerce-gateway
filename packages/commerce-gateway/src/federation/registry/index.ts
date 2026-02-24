/**
 * @betterdata/commerce-gateway - Merchant Registry Module
 *
 * Provides backend implementations for the merchant registry:
 * - MemoryMerchantRegistry: In-memory storage (dev/testing)
 * - FileMerchantRegistry: JSON file storage (single-instance)
 *
 * For distributed/cloud setups, implement the MerchantRegistry interface
 * with your own backend (database, API, etc.).
 *
 * @license MIT
 */

// ============================================================================
// Interface Exports
// ============================================================================

export type {
  MerchantRegistry,
  ListOptions,
  SearchOptions,
  RegistryEventType,
  RegistryEvent,
  RegistryEventListener,
  ObservableMerchantRegistry,
} from './interface';

// ============================================================================
// Implementation Exports
// ============================================================================

export {
  MemoryMerchantRegistry,
  createMemoryRegistry,
} from './memory';

export {
  FileMerchantRegistry,
  createFileRegistry,
} from './file';

// ============================================================================
// Factory Function
// ============================================================================

import type { MerchantRegistration } from '../types';
import type { MerchantRegistry } from './interface';
import { MemoryMerchantRegistry } from './memory';
import { FileMerchantRegistry } from './file';

/**
 * Registry backend type.
 */
export type RegistryBackendType = 'memory' | 'file';

/**
 * Configuration for creating a registry.
 */
export type RegistryConfig =
  | { type: 'memory'; initialMerchants?: MerchantRegistration[] }
  | { type: 'file'; filePath: string };

/**
 * Create a merchant registry from configuration.
 *
 * @param config - Registry configuration
 * @returns MerchantRegistry implementation
 *
 * @example
 * ```typescript
 * // In-memory registry (for development/testing)
 * const memoryRegistry = createRegistry({ type: 'memory' });
 *
 * // File-based registry (for single-instance deployments)
 * const fileRegistry = createRegistry({ type: 'file', filePath: './merchants.json' });
 *
 * // For cloud/distributed setups, implement MerchantRegistry directly:
 * class MyDatabaseRegistry implements MerchantRegistry {
 *   // ... your implementation
 * }
 * ```
 */
export function createRegistry(config: RegistryConfig): MerchantRegistry {
  switch (config.type) {
    case 'memory':
      return new MemoryMerchantRegistry(config.initialMerchants);

    case 'file':
      return new FileMerchantRegistry(config.filePath);

    default:
      throw new Error(`Unknown registry type: ${(config as RegistryConfig).type}`);
  }
}
