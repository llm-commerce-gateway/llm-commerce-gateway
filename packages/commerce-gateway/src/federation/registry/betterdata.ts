/**
 * Better Data Cloud Registry Provider
 *
 * Implements the MerchantRegistry interface by connecting to the
 * Better Data Cloud Federation API.
 *
 * @example
 * ```typescript
 * import { BetterDataRegistryProvider } from '@betterdata/llm-gateway/federation/providers';
 *
 * const registry = new BetterDataRegistryProvider({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 *   hubId: 'global',
 * });
 *
 * const merchant = await registry.get('nike.com');
 * ```
 */

import type {
  MerchantRegistry,
  MerchantInfo,
  MerchantTier,
  MerchantCapabilities,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface BetterDataRegistryConfig {
  /**
   * Better Data Cloud API URL.
   * @default "https://api.betterdata.com/federation"
   */
  apiUrl?: string;

  /**
   * API key for authentication.
   */
  apiKey: string;

  /**
   * Federation hub ID.
   * @default "global"
   */
  hubId?: string;

  /**
   * Optional local cache for faster reads.
   */
  cache?: RegistryCache;

  /**
   * Request timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Cache TTL in seconds.
   * @default 300
   */
  cacheTtlSeconds?: number;
}

export interface RegistryCache {
  get(key: string): Promise<MerchantInfo | null>;
  set(key: string, value: MerchantInfo, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ============================================================================
// BetterDataRegistryProvider
// ============================================================================

export class BetterDataRegistryProvider implements MerchantRegistry {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly hubId: string;
  private readonly cache?: RegistryCache;
  private readonly timeoutMs: number;
  private readonly cacheTtlSeconds: number;

  constructor(config: BetterDataRegistryConfig) {
    this.apiUrl = config.apiUrl ?? 'https://api.betterdata.com/federation';
    this.apiKey = config.apiKey;
    this.hubId = config.hubId ?? 'global';
    this.cache = config.cache;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cacheTtlSeconds = config.cacheTtlSeconds ?? 300;

    if (!this.apiKey) {
      throw new Error('BetterDataRegistryProvider: apiKey is required');
    }
  }

  /**
   * Register a new merchant with the federation.
   */
  async register(merchant: {
    domain: string;
    gatewayUrl: string;
    name: string;
    description?: string;
    categories?: string[];
    capabilities?: MerchantCapabilities;
  }): Promise<MerchantInfo> {
    const response = await this.request<MerchantInfo>('POST', '/merchants', {
      hubId: this.hubId,
      ...merchant,
    });

    // Cache the newly registered merchant
    if (this.cache && response) {
      await this.cache.set(this.cacheKey(merchant.domain), response, this.cacheTtlSeconds);
    }

    return response;
  }

  /**
   * Unregister a merchant from the federation.
   */
  async unregister(domain: string): Promise<void> {
    await this.request('DELETE', `/merchants/${encodeURIComponent(domain)}`, {
      hubId: this.hubId,
    });

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(this.cacheKey(domain));
    }
  }

  /**
   * Get a merchant by domain.
   */
  async get(domain: string): Promise<MerchantInfo | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(this.cacheKey(domain));
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.request<MerchantInfo>(
        'GET',
        `/merchants/${encodeURIComponent(domain)}?hubId=${this.hubId}`
      );

      // Cache the response
      if (this.cache && response) {
        await this.cache.set(this.cacheKey(domain), response, this.cacheTtlSeconds);
      }

      return response;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find a merchant by alias (brand name, etc.).
   */
  async findByAlias(alias: string): Promise<MerchantInfo | null> {
    // Check cache with normalized alias
    const normalizedAlias = this.normalizeAlias(alias);
    if (this.cache) {
      const cached = await this.cache.get(this.cacheKey(`alias:${normalizedAlias}`));
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.request<{ merchant: MerchantInfo }>(
        'GET',
        `/resolve?hubId=${this.hubId}&input=${encodeURIComponent(alias)}`
      );

      const merchant = response?.merchant ?? null;

      // Cache the response
      if (this.cache && merchant) {
        await this.cache.set(this.cacheKey(`alias:${normalizedAlias}`), merchant, this.cacheTtlSeconds);
      }

      return merchant;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find merchants by category.
   */
  async findByCategory(category: string, limit?: number): Promise<MerchantInfo[]> {
    const params = new URLSearchParams({
      hubId: this.hubId,
      category,
    });
    if (limit) {
      params.set('limit', String(limit));
    }

    const response = await this.request<{ merchants: MerchantInfo[] }>(
      'GET',
      `/merchants?${params.toString()}`
    );

    return response?.merchants ?? [];
  }

  /**
   * List all merchants.
   */
  async list(options?: {
    tier?: MerchantTier;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MerchantInfo[]> {
    const params = new URLSearchParams({ hubId: this.hubId });

    if (options?.tier) params.set('tier', options.tier);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const response = await this.request<{ merchants: MerchantInfo[] }>(
      'GET',
      `/merchants?${params.toString()}`
    );

    return response?.merchants ?? [];
  }

  /**
   * Update a merchant's tier.
   */
  async updateTier(domain: string, tier: MerchantTier): Promise<void> {
    await this.request('PATCH', `/merchants/${encodeURIComponent(domain)}`, {
      hubId: this.hubId,
      tier,
    });

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(this.cacheKey(domain));
    }
  }

  /**
   * Update a merchant's capabilities.
   */
  async updateCapabilities(domain: string, capabilities: MerchantCapabilities): Promise<void> {
    await this.request('PATCH', `/merchants/${encodeURIComponent(domain)}`, {
      hubId: this.hubId,
      capabilities,
    });

    // Invalidate cache
    if (this.cache) {
      await this.cache.delete(this.cacheKey(domain));
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: object
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Hub-Id': this.hubId,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const error = new Error(`BetterData API error: ${response.status} ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).body = errorBody;
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json() as ApiResponse<T>;

    if (!data.success && data.error) {
      const error = new Error(`BetterData API error: ${data.error}`);
      (error as any).code = data.code;
      throw error;
    }

    return data.data as T;
  }

  private cacheKey(suffix: string): string {
    return `bd:${this.hubId}:${suffix}`;
  }

  private normalizeAlias(alias: string): string {
    return alias
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }
}

