/**
 * @betterdata/llm-gateway - File-Based Merchant Registry
 *
 * A file-backed implementation of the MerchantRegistry interface.
 * Stores merchants in a JSON file with atomic writes for durability.
 *
 * @license MIT
 */

import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import type { MerchantRegistration, MerchantTier } from '../types';
import type { MerchantRegistry, ListOptions, SearchOptions } from './interface';
import type { CapabilityProvider, GatewayCapabilities } from '../../capabilities';
import { VERSION } from '../../version';

// ============================================================================
// File Storage Format
// ============================================================================

interface RegistryFileData {
  version: string;
  updatedAt: string;
  merchants: MerchantRegistration[];
}

// ============================================================================
// File-Based Merchant Registry
// ============================================================================

/**
 * File-based implementation of the merchant registry.
 *
 * Stores merchants in a JSON file with:
 * - Atomic writes (temp file + rename) to prevent corruption
 * - Lazy loading on first operation
 * - In-memory indexes for fast lookups
 *
 * Suitable for:
 * - Development and testing
 * - Single-instance deployments
 * - Configuration-as-code scenarios
 *
 * @example
 * ```typescript
 * const registry = new FileMerchantRegistry('./data/merchants.json');
 *
 * await registry.register({
 *   domain: 'nike.com',
 *   aliases: ['nike'],
 *   gatewayUrl: 'https://llm.nike.com/gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Nike', categories: ['athletic', 'footwear'] },
 * });
 *
 * // Data is persisted to ./data/merchants.json
 * ```
 */
export class FileMerchantRegistry implements MerchantRegistry, CapabilityProvider {
  private filePath: string;
  private loaded: boolean = false;

  /** Primary storage: domain → MerchantRegistration */
  private merchants: Map<string, MerchantRegistration> = new Map();

  /** Alias index: lowercase alias → domain */
  private aliasIndex: Map<string, string> = new Map();

  /** Category index: lowercase category → Set of domains */
  private categoryIndex: Map<string, Set<string>> = new Map();

  /** Debounce timer for saves */
  private saveTimer: NodeJS.Timeout | null = null;

  /** Save debounce delay (ms) */
  private saveDebounceMs: number;

  /**
   * Create a new file-based registry.
   *
   * @param filePath - Path to the JSON file for storage
   * @param options - Optional configuration
   */
  constructor(
    filePath: string,
    options?: {
      /** Debounce delay for saves (default: 100ms) */
      saveDebounceMs?: number;
      /** Auto-create directory if missing (default: true) */
      autoCreateDir?: boolean;
    }
  ) {
    this.filePath = resolve(filePath);
    this.saveDebounceMs = options?.saveDebounceMs ?? 100;
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * Load merchants from file (lazy, called on first operation).
   */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      if (existsSync(this.filePath)) {
        const content = await readFile(this.filePath, 'utf-8');
        const data: RegistryFileData = JSON.parse(content);

        // Load merchants and rebuild indexes
        for (const merchant of data.merchants) {
          // Restore Date objects
          const restored: MerchantRegistration = {
            ...merchant,
            createdAt: merchant.createdAt ? new Date(merchant.createdAt) : undefined,
            updatedAt: merchant.updatedAt ? new Date(merchant.updatedAt) : undefined,
            verification: merchant.verification
              ? {
                  ...merchant.verification,
                  verifiedAt: merchant.verification.verifiedAt
                    ? new Date(merchant.verification.verifiedAt)
                    : undefined,
                  expiresAt: merchant.verification.expiresAt
                    ? new Date(merchant.verification.expiresAt)
                    : undefined,
                }
              : undefined,
          };
          this.addMerchant(restored);
        }
      }
    } catch (error) {
      // If file doesn't exist or is invalid, start fresh
      console.warn(`Failed to load registry from ${this.filePath}:`, error);
    }

