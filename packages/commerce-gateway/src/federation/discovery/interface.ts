/**
 * @betterdata/commerce-gateway - Discovery Provider Interface
 *
 * Defines the contract for merchant discovery providers.
 * Providers can implement different strategies for finding relevant merchants.
 *
 * @example
 * ```typescript
 * import type { DiscoveryProvider } from '@betterdata/commerce-gateway/federation';
 *
 * class MyCustomProvider implements DiscoveryProvider {
 *   async discoverByIntent(query, opts) {
 *     // Custom ML-powered discovery
 *     return [...];
 *   }
 *
 *   async suggestAlternatives(failedDomain, context) {
 *     // Find similar stores
 *     return [...];
 *   }
 * }
 * ```
 *
 * @license Apache-2.0
 */

import type { DiscoveredMerchant, MerchantTier } from '../types';

// ============================================================================
// Discovery Options
// ============================================================================

/**
 * Options for intent-based discovery.
 */
export interface DiscoverByIntentOptions {
  /** Maximum number of merchants to return */
  limit?: number;

  /** Filter by categories */
  categories?: string[];

  /** Filter by tier */
  tier?: MerchantTier;

  /** Only include merchants with specific capabilities */
  requireCapabilities?: {
    search?: boolean;
    cart?: boolean;
    checkout?: boolean;
    inventory?: boolean;
    recommendations?: boolean;
  };

  /** Boost verified merchants */
  boostVerified?: boolean;
}

/**
 * Options for suggesting alternatives.
 */
export interface SuggestAlternativesOptions {
  /** Category context (e.g., what category was the user looking for) */
  category?: string;

  /** Query context (e.g., what was the user searching for) */
  query?: string;

  /** Maximum number of alternatives */
  limit?: number;

  /** Only suggest verified merchants */
  verifiedOnly?: boolean;
}

// ============================================================================
// Discovery Provider Interface
// ============================================================================

/**
 * Interface for merchant discovery providers.
 *
 * Discovery providers are responsible for finding relevant merchants
 * based on user intent or suggesting alternatives when a merchant
 * is not available.
 *
 * Implementations can use different strategies:
 * - Static: Simple category matching (StaticDiscoveryProvider)
 * - Tag-based: Keyword + synonym expansion (TagBasedDiscoveryProvider)
 * - Remote: ML-powered ranking via API (RemoteDiscoveryProvider)
 * - Custom: Any custom implementation
 *
 * @example
 * ```typescript
 * // Use with DiscoverMerchantsTool
 * const provider = new TagBasedDiscoveryProvider(registry);
 * const tool = new DiscoverMerchantsTool(registry, provider);
 *
 * // Direct usage
 * const merchants = await provider.discoverByIntent('running shoes', {
 *   limit: 5,
 *   categories: ['athletic', 'footwear'],
 * });
 * ```
 */
export interface DiscoveryProvider {
  /**
   * Discover merchants matching a user intent/query.
   *
   * @param query - User's search query or intent description
   * @param options - Discovery options
   * @returns Ranked list of relevant merchants
   *
   * @example
   * ```typescript
   * const merchants = await provider.discoverByIntent('running shoes', {
   *   limit: 5,
   *   categories: ['athletic'],
   * });
   *
   * for (const m of merchants) {
   *   console.log(`${m.name} (${m.relevanceScore}): ${m.matchReason}`);
   * }
   * ```
   */
  discoverByIntent(
    query: string,
    options?: DiscoverByIntentOptions
  ): Promise<DiscoveredMerchant[]>;

  /**
   * Suggest alternative merchants when a requested one is not available.
   *
   * @param failedDomain - Domain that was requested but not found
   * @param context - Context about what the user was looking for
   * @returns List of alternative merchants
   *
   * @example
   * ```typescript
   * // User asked for "randomstore.com" which isn't registered
   * const alternatives = await provider.suggestAlternatives('randomstore.com', {
   *   category: 'activewear',
   *   query: 'joggers',
   * });
   *
   * // Suggest these alternatives to the user
   * ```
   */
  suggestAlternatives(
    failedDomain: string,
    context?: SuggestAlternativesOptions
  ): Promise<DiscoveredMerchant[]>;

  /**
   * Optional: Get categories that the provider knows about.
   */
  getKnownCategories?(): Promise<string[]>;

  /**
   * Optional: Warm up the provider (e.g., load data, connect to service).
   */
  warmup?(): Promise<void>;

  /**
   * Optional: Health check for the provider.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

// ============================================================================
// Composite Provider
// ============================================================================

/**
 * Options for the composite provider.
 */
export interface CompositeProviderOptions {
  /** Primary provider (used first) */
  primary: DiscoveryProvider;

  /** Fallback provider (used if primary fails or returns empty) */
  fallback: DiscoveryProvider;

  /** Minimum results from primary before using fallback */
  minResultsFromPrimary?: number;
}

/**
 * A provider that combines multiple providers with fallback.
 *
 * Tries the primary provider first, falls back to secondary if:
 * - Primary throws an error
 * - Primary returns fewer than minResultsFromPrimary results
 */
export class CompositeDiscoveryProvider implements DiscoveryProvider {
  private primary: DiscoveryProvider;
  private fallback: DiscoveryProvider;
  private minResults: number;

  constructor(options: CompositeProviderOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
    this.minResults = options.minResultsFromPrimary ?? 1;
  }

  async discoverByIntent(
    query: string,
    options?: DiscoverByIntentOptions
  ): Promise<DiscoveredMerchant[]> {
    try {
      const results = await this.primary.discoverByIntent(query, options);
      if (results.length >= this.minResults) {
        return results;
      }
      // Not enough results, try fallback
      const fallbackResults = await this.fallback.discoverByIntent(query, options);
      // Combine, deduplicating by domain
      return this.mergeResults(results, fallbackResults);
    } catch {
      // Primary failed, use fallback
      return this.fallback.discoverByIntent(query, options);
    }
  }

  async suggestAlternatives(
    failedDomain: string,
    context?: SuggestAlternativesOptions
  ): Promise<DiscoveredMerchant[]> {
    try {
      const results = await this.primary.suggestAlternatives(failedDomain, context);
      if (results.length >= this.minResults) {
        return results;
      }
      const fallbackResults = await this.fallback.suggestAlternatives(failedDomain, context);
      return this.mergeResults(results, fallbackResults);
    } catch {
      return this.fallback.suggestAlternatives(failedDomain, context);
    }
  }

  private mergeResults(
    primary: DiscoveredMerchant[],
    fallback: DiscoveredMerchant[]
  ): DiscoveredMerchant[] {
    const seen = new Set(primary.map(m => m.domain));
    const merged = [...primary];

    for (const m of fallback) {
      if (!seen.has(m.domain)) {
        merged.push(m);
        seen.add(m.domain);
      }
    }

    return merged;
  }
}

