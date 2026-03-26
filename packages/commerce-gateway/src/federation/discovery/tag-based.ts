/**
 * @betterdata/commerce-gateway - Tag-Based Discovery Provider
 *
 * Discovery provider using keyword extraction and synonym expansion.
 * More sophisticated than StaticDiscoveryProvider but still OSS.
 *
 * @example
 * ```typescript
 * import { TagBasedDiscoveryProvider, MemoryMerchantRegistry } from '@betterdata/commerce-gateway/federation';
 *
 * const registry = new MemoryMerchantRegistry([...merchants]);
 * const provider = new TagBasedDiscoveryProvider(registry, {
 *   synonyms: {
 *     'yoga': ['fitness', 'workout', 'wellness'],
 *   },
 * });
 *
 * // "yoga pants" will also match merchants in "fitness", "workout" categories
 * const merchants = await provider.discoverByIntent('yoga pants');
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
// Default Synonyms
// ============================================================================

/**
 * Default category synonyms for common shopping categories.
 */
export const DEFAULT_CATEGORY_SYNONYMS: Record<string, string[]> = {
  // Apparel
  activewear: ['athletic', 'sportswear', 'workout', 'fitness', 'athleisure', 'gym', 'yoga'],
  fashion: ['clothing', 'apparel', 'style', 'clothes', 'attire', 'wear'],
  footwear: ['shoes', 'sneakers', 'boots', 'sandals', 'footgear'],
  accessories: ['jewelry', 'watches', 'bags', 'belts', 'hats', 'scarves'],
  outerwear: ['jackets', 'coats', 'hoodies', 'sweaters'],
  
  // Electronics
  electronics: ['tech', 'gadgets', 'computers', 'devices', 'digital'],
  audio: ['headphones', 'speakers', 'earbuds', 'sound'],
  gaming: ['games', 'consoles', 'esports', 'videogames'],
  mobile: ['phones', 'tablets', 'smartphones', 'cellular'],
  
  // Home
  home: ['house', 'household', 'living', 'decor', 'interior'],
  furniture: ['chairs', 'tables', 'sofas', 'beds', 'desks'],
  kitchen: ['cookware', 'appliances', 'dining', 'cooking'],
  garden: ['outdoor', 'patio', 'yard', 'plants', 'landscaping'],
  
  // Sports & Outdoors
  sports: ['athletic', 'fitness', 'exercise', 'training'],
  running: ['jogging', 'marathon', 'track', 'cardio'],
  outdoor: ['camping', 'hiking', 'adventure', 'nature', 'wilderness'],
  cycling: ['bikes', 'biking', 'bicycle'],
  
  // Beauty & Health
  beauty: ['cosmetics', 'makeup', 'skincare', 'haircare'],
  wellness: ['health', 'fitness', 'selfcare', 'holistic'],
  skincare: ['skin', 'moisturizer', 'serum', 'cream'],
  
  // Luxury
  luxury: ['premium', 'designer', 'high-end', 'upscale', 'exclusive'],
  designer: ['luxury', 'premium', 'couture', 'high-fashion'],
};

// ============================================================================
// Tag-Based Discovery Provider
// ============================================================================

/**
 * Options for TagBasedDiscoveryProvider.
 */
export interface TagBasedDiscoveryOptions {
  /** Custom synonyms to add/override defaults */
  synonyms?: Record<string, string[]>;

  /** Merge with default synonyms (default: true) */
  mergeDefaults?: boolean;

  /** Minimum keyword length (default: 3) */
  minKeywordLength?: number;

  /** Weight for exact category match (default: 0.5) */
  exactMatchWeight?: number;

  /** Weight for synonym match (default: 0.3) */
  synonymMatchWeight?: number;

  /** Weight for description match (default: 0.2) */
  descriptionMatchWeight?: number;

  /** Weight for alias match (default: 0.4) */
  aliasMatchWeight?: number;
}

/**
 * Discovery provider using keyword extraction and synonym expansion.
 *
 * Features:
 * - Extracts keywords from user query
 * - Expands keywords with synonyms (e.g., "activewear" → "athletic", "workout")
 * - Scores merchants by keyword overlap with categories/aliases/description
 * - Ranks by relevance score
 *
 * @example
 * ```typescript
 * const provider = new TagBasedDiscoveryProvider(registry);
 *
 * // Query "running shoes" matches merchants in:
 * // - "running" category
 * // - "footwear" category (via "shoes" → "footwear" synonym)
 * // - "athletic" category (via "running" → "sports" → "athletic" synonym)
 * const results = await provider.discoverByIntent('running shoes');
 * ```
 */
export class TagBasedDiscoveryProvider implements DiscoveryProvider, CapabilityProvider {
  private registry: MerchantRegistry;
  private synonyms: Map<string, Set<string>>;
  private reverseIndex: Map<string, Set<string>>; // word → categories
  private minKeywordLength: number;
  private exactMatchWeight: number;
  private synonymMatchWeight: number;
  private descriptionMatchWeight: number;
  private aliasMatchWeight: number;

