/**
 * @betterdata/commerce-gateway - In-Memory Merchant Registry
 *
 * A simple in-memory implementation of the MerchantRegistry interface.
 * Ideal for development, testing, and single-instance deployments.
 *
 * @license MIT
 */

import type { MerchantRegistration, MerchantTier } from '../types';
import type { MerchantRegistry, ListOptions, SearchOptions } from './interface';
import type { CapabilityProvider, GatewayCapabilities } from '../../capabilities';
import { VERSION } from '../../version';

// ============================================================================
// In-Memory Merchant Registry
// ============================================================================

/**
 * In-memory implementation of the merchant registry.
 *
 * Uses Map data structures for O(1) lookups by domain and alias.
 * Category index enables efficient category-based discovery.
 *
 * Note: Data is lost on process restart. Use FileMerchantRegistry or
 * a database-backed implementation for persistence.
 *
 * @example
 * ```typescript
 * const registry = new MemoryMerchantRegistry();
 *
 * await registry.register({
 *   domain: 'nike.com',
 *   aliases: ['nike', 'nike store'],
 *   gatewayUrl: 'https://llm.nike.com/gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Nike', categories: ['athletic', 'footwear'] },
 * });
 *
 * const merchant = await registry.findByAlias('nike');
 * console.log(merchant?.metadata.name); // "Nike"
 * ```
 */
export class MemoryMerchantRegistry implements MerchantRegistry, CapabilityProvider {
  /** Primary storage: domain → MerchantRegistration */
  private merchants: Map<string, MerchantRegistration> = new Map();

  /** Alias index: lowercase alias → domain */
  private aliasIndex: Map<string, string> = new Map();

  /** Category index: lowercase category → Set of domains */
  private categoryIndex: Map<string, Set<string>> = new Map();

  /**
   * Create a new in-memory registry.
   *
   * @param initialMerchants - Optional array of merchants to pre-populate
   */
  constructor(initialMerchants?: MerchantRegistration[]) {
    if (initialMerchants) {
      for (const merchant of initialMerchants) {
        this.registerSync(merchant);
      }
    }
  }

  /**
   * Synchronous registration for constructor use.
   */
  private registerSync(merchant: MerchantRegistration): void {
    const domain = merchant.domain.toLowerCase();
    const existingMerchant = this.merchants.get(domain);

    // Remove old indexes if updating
    if (existingMerchant) {
      this.removeFromIndexes(existingMerchant);
    }

    // Store merchant with normalized domain
    const normalizedMerchant: MerchantRegistration = {
      ...merchant,
      domain,
      createdAt: existingMerchant?.createdAt ?? new Date(),
      updatedAt: new Date(),
      isActive: merchant.isActive ?? true,
    };

    this.merchants.set(domain, normalizedMerchant);
    this.addToIndexes(normalizedMerchant);
  }

  /**
   * Add merchant to alias and category indexes.
   */
  private addToIndexes(merchant: MerchantRegistration): void {
    const domain = merchant.domain.toLowerCase();

    // Index aliases (including domain itself)
    const allAliases = [domain, ...merchant.aliases.map(a => a.toLowerCase())];
    for (const alias of allAliases) {
      this.aliasIndex.set(alias, domain);
    }

    // Index categories
    for (const category of merchant.metadata.categories) {
      const normalizedCategory = category.toLowerCase();
      if (!this.categoryIndex.has(normalizedCategory)) {
        this.categoryIndex.set(normalizedCategory, new Set());
      }
      this.categoryIndex.get(normalizedCategory)!.add(domain);
    }
  }

  /**
   * Remove merchant from indexes.
   */
  private removeFromIndexes(merchant: MerchantRegistration): void {
    const domain = merchant.domain.toLowerCase();

    // Remove aliases
    const allAliases = [domain, ...merchant.aliases.map(a => a.toLowerCase())];
    for (const alias of allAliases) {
      this.aliasIndex.delete(alias);
    }

    // Remove from categories
    for (const category of merchant.metadata.categories) {
      const normalizedCategory = category.toLowerCase();
      this.categoryIndex.get(normalizedCategory)?.delete(domain);
    }
  }

  // ==========================================================================
  // MerchantRegistry Implementation
  // ==========================================================================

  async register(merchant: MerchantRegistration): Promise<void> {
    this.registerSync(merchant);
  }

  async unregister(domain: string): Promise<boolean> {
    const normalizedDomain = domain.toLowerCase();
    const merchant = this.merchants.get(normalizedDomain);

    if (!merchant) {
      return false;
    }

    this.removeFromIndexes(merchant);
    this.merchants.delete(normalizedDomain);
    return true;
  }

  async get(domain: string): Promise<MerchantRegistration | null> {
    const normalizedDomain = domain.toLowerCase();
    return this.merchants.get(normalizedDomain) ?? null;
  }

  async findByAlias(alias: string): Promise<MerchantRegistration | null> {
    const normalizedAlias = alias.toLowerCase();
    const domain = this.aliasIndex.get(normalizedAlias);

    if (!domain) {
      return null;
    }

    return this.merchants.get(domain) ?? null;
  }