    this.loaded = true;
  }

  /**
   * Save merchants to file with atomic write.
   */
  private async save(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const data: RegistryFileData = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      merchants: Array.from(this.merchants.values()),
    };

    const content = JSON.stringify(data, null, 2);

    // Atomic write: write to temp file, then rename
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, this.filePath);
  }

  /**
   * Schedule a debounced save operation.
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(async () => {
      try {
        await this.save();
      } catch (error) {
        console.error('Failed to save registry:', error);
      }
    }, this.saveDebounceMs);
  }

  /**
   * Force an immediate save (useful before shutdown).
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.save();
  }

  // ==========================================================================
  // Index Management
  // ==========================================================================

  /**
   * Add merchant to storage and indexes.
   */
  private addMerchant(merchant: MerchantRegistration): void {
    const domain = merchant.domain.toLowerCase();

    // Remove old indexes if updating
    const existing = this.merchants.get(domain);
    if (existing) {
      this.removeFromIndexes(existing);
    }

    // Store merchant
    this.merchants.set(domain, {
      ...merchant,
      domain,
    });

    // Add to indexes
    this.addToIndexes(merchant);
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
    await this.ensureLoaded();

    const domain = merchant.domain.toLowerCase();
    const existing = this.merchants.get(domain);

    const normalizedMerchant: MerchantRegistration = {
      ...merchant,
      domain,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      isActive: merchant.isActive ?? true,
    };

    this.addMerchant(normalizedMerchant);
    this.scheduleSave();
  }

  async unregister(domain: string): Promise<boolean> {
    await this.ensureLoaded();

    const normalizedDomain = domain.toLowerCase();
    const merchant = this.merchants.get(normalizedDomain);

    if (!merchant) {
      return false;
    }

    this.removeFromIndexes(merchant);
    this.merchants.delete(normalizedDomain);
    this.scheduleSave();
    return true;
  }

  async get(domain: string): Promise<MerchantRegistration | null> {
    await this.ensureLoaded();
    return this.merchants.get(domain.toLowerCase()) ?? null;
  }

  async findByAlias(alias: string): Promise<MerchantRegistration | null> {
    await this.ensureLoaded();

    const normalizedAlias = alias.toLowerCase();
    const domain = this.aliasIndex.get(normalizedAlias);

    if (!domain) {
      return null;
    }

    return this.merchants.get(domain) ?? null;
  }

  async findByCategory(category: string): Promise<MerchantRegistration[]> {
    await this.ensureLoaded();

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
    await this.ensureLoaded();

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
    await this.ensureLoaded();

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

    // Filter by query
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
    await this.ensureLoaded();

    const normalizedDomain = domain.toLowerCase();
    const merchant = this.merchants.get(normalizedDomain);

    if (!merchant) {
      throw new Error(`Merchant not found: ${domain}`);
    }

    merchant.tier = tier;
    merchant.updatedAt = new Date();
    this.scheduleSave();
  }

  async has(domain: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.merchants.has(domain.toLowerCase());
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.merchants.size;
  }

  async clear(): Promise<void> {
    this.merchants.clear();
    this.aliasIndex.clear();
    this.categoryIndex.clear();
    this.scheduleSave();
  }

  // ==========================================================================
  // Additional Methods
  // ==========================================================================

  /**
   * Get the file path being used.
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if the registry has been loaded from disk.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Force reload from disk (discards in-memory changes).
   */
  async reload(): Promise<void> {
    this.loaded = false;
    this.merchants.clear();
    this.aliasIndex.clear();
    this.categoryIndex.clear();
    await this.ensureLoaded();
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this registry.
   *
   * FileMerchantRegistry supports:
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
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new file-based merchant registry.
 *
 * @param filePath - Path to the JSON file for storage
 * @returns FileMerchantRegistry instance
 */
export function createFileRegistry(filePath: string): FileMerchantRegistry {
  return new FileMerchantRegistry(filePath);
}