  constructor(registry: MerchantRegistry, options?: TagBasedDiscoveryOptions) {
    this.registry = registry;
    this.minKeywordLength = options?.minKeywordLength ?? 3;
    this.exactMatchWeight = options?.exactMatchWeight ?? 0.5;
    this.synonymMatchWeight = options?.synonymMatchWeight ?? 0.3;
    this.descriptionMatchWeight = options?.descriptionMatchWeight ?? 0.2;
    this.aliasMatchWeight = options?.aliasMatchWeight ?? 0.4;

    // Build synonym maps
    this.synonyms = new Map();
    this.reverseIndex = new Map();

    // Load defaults if requested
    if (options?.mergeDefaults !== false) {
      this.loadSynonyms(DEFAULT_CATEGORY_SYNONYMS);
    }

    // Load custom synonyms
    if (options?.synonyms) {
      this.loadSynonyms(options.synonyms);
    }
  }

  /**
   * Load synonyms into the internal maps.
   */
  private loadSynonyms(synonyms: Record<string, string[]>): void {
    for (const [category, words] of Object.entries(synonyms)) {
      const catLower = category.toLowerCase();

      if (!this.synonyms.has(catLower)) {
        this.synonyms.set(catLower, new Set());
      }

      for (const word of words) {
        const wordLower = word.toLowerCase();
        this.synonyms.get(catLower)!.add(wordLower);

        // Reverse index: word → categories
        if (!this.reverseIndex.has(wordLower)) {
          this.reverseIndex.set(wordLower, new Set());
        }
        this.reverseIndex.get(wordLower)!.add(catLower);
      }
    }
  }