  async findByCategory(category: string): Promise<MerchantRegistration[]> {
    const normalizedCategory = category.toLowerCase();
    const domains = this.categoryIndex.get(normalizedCategory);

    if (!domains || domains.size === 0) {
      return [];
    }

    const merchants: MerchantRegistration[] = [];
    for (const domain of Array.from(domains)) {
      const merchant = this.merchants.get(domain);
      if (merchant && merchant.isActive !== false) {
        merchants.push(merchant);
      }
    }

    return merchants;
  }

  async list(options?: ListOptions): Promise<MerchantRegistration[]> {
    let merchants = Array.from(this.merchants.values());

    // Filter by active status
    if (options?.activeOnly !== false) {
      merchants = merchants.filter(m => m.isActive !== false);
    }

    // Filter by tier
    if (options?.tier) {
      merchants = merchants.filter(m => m.tier === options.tier);
    }

    // Apply offset
    if (options?.offset) {
      merchants = merchants.slice(options.offset);
    }

    // Apply limit
    if (options?.limit) {
      merchants = merchants.slice(0, options.limit);
    }

    return merchants;
  }

  async search(options: SearchOptions): Promise<MerchantRegistration[]> {
    let merchants = Array.from(this.merchants.values()).filter(
      m => m.isActive !== false
    );

    // Filter by tier
    if (options.tier) {
      merchants = merchants.filter(m => m.tier === options.tier);
    }

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      const normalizedCategories = options.categories.map(c => c.toLowerCase());
      merchants = merchants.filter(m =>
        m.metadata.categories.some(c =>
          normalizedCategories.includes(c.toLowerCase())
        )
      );
    }

    // Filter by capabilities
    if (options.capabilities) {
      merchants = merchants.filter(m => {
        for (const [cap, required] of Object.entries(options.capabilities!)) {
          if (required && !m.capabilities[cap as keyof typeof m.capabilities]) {
            return false;
          }
        }
        return true;
      });
    }

    // Filter by query (search name, domain, aliases)
    if (options.query) {
      const query = options.query.toLowerCase();
      merchants = merchants.filter(
        m =>
          m.domain.toLowerCase().includes(query) ||
          m.metadata.name.toLowerCase().includes(query) ||
          m.aliases.some(a => a.toLowerCase().includes(query))
      );
    }

    // Apply limit
    if (options.limit) {
      merchants = merchants.slice(0, options.limit);
    }

    return merchants;
  }

  async updateTier(domain: string, tier: MerchantTier): Promise<void> {
    const normalizedDomain = domain.toLowerCase();
    const merchant = this.merchants.get(normalizedDomain);

    if (!merchant) {
      throw new Error(`Merchant not found: ${domain}`);
    }

    merchant.tier = tier;
    merchant.updatedAt = new Date();
  }

  async has(domain: string): Promise<boolean> {
    return this.merchants.has(domain.toLowerCase());
  }

  async count(): Promise<number> {
    return this.merchants.size;
  }

  async clear(): Promise<void> {
    this.merchants.clear();
    this.aliasIndex.clear();
    this.categoryIndex.clear();
  }

  // ==========================================================================
  // Additional Utility Methods
  // ==========================================================================

  /**
   * Get all registered domains.
   */
  getDomains(): string[] {
    return Array.from(this.merchants.keys());
  }

  /**
   * Get all registered aliases.
   */
  getAliases(): Map<string, string> {
    return new Map(this.aliasIndex);
  }

  /**
   * Get all categories with merchant counts.
   */
  getCategories(): Map<string, number> {
    const categories = new Map<string, number>();
    for (const [category, domains] of Array.from(this.categoryIndex.entries())) {
      categories.set(category, domains.size);
    }
    return categories;
  }

  /**
   * Export all merchants as an array (for serialization).
   */
  export(): MerchantRegistration[] {
    return Array.from(this.merchants.values());
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this registry.
   *
   * MemoryMerchantRegistry supports:
   * - merchantWrite: true (can register/update merchants)
   * - verificationAutomation: false (no automated verification)
   * - supportsPrivateHubs: false (OSS feature)
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    return {
      specVersion: '2025-12-22',
      gatewayVersion: VERSION,
      features: {
        registry: {
          merchantWrite: true,
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
          dnsTxt: true,
          metaTag: true,
          callbackChallenge: true,
          manualReview: false,
        },
      },
    };
  }

  /**
   * Import merchants from an array (for deserialization).
   */
  import(merchants: MerchantRegistration[]): void {
    this.clear();
    for (const merchant of merchants) {
      this.registerSync(merchant);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new in-memory merchant registry.
 *
 * @param initialMerchants - Optional initial merchants
 * @returns MemoryMerchantRegistry instance
 */
export function createMemoryRegistry(
  initialMerchants?: MerchantRegistration[]
): MemoryMerchantRegistry {
  return new MemoryMerchantRegistry(initialMerchants);
}

