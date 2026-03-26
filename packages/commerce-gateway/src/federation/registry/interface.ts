/**
 * @betterdata/commerce-gateway - Merchant Registry Interface
 *
 * Defines the contract for merchant registry backends.
 * Implementations include in-memory, file-based, and HTTP (remote) registries.
 *
 * @license Apache-2.0
 */

import type { MerchantRegistration, MerchantTier } from '../types';

// ============================================================================
// Registry Options
// ============================================================================

/**
 * Options for listing merchants.
 */
export interface ListOptions {
  /** Filter by trust tier */
  tier?: MerchantTier;

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Only return active merchants */
  activeOnly?: boolean;
}

/**
 * Options for searching merchants.
 */
export interface SearchOptions {
  /** Search query (matches name, domain, aliases) */
  query?: string;

  /** Filter by categories */
  categories?: string[];

  /** Filter by capabilities */
  capabilities?: {
    search?: boolean;
    cart?: boolean;
    checkout?: boolean;
    inventory?: boolean;
    recommendations?: boolean;
  };

  /** Filter by tier */
  tier?: MerchantTier;

  /** Maximum results */
  limit?: number;
}

// ============================================================================
// Merchant Registry Interface
// ============================================================================

/**
 * Interface for merchant registry backends.
 *
 * The registry stores and indexes merchant registrations, enabling:
 * - Direct lookup by domain
 * - Alias resolution (brand name → domain)
 * - Category-based discovery
 * - Tier-based filtering
 *
 * @example
 * ```typescript
 * const registry: MerchantRegistry = new MemoryMerchantRegistry();
 *
 * // Register a merchant
 * await registry.register({
 *   domain: 'vuoriclothing.com',
 *   aliases: ['vuori', 'vuori clothing'],
 *   gatewayUrl: 'https://api.vuori.com/llm-gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Vuori', categories: ['activewear', 'athleisure'] },
 * });
 *
 * // Lookup by alias
 * const merchant = await registry.findByAlias('vuori');
 * // → { domain: 'vuoriclothing.com', ... }
 *
 * // Find by category
 * const activewearMerchants = await registry.findByCategory('activewear');
 * ```
 */
export interface MerchantRegistry {
  /**
   * Register a new merchant or update an existing registration.
   *
   * If a merchant with the same domain already exists, it will be updated.
   * Indexes (alias, category) are rebuilt on update.
   *
   * @param merchant - Complete merchant registration
   * @throws Error if registration fails (e.g., storage error)
   */
  register(merchant: MerchantRegistration): Promise<void>;

  /**
   * Remove a merchant from the registry.
   *
   * @param domain - Primary domain of the merchant to remove
   * @returns true if merchant was found and removed, false if not found
   */
  unregister(domain: string): Promise<boolean>;

  /**
   * Get a merchant by primary domain.
   *
   * @param domain - Primary domain (e.g., "vuoriclothing.com")
   * @returns Merchant registration or null if not found
   */
  get(domain: string): Promise<MerchantRegistration | null>;

  /**
   * Find a merchant by alias (brand name, alternate domain, etc.).
   *
   * Aliases are case-insensitive. Common aliases include:
   * - Brand names ("vuori" → "vuoriclothing.com")
   * - Short names ("macys" → "macys.com")
   * - Alternate domains
   *
   * @param alias - Alias to search for
   * @returns Merchant registration or null if no match
   */
  findByAlias(alias: string): Promise<MerchantRegistration | null>;

  /**
   * Find all merchants in a category.
   *
   * Categories are case-insensitive.
   *
   * @param category - Category name (e.g., "activewear", "footwear")
   * @returns Array of matching merchants (may be empty)
   */
  findByCategory(category: string): Promise<MerchantRegistration[]>;

  /**
   * List merchants with optional filtering.
   *
   * @param options - Filter and pagination options
   * @returns Array of merchants matching the criteria
   */
  list(options?: ListOptions): Promise<MerchantRegistration[]>;

  /**
   * Search merchants with complex criteria.
   *
   * @param options - Search options
   * @returns Array of matching merchants
   */
  search?(options: SearchOptions): Promise<MerchantRegistration[]>;

  /**
   * Update a merchant's trust tier.
   *
   * @param domain - Primary domain of the merchant
   * @param tier - New tier to assign
   * @throws Error if merchant not found
   */
  updateTier(domain: string, tier: MerchantTier): Promise<void>;

  /**
   * Check if a merchant exists in the registry.
   *
   * @param domain - Primary domain to check
   * @returns true if merchant exists
   */
  has?(domain: string): Promise<boolean>;

  /**
   * Get the total number of registered merchants.
   *
   * @returns Count of merchants
   */
  count?(): Promise<number>;

  /**
   * Clear all merchants from the registry.
   * Primarily used for testing.
   */
  clear?(): Promise<void>;
}

// ============================================================================
// Registry Events
// ============================================================================

/**
 * Events emitted by the merchant registry.
 */
export type RegistryEventType =
  | 'merchant:registered'
  | 'merchant:updated'
  | 'merchant:unregistered'
  | 'merchant:tier_changed';

/**
 * Event payload for registry events.
 */
export interface RegistryEvent {
  type: RegistryEventType;
  domain: string;
  merchant?: MerchantRegistration;
  previousTier?: MerchantTier;
  newTier?: MerchantTier;
  timestamp: Date;
}

/**
 * Event listener for registry events.
 */
export type RegistryEventListener = (event: RegistryEvent) => void;

/**
 * Extended registry interface with event support.
 */
export interface ObservableMerchantRegistry extends MerchantRegistry {
  /**
   * Subscribe to registry events.
   */
  on(event: RegistryEventType, listener: RegistryEventListener): void;

  /**
   * Unsubscribe from registry events.
   */
  off(event: RegistryEventType, listener: RegistryEventListener): void;
}

