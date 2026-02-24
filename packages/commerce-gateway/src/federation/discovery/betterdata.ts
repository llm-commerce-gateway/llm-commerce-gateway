/**
 * Better Data Cloud Discovery Provider
 *
 * Implements the DiscoveryProvider interface by connecting to the
 * Better Data Cloud Federation API for advanced merchant discovery.
 *
 * @example
 * ```typescript
 * import { BetterDataDiscoveryProvider } from '@betterdata/commerce-gateway/federation/providers';
 *
 * const discovery = new BetterDataDiscoveryProvider({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 *   hubId: 'global',
 * });
 *
 * const merchants = await discovery.discoverByIntent('running shoes', ['footwear']);
 * ```
 */

import type {
  DiscoveryProvider,
  MerchantInfo,
  MerchantTier,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface BetterDataDiscoveryConfig {
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
   * Request timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;
}

export interface DiscoverOptions {
  /** Maximum number of results */
  limit?: number;
  /** Filter by categories */
  categories?: string[];
  /** Filter by tiers */
  tiers?: MerchantTier[];
}

export interface DiscoveredMerchant extends MerchantInfo {
  /** Relevance score from 0 to 1 */
  relevanceScore: number;
}

export interface AlternativesContext {
  /** Original query that failed */
  query?: string;
  /** Specific category to look for */
  category?: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  // Direct response fields (some endpoints return data directly)
  merchants?: T extends { merchants: infer M } ? M : never;
  alternatives?: T extends { alternatives: infer A } ? A : never;
}

// ============================================================================
// BetterDataDiscoveryProvider
// ============================================================================

export class BetterDataDiscoveryProvider implements DiscoveryProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly hubId: string;
  private readonly timeoutMs: number;

  constructor(config: BetterDataDiscoveryConfig) {
    this.apiUrl = config.apiUrl ?? 'https://api.betterdata.com/federation';
    this.apiKey = config.apiKey;
    this.hubId = config.hubId ?? 'global';
    this.timeoutMs = config.timeoutMs ?? 10000;

    if (!this.apiKey) {
      throw new Error('BetterDataDiscoveryProvider: apiKey is required');
    }
  }

  /**
   * Discover merchants matching a query intent.
   *
   * Uses the Better Data Cloud ranking algorithm to find the most
   * relevant merchants for a given query.
   *
   * @param query - Natural language query (e.g., "running shoes")
   * @param categories - Optional category hints
   * @param options - Additional options
   * @returns Ranked list of merchants
   */
  async discoverByIntent(
    query: string,
    categories?: string[],
    options?: DiscoverOptions
  ): Promise<DiscoveredMerchant[]> {
    const params = new URLSearchParams({
      hubId: this.hubId,
      query,
    });

    if (categories?.length) {
      params.set('categories', categories.join(','));
    }
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.tiers?.length) {
      params.set('tiers', options.tiers.join(','));
    }

    const response = await this.request<{ merchants: DiscoveredMerchant[] }>(
      'GET',
      `/discover?${params.toString()}`
    );

    return response?.merchants ?? [];
  }

  /**
   * Suggest alternative merchants when a specific merchant is unavailable.
   *
   * @param failedDomain - Domain that couldn't be resolved
   * @param context - Additional context for finding alternatives
   * @returns List of alternative merchants
   */
  async suggestAlternatives(
    failedDomain: string,
    context?: AlternativesContext
  ): Promise<DiscoveredMerchant[]> {
    const response = await this.request<{ alternatives: DiscoveredMerchant[] }>(
      'POST',
      '/discover/alternatives',
      {
        hubId: this.hubId,
        failedDomain,
        query: context?.query,
        category: context?.category,
      }
    );

    return response?.alternatives ?? [];
  }

  /**
   * Search merchants by text query.
   *
   * @param searchTerm - Search term to match against name, domain, aliases
   * @param limit - Maximum results
   * @returns Matching merchants
   */
  async search(searchTerm: string, limit?: number): Promise<DiscoveredMerchant[]> {
    const params = new URLSearchParams({
      hubId: this.hubId,
      q: searchTerm,
    });

    if (limit) {
      params.set('limit', String(limit));
    }

    const response = await this.request<{ merchants: DiscoveredMerchant[] }>(
      'GET',
      `/merchants/search?${params.toString()}`
    );

    return response?.merchants ?? [];
  }

  /**
   * Get top merchants in a category.
   *
   * @param category - Category slug
   * @param limit - Maximum results
   * @returns Top merchants in category
   */
  async getTopMerchants(category?: string, limit?: number): Promise<DiscoveredMerchant[]> {
    const params = new URLSearchParams({ hubId: this.hubId });

    if (category) {
      params.set('category', category);
    }
    if (limit) {
      params.set('limit', String(limit));
    }

    const response = await this.request<{ merchants: DiscoveredMerchant[] }>(
      'GET',
      `/discover/top?${params.toString()}`
    );

    return response?.merchants ?? [];
  }

  /**
   * Get recommended merchants based on user context.
   *
   * @param context - User context for personalization
   * @returns Recommended merchants
   */
  async getRecommendations(context: {
    recentCategories?: string[];
    recentMerchants?: string[];
    limit?: number;
  }): Promise<DiscoveredMerchant[]> {
    const response = await this.request<{ merchants: DiscoveredMerchant[] }>(
      'POST',
      '/discover/recommendations',
      {
        hubId: this.hubId,
        ...context,
      }
    );

    return response?.merchants ?? [];
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async request<T>(
    method: 'GET' | 'POST',
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

    const data = await response.json() as ApiResponse<T>;

    // Handle both wrapped and direct responses
    if (data.success === false && data.error) {
      const error = new Error(`BetterData API error: ${data.error}`);
      (error as any).code = data.code;
      throw error;
    }

    // If response has data wrapper, return that
    if ('data' in data && data.data !== undefined) {
      return data.data as T;
    }

    // Otherwise return the whole response (direct format)
    return data as T;
  }
}

