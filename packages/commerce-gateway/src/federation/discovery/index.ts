/**
 * @betterdata/llm-gateway - Discovery Module
 *
 * Pluggable discovery providers for finding relevant merchants.
 *
 * Available Providers:
 * - StaticDiscoveryProvider: Simple category filtering
 * - TagBasedDiscoveryProvider: Keyword + synonym expansion
 * - CompositeDiscoveryProvider: Combine providers with fallback
 *
 * For ML-powered discovery or cloud-based ranking, implement the
 * DiscoveryProvider interface with your own backend.
 *
 * @example
 * ```typescript
 * import {
 *   TagBasedDiscoveryProvider,
 *   CompositeDiscoveryProvider,
 * } from '@betterdata/llm-gateway/federation';
 *
 * // Use tag-based for local development
 * const localProvider = new TagBasedDiscoveryProvider(registry);
 *
 * // Or combine with your own remote provider
 * class MyMLProvider implements DiscoveryProvider {
 *   // ... your ML-powered implementation
 * }
 *
 * const provider = new CompositeDiscoveryProvider({
 *   primary: new MyMLProvider(),
 *   fallback: localProvider,
 * });
 * ```
 *
 * @license MIT
 */

// ============================================================================
// Interface Exports
// ============================================================================

export type {
  DiscoveryProvider,
  DiscoverByIntentOptions,
  SuggestAlternativesOptions,
  CompositeProviderOptions,
} from './interface';

export { CompositeDiscoveryProvider } from './interface';

// ============================================================================
// Provider Exports
// ============================================================================

export {
  StaticDiscoveryProvider,
  createStaticDiscoveryProvider,
} from './static';

export {
  TagBasedDiscoveryProvider,
  createTagBasedDiscoveryProvider,
  DEFAULT_CATEGORY_SYNONYMS,
  type TagBasedDiscoveryOptions,
} from './tag-based';

// ============================================================================
// Factory Function
// ============================================================================

import type { MerchantRegistry } from '../registry/interface';
import type { DiscoveryProvider } from './interface';
import { StaticDiscoveryProvider } from './static';
import { TagBasedDiscoveryProvider } from './tag-based';
import { CompositeDiscoveryProvider } from './interface';

/**
 * Discovery provider configuration.
 */
export type DiscoveryProviderConfig =
  | { type: 'static'; registry: MerchantRegistry }
  | { type: 'tag-based'; registry: MerchantRegistry; synonyms?: Record<string, string[]> }
  | { type: 'composite'; primary: DiscoveryProviderConfig; fallback: DiscoveryProviderConfig };

/**
 * Create a discovery provider from configuration.
 *
 * @param config - Provider configuration
 * @returns DiscoveryProvider implementation
 *
 * @example
 * ```typescript
 * // Static provider (simple category matching)
 * const provider = createDiscoveryProvider({ type: 'static', registry });
 *
 * // Tag-based provider (keyword + synonym expansion)
 * const provider = createDiscoveryProvider({
 *   type: 'tag-based',
 *   registry,
 *   synonyms: { 'yoga': ['fitness', 'wellness'] },
 * });
 *
 * // For ML-powered discovery, implement DiscoveryProvider directly:
 * class MyMLDiscoveryProvider implements DiscoveryProvider {
 *   async discoverByIntent(query, opts) {
 *     // Call your ML ranking service
 *   }
 *   async suggestAlternatives(failedDomain, context) {
 *     // Return similar merchants
 *   }
 * }
 * ```
 */
export function createDiscoveryProvider(
  config: DiscoveryProviderConfig
): DiscoveryProvider {
  switch (config.type) {
    case 'static':
      return new StaticDiscoveryProvider(config.registry);

    case 'tag-based':
      return new TagBasedDiscoveryProvider(config.registry, {
        synonyms: config.synonyms,
      });

    case 'composite':
      return new CompositeDiscoveryProvider({
        primary: createDiscoveryProvider(config.primary),
        fallback: createDiscoveryProvider(config.fallback),
      });

    default:
      throw new Error(`Unknown discovery provider type: ${(config as DiscoveryProviderConfig).type}`);
  }
}
