/**
 * @betterdata/commerce-gateway - Registry Client
 * 
 * Client for the Commerce Gateway Registry service
 * Handles brand, GTIN, and category resolution
 * 
 * @license MIT
 */

import { isValidWellKnownSchema, type WellKnownCommerceGateway } from './well-known-schema';

// ============================================================================
// Types
// ============================================================================

export interface BrandResolution {
  found: boolean;
  confidence?: number;
  match_type?: 'exact' | 'fuzzy' | 'well_known';
  brand?: string;
  slug?: string;
  gateway?: {
    endpoint: string;
    protocol: string;
    capabilities: Record<string, unknown>;
  };
  verification?: {
    domain_verified: boolean;
    brand_verified: boolean;
  };
  trust_score?: number;
  categories?: string[];
  alternatives?: Array<{ brand: string; confidence: number }>;
  query?: string;
  suggestions?: Array<{ brand: string; confidence: number }>;
  warning?: string;
}

export interface GTINResolution {
  found: boolean;
  gtin?: string;
  product_name?: string;
  matched_by?: 'direct' | 'prefix_range';
  prefix?: string;
  authoritative_source?: {
    brand: string;
    slug: string;
    gateway: {
      endpoint: string;
      protocol: string;
      capabilities: Record<string, unknown>;
    };
    verified?: boolean;
  };
  resellers?: Array<{
    retailer: string;
    slug: string;
    gateway: { endpoint: string; protocol: string; capabilities: Record<string, unknown> };
  }>;
  error?: string;
  suggestion?: string;
}

export interface CategoryResolution {
  category: string;
  name: string;
  gateways: Array<{
    brand: string;
    slug: string;
    gateway: {
      endpoint: string;
      protocol: string;
      capabilities: Record<string, unknown>;
    };
    trust_score: number;
  }>;
  total: number;
}

export interface RegistryClientConfig {
  /**
   * Registry API base URL
   * @default "https://registry.betterdata.co"
   */
  baseUrl?: string;
  
  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
}

// ============================================================================
// Registry Client
// ============================================================================

/**
 * Client for the Commerce Gateway Registry
 */
export class RegistryClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: RegistryClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://registry.betterdata.co';
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Resolve a brand name to its gateway
   */
  async resolveBrand(query: string): Promise<BrandResolution> {
    const url = new URL('/api/resolve/brand', this.baseUrl);
    url.searchParams.set('q', query);

    const response = await this.fetchWithTimeout(url.toString());
    
    if (!response.ok) {
      throw new Error(`Registry API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<BrandResolution>;
  }

  /**
   * Resolve a GTIN to its authoritative source
   */
  async resolveGTIN(gtin: string): Promise<GTINResolution> {
    const url = new URL(`/api/resolve/gtin/${gtin}`, this.baseUrl);

    const response = await this.fetchWithTimeout(url.toString());
    
    if (!response.ok) {
      if (response.status === 400) {
        return response.json() as Promise<GTINResolution>;
      }
      throw new Error(`Registry API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GTINResolution>;
  }

  /**
   * Resolve a category to list of gateways
   */
  async resolveCategory(
    path: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<CategoryResolution> {
    const url = new URL(`/api/resolve/category/${path}`, this.baseUrl);
    
    if (options.limit) {
      url.searchParams.set('limit', String(options.limit));
    }
    if (options.offset) {
      url.searchParams.set('offset', String(options.offset));
    }

    const response = await this.fetchWithTimeout(url.toString());
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Category not found: ${path}`);
      }
      throw new Error(`Registry API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<CategoryResolution>;
  }

  /**
   * Try .well-known discovery for a brand
   */
  async tryWellKnownDiscovery(brandQuery: string): Promise<BrandResolution | null> {
    const possibleDomains = this.generatePossibleDomains(brandQuery);

    for (const domain of possibleDomains) {
      try {
        const url = `https://${domain}/.well-known/commerce-gateway.json`;
        const response = await this.fetchWithTimeout(url, { timeout: 3000 });

        if (response.ok) {
          const data = await response.json();

          // Validate schema
          if (isValidWellKnownSchema(data)) {
            const wellKnown = data as WellKnownCommerceGateway;
            return {
              found: true,
              confidence: 0.5,
              match_type: 'well_known',
              brand: wellKnown.brand,
              gateway: {
                endpoint: wellKnown.gateway.endpoint,
                protocol: wellKnown.gateway.protocol,
                capabilities: wellKnown.gateway.capabilities,
              },
              categories: wellKnown.categories,
              trust_score: 50,
              warning: 'Unverified gateway discovered via .well-known',
            };
          }
        }
      } catch {
        // Continue to next domain
        continue;
      }
    }

    return null;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async fetchWithTimeout(
    url: string,
    options: { timeout?: number } = {}
  ): Promise<Response> {
    const timeout = options.timeout ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private generatePossibleDomains(query: string): string[] {
    const base = query.toLowerCase().replace(/\s+/g, '');
    const hyphenated = query.toLowerCase().replace(/\s+/g, '-');

    return [
      `${base}.com`,
      `${hyphenated}.com`,
      `www.${base}.com`,
      `shop.${base}.com`,
      `${base}.co`,
      `${base}.io`,
    ];
  }

}

/**
 * Create a registry client instance
 */
export function createRegistryClient(config?: RegistryClientConfig): RegistryClient {
  return new RegistryClient(config);
}

