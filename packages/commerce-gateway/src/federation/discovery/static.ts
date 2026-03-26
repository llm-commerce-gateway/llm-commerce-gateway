/**
 * @betterdata/commerce-gateway - Static Discovery Provider
 *
 * Simple discovery provider that uses basic category matching.
 * Good for development, testing, or small merchant catalogs.
 *
 * @example
 * ```typescript
 * import { StaticDiscoveryProvider, MemoryMerchantRegistry } from '@betterdata/commerce-gateway/federation';
 *
 * const registry = new MemoryMerchantRegistry([...merchants]);
 * const provider = new StaticDiscoveryProvider(registry);
 *
 * const merchants = await provider.discoverByIntent('running shoes');
 * ```
 *
 * @license Apache-2.0
 */

import type { MerchantRegistry } from '../registry/interface';
import type { DiscoveredMerchant, MerchantRegistration } from '../types';
import type {
  DiscoveryProvider,
  DiscoverByIntentOptions,
  SuggestAlternativesOptions,
} from './interface';
import type { CapabilityProvider, GatewayCapabilities } from '../../capabilities';
import { VERSION } from '../../version';

// ============================================================================
// Static Discovery Provider
// ============================================================================

/**
 * Simple discovery provider using category filtering.
 *
 * This is the most basic implementation:
 * - discoverByIntent: Returns merchants filtered by category (if specified)
 * - suggestAlternatives: Finds merchants with overlapping categories
 *
 * For more sophisticated discovery, use TagBasedDiscoveryProvider or
 * RemoteDiscoveryProvider.
 */
export class StaticDiscoveryProvider implements DiscoveryProvider, CapabilityProvider {
  private registry: MerchantRegistry;

  /**
   * Create a new StaticDiscoveryProvider.
   *
   * @param registry - Merchant registry to query
   */
  constructor(registry: MerchantRegistry) {
    this.registry = registry;
  }