  /**
   * Discover merchants by intent with synonym expansion.
   */
  async discoverByIntent(
    query: string,
    options?: DiscoverByIntentOptions
  ): Promise<DiscoveredMerchant[]> {
    const limit = options?.limit ?? 10;

    // Extract and expand keywords
    const keywords = this.extractKeywords(query);
    const expandedKeywords = this.expandWithSynonyms(keywords);

    // Get all merchants
    let merchants = await this.registry.list({ tier: options?.tier, limit: 200 });

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

    // Filter by explicit categories if provided
    if (options?.categories && options.categories.length > 0) {
      const categorySet = new Set(options.categories.map(c => c.toLowerCase()));
      merchants = merchants.filter(m =>
        m.metadata.categories.some(c => categorySet.has(c.toLowerCase()))
      );
    }

    // Score each merchant
    const scored = merchants.map(m => ({
      merchant: m,
      ...this.scoreMerchant(m, keywords, expandedKeywords, options?.boostVerified ?? true),
    }));

    // Filter out zero scores
    const nonZero = scored.filter(s => s.score > 0);

    // Sort by score
    nonZero.sort((a, b) => b.score - a.score);

    // Convert to DiscoveredMerchant
    return nonZero.slice(0, limit).map(({ merchant, score, reason }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      matchReason: reason,
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  /**
   * Suggest alternatives for a failed domain.
   */
  async suggestAlternatives(
    failedDomain: string,
    context?: SuggestAlternativesOptions
  ): Promise<DiscoveredMerchant[]> {
    const limit = context?.limit ?? 5;

    // Try to find the failed domain's categories
    const failedMerchant = await this.registry.get(failedDomain);
    let targetCategories: string[] = [];

    if (failedMerchant) {
      targetCategories = failedMerchant.metadata.categories;
    }

    // Add context category
    if (context?.category) {
      targetCategories.push(context.category);
    }

    // Expand categories with synonyms
    const expandedCategories = new Set<string>();
    for (const cat of targetCategories) {
      expandedCategories.add(cat.toLowerCase());
      const synonyms = this.synonyms.get(cat.toLowerCase());
      if (synonyms) {
        for (const syn of Array.from(synonyms)) {
          expandedCategories.add(syn);
        }
      }
    }

    // If we have a query, also use that
    if (context?.query) {
      const keywords = this.extractKeywords(context.query);
      const expanded = this.expandWithSynonyms(keywords);
      for (const kw of Array.from(expanded)) {
        expandedCategories.add(kw);
      }
    }

    // Find merchants with overlapping categories
    let merchants = await this.registry.list({ limit: 200 });

    // Exclude the failed domain
    merchants = merchants.filter(
      m => m.domain.toLowerCase() !== failedDomain.toLowerCase()
    );

    // Filter by verified if requested
    if (context?.verifiedOnly) {
      merchants = merchants.filter(m => m.tier === 'verified');
    }

    // Score by category overlap
    const scored = merchants.map(m => {
      let score = 0;
      let matchedCats: string[] = [];

      for (const cat of m.metadata.categories) {
        const catLower = cat.toLowerCase();
        if (expandedCategories.has(catLower)) {
          score += 0.4;
          matchedCats.push(cat);
        }
        // Check synonyms
        const catSynonyms = this.synonyms.get(catLower);
        if (catSynonyms) {
          for (const syn of Array.from(catSynonyms)) {
            if (expandedCategories.has(syn)) {
              score += 0.2;
              if (!matchedCats.includes(cat)) {
                matchedCats.push(cat);
              }
            }
          }
        }
      }

      return {
        merchant: m,
        score,
        reason: matchedCats.length > 0
          ? `Similar: ${matchedCats.slice(0, 3).join(', ')}`
          : 'General alternative',
      };
    });

    // Filter and sort
    const nonZero = scored.filter(s => s.score > 0);
    nonZero.sort((a, b) => b.score - a.score);

    return nonZero.slice(0, limit).map(({ merchant, score, reason }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      matchReason: reason,
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  /**
   * Get all known categories including synonyms.
   */
  async getKnownCategories(): Promise<string[]> {
    const categories = new Set<string>();

    // From registry
    const merchants = await this.registry.list({ limit: 1000 });
    for (const m of merchants) {
      for (const c of m.metadata.categories) {
        categories.add(c.toLowerCase());
      }
    }

    // From synonyms
    for (const cat of Array.from(this.synonyms.keys())) {
      categories.add(cat);
    }

    return Array.from(categories).sort();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Extract keywords from a query.
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they',
      'it', 'he', 'she', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'our',
      'find', 'search', 'show', 'get', 'buy', 'shop', 'looking', 'want', 'need',
      'some', 'any', 'best', 'good', 'new', 'where', 'what', 'how',
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= this.minKeywordLength && !stopWords.has(w));
  }

  /**
   * Expand keywords with synonyms.
   */
  private expandWithSynonyms(keywords: string[]): Set<string> {
    const expanded = new Set<string>(keywords);

    for (const keyword of keywords) {
      // Direct synonym lookup
      const synonyms = this.synonyms.get(keyword);
      if (synonyms) {
        for (const syn of Array.from(synonyms)) {
          expanded.add(syn);
        }
      }

      // Reverse lookup (keyword is a synonym of something)
      const categories = this.reverseIndex.get(keyword);
      if (categories) {
        for (const cat of Array.from(categories)) {
          expanded.add(cat);
        }
      }
    }

    return expanded;
  }

  /**
   * Score a merchant based on keyword matches.
   */
  private scoreMerchant(
    merchant: MerchantRegistration,
    directKeywords: string[],
    expandedKeywords: Set<string>,
    boostVerified: boolean
  ): { score: number; reason: string } {
    let score = 0;
    let reason = '';

    // Check categories
    for (const category of merchant.metadata.categories) {
      const catLower = category.toLowerCase();

      // Direct keyword match
      if (directKeywords.some(kw => catLower.includes(kw) || kw.includes(catLower))) {
        score += this.exactMatchWeight;
        reason = `Matches category: ${category}`;
      }

      // Expanded keyword match
      if (expandedKeywords.has(catLower)) {
        score += this.synonymMatchWeight;
        if (!reason) {
          reason = `Related to: ${category}`;
        }
      }
    }

    // Check aliases
    for (const alias of merchant.aliases) {
      const aliasLower = alias.toLowerCase();
      if (directKeywords.some(kw => aliasLower.includes(kw))) {
        score += this.aliasMatchWeight;
        if (!reason) {
          reason = `Matches brand name`;
        }
      }
    }

    // Check description
    if (merchant.metadata.description) {
      const descLower = merchant.metadata.description.toLowerCase();
      for (const kw of directKeywords) {
        if (descLower.includes(kw)) {
          score += this.descriptionMatchWeight;
          if (!reason) {
            reason = 'Matches description';
          }
        }
      }
    }

    // Verified boost
    if (boostVerified && merchant.tier === 'verified') {
      score *= 1.3;
      if (reason) {
        reason += ' (Verified)';
      }
    }

    return { score, reason };
  }

  /**
   * Add custom synonyms at runtime.
   */
  addSynonyms(category: string, synonyms: string[]): void {
    const catLower = category.toLowerCase();

    if (!this.synonyms.has(catLower)) {
      this.synonyms.set(catLower, new Set());
    }

    for (const syn of synonyms) {
      const synLower = syn.toLowerCase();
      this.synonyms.get(catLower)!.add(synLower);

      if (!this.reverseIndex.has(synLower)) {
        this.reverseIndex.set(synLower, new Set());
      }
      this.reverseIndex.get(synLower)!.add(catLower);
    }
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this discovery provider.
   *
   * TagBasedDiscoveryProvider supports:
   * - rankedResults: false (uses keyword scoring, not ML-powered)
   * - supportsFilters: true
   * - supportsPagination: true
   * - supportsTagSearch: true (primary feature)
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
          supportsTagSearch: true,
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
 * Create a tag-based discovery provider.
 */
export function createTagBasedDiscoveryProvider(
  registry: MerchantRegistry,
  options?: TagBasedDiscoveryOptions
): TagBasedDiscoveryProvider {
  return new TagBasedDiscoveryProvider(registry, options);
}