  /**
   * Discover merchants by category filtering.
   *
   * If categories are specified in options, returns merchants in those categories.
   * Otherwise, returns all merchants up to the limit.
   */
  async discoverByIntent(
    query: string,
    options?: DiscoverByIntentOptions
  ): Promise<DiscoveredMerchant[]> {
    const limit = options?.limit ?? 10;
    let merchants: MerchantRegistration[] = [];

    // Filter by category if specified
    if (options?.categories && options.categories.length > 0) {
      for (const category of options.categories) {
        const categoryMerchants = await this.registry.findByCategory(category);
        merchants.push(...categoryMerchants);
      }
      // Deduplicate
      merchants = this.deduplicateMerchants(merchants);
    } else {
      // Get all merchants
      merchants = await this.registry.list({ tier: options?.tier, limit: 100 });
    }

    // Filter by capabilities if required
    if (options?.requireCapabilities) {
      merchants = merchants.filter(m => {
        for (const [cap, required] of Object.entries(options.requireCapabilities!)) {
          if (required && !m.capabilities[cap as keyof typeof m.capabilities]) {
            return false;
          }
        }
        return true;
      });
    }

    // Filter by tier if specified
    if (options?.tier) {
      merchants = merchants.filter(m => m.tier === options.tier);
    }

    // Simple keyword matching for relevance scoring
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = merchants.map(m => ({
      merchant: m,
      score: this.calculateScore(m, queryWords, options?.boostVerified ?? true),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Convert to DiscoveredMerchant
    return scored.slice(0, limit).map(({ merchant, score }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      matchReason: this.getMatchReason(merchant, queryWords),
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  /**
   * Suggest alternatives for a failed domain.
   *
   * Finds merchants with overlapping categories.
   */
  async suggestAlternatives(
    failedDomain: string,
    context?: SuggestAlternativesOptions
  ): Promise<DiscoveredMerchant[]> {
    const limit = context?.limit ?? 5;
    let targetCategories: string[] = [];

    // Try to find the failed domain's categories (if it exists)
    const failedMerchant = await this.registry.get(failedDomain);
    if (failedMerchant) {
      targetCategories = failedMerchant.metadata.categories;
    }

    // Add context category if provided
    if (context?.category && !targetCategories.includes(context.category)) {
      targetCategories.push(context.category);
    }

    // If no categories, use query words to infer
    if (targetCategories.length === 0 && context?.query) {
      // Simple: treat query words as potential categories
      targetCategories = context.query
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3);
    }

    // Find merchants with overlapping categories
    let candidates: MerchantRegistration[] = [];

    for (const category of targetCategories) {
      const categoryMerchants = await this.registry.findByCategory(category);
      candidates.push(...categoryMerchants);
    }

    // Deduplicate and exclude the failed domain
    candidates = this.deduplicateMerchants(candidates).filter(
      m => m.domain.toLowerCase() !== failedDomain.toLowerCase()
    );

    // Filter by verified if requested
    if (context?.verifiedOnly) {
      candidates = candidates.filter(m => m.tier === 'verified');
    }

    // Score by category overlap
    const scored = candidates.map(m => ({
      merchant: m,
      score: this.calculateCategoryOverlap(m.metadata.categories, targetCategories),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ merchant, score }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      matchReason: `Similar category: ${merchant.metadata.categories.join(', ')}`,
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  /**
   * Get known categories from the registry.
   */
  async getKnownCategories(): Promise<string[]> {
    const merchants = await this.registry.list({ limit: 1000 });
    const categories = new Set<string>();

    for (const m of merchants) {
      for (const c of m.metadata.categories) {
        categories.add(c.toLowerCase());
      }
    }

    return Array.from(categories).sort();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private deduplicateMerchants(
    merchants: MerchantRegistration[]
  ): MerchantRegistration[] {
    const seen = new Set<string>();
    return merchants.filter(m => {
      if (seen.has(m.domain)) return false;
      seen.add(m.domain);
      return true;
    });
  }

  private calculateScore(
    merchant: MerchantRegistration,
    queryWords: string[],
    boostVerified: boolean
  ): number {
    let score = 0.1; // Base score for being in registry

    // Category matches
    for (const category of merchant.metadata.categories) {
      const catLower = category.toLowerCase();
      for (const word of queryWords) {
        if (catLower.includes(word) || word.includes(catLower)) {
          score += 0.3;
        }
      }
    }

    // Description matches
    if (merchant.metadata.description) {
      const descLower = merchant.metadata.description.toLowerCase();
      for (const word of queryWords) {
        if (descLower.includes(word)) {
          score += 0.2;
        }
      }
    }

    // Name matches
    const nameLower = merchant.metadata.name.toLowerCase();
    for (const word of queryWords) {
      if (nameLower.includes(word)) {
        score += 0.4;
      }
    }

    // Verified boost
    if (boostVerified && merchant.tier === 'verified') {
      score *= 1.3;
    }

    return score;
  }

  private calculateCategoryOverlap(
    merchantCategories: string[],
    targetCategories: string[]
  ): number {
    const merchantSet = new Set(merchantCategories.map(c => c.toLowerCase()));
    const targetSet = new Set(targetCategories.map(c => c.toLowerCase()));

    let overlap = 0;
    for (const cat of Array.from(merchantSet)) {
      if (targetSet.has(cat)) {
        overlap++;
      }
    }

    return overlap / Math.max(1, targetSet.size);
  }

  private getMatchReason(
    merchant: MerchantRegistration,
    queryWords: string[]
  ): string {
    // Check categories
    for (const category of merchant.metadata.categories) {
      const catLower = category.toLowerCase();
      for (const word of queryWords) {
        if (catLower.includes(word) || word.includes(catLower)) {
          return `Matches category: ${category}`;
        }
      }
    }

    // Check name
    const nameLower = merchant.metadata.name.toLowerCase();
    for (const word of queryWords) {
      if (nameLower.includes(word)) {
        return `Matches store name`;
      }
    }

    // Check description
    if (merchant.metadata.description) {
      return 'Matches description';
    }

    return 'General match';
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this discovery provider.
   *
   * StaticDiscoveryProvider supports:
   * - rankedResults: false (uses simple scoring, not ML-powered)
   * - supportsFilters: true
   * - supportsPagination: true
   * - supportsTagSearch: false (category-based only)
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    return {
      specVersion: '2025-12-22',
      gatewayVersion: VERSION,
      features: {
        registry: {
          merchantWrite: false,
          verificationAutomation: false,
          supportsPrivateHubs: false,
        },
        discovery: {
          rankedResults: false,
          supportsFilters: true,
          supportsPagination: true,
          supportsTagSearch: false,
        },
        analytics: {
          events: [],
          realtime: false,
        },
        verification: {
          dnsTxt: false,
          metaTag: false,
          callbackChallenge: false,
          manualReview: false,
        },
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a static discovery provider.
 */
export function createStaticDiscoveryProvider(
  registry: MerchantRegistry
): StaticDiscoveryProvider {
  return new StaticDiscoveryProvider(registry);
}

