/**
 * Unified Search Service for Marketplace
 * 
 * Uses MySQL FULLTEXT search for text matching and
 * optional spatial queries for location-based ranking.
 * 
 * @module catalog/search-service
 */

import type { PrismaClient } from '@prisma/client';
import { 
  rankListings, 
  calculateDistance,
  type RankedListing, 
  type SearchResultRow,
  type UserLocation 
} from './ranking-service';

// ============================================================================
// Types
// ============================================================================

/**
 * Runtime scope (passed per-request, NOT from config)
 * Enables both global search (macro) and platform-scoped search (micro)
 */
export interface SearchScope {
  type: 'global' | 'shopify_store' | 'square_merchant' | 'vendor' | 'platform';
  
  // For type: 'shopify_store'
  domain?: string;  // e.g., 'mybrand.myshopify.com'
  
  // For type: 'square_merchant'
  merchantId?: string;  // e.g., 'square_merchant_123'
  
  // For type: 'vendor'
  vendorId?: string;  // e.g., 'org-vendor-xyz'
  
  // For type: 'platform' (all Shopify, all Square, etc.)
  platform?: string;  // e.g., 'shopify'
  
  // Optional: location for multi-location merchants
  locationId?: string;
}

export interface SearchFilters {
  brand?: string;
  category?: string;
  size?: string;
  color?: string;
  gender?: string;
  priceMin?: number;
  priceMax?: number;
  authenticatedOnly?: boolean;
  inStockOnly?: boolean;
  vendorOrgId?: string;
}

export interface SearchQuery {
  text: string;
  
  // CRITICAL: Runtime scope (not from config!)
  scope?: SearchScope;
  
  userLocation?: UserLocation;
  filters?: SearchFilters;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'distance';
  limit?: number;
  offset?: number;
}

export interface ProductResult {
  id: string;
  brand: string;
  name: string;
  description: string;
  gtin?: string;
  images?: string[];
}

export interface SearchResult {
  product: ProductResult;
  listings: RankedListing[];
  totalVendors: number;
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters: SearchFilters;
  timing: {
    searchMs: number;
    rankingMs: number;
    totalMs: number;
  };
}

// ============================================================================
// Prisma Result Types (explicit to avoid DTS build issues)
// Note: Uses Record<string, unknown> to accommodate Prisma Decimal types
// ============================================================================

type PrismaSearchRow = Record<string, unknown>;

// ============================================================================
// Search Service Class
// ============================================================================

export interface SearchServiceConfig {
  prisma: PrismaClient;
  defaultLimit?: number;
  maxListingsPerProduct?: number;
}

// ============================================================================
// Scope Builder - CRITICAL: Build scope from runtime parameter (not config)
// ============================================================================

interface ScopeConditions {
  conditions: string[];
  params: (string | number | boolean)[];
}

function buildScopeConditions(scope?: SearchScope): ScopeConditions {
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  
  if (!scope || scope.type === 'global') {
    // No scoping - search all vendors
    return { conditions, params };
  }
  
  if (scope.type === 'shopify_store') {
    // Scope to specific Shopify store
    conditions.push('platform = ?');
    params.push('shopify');
    
    if (scope.domain) {
      conditions.push('shopifyDomain = ?');
      params.push(scope.domain);
    }
  }
  
  else if (scope.type === 'square_merchant') {
    // Scope to specific Square merchant
    conditions.push('platform = ?');
    params.push('square');
    
    if (scope.merchantId) {
      conditions.push('merchantId = ?');
      params.push(scope.merchantId);
    }
  }
  
  else if (scope.type === 'vendor') {
    // Scope to specific vendor (any platform)
    if (scope.vendorId) {
      conditions.push('vendorOrgId = ?');
      params.push(scope.vendorId);
    }
  }
  
  else if (scope.type === 'platform') {
    // Scope to all stores on a platform (e.g., all Shopify)
    if (scope.platform) {
      conditions.push('platform = ?');
      params.push(scope.platform);
    }
  }
  
  // Optional: location for multi-location merchants
  if (scope.locationId) {
    conditions.push('squareLocationId = ?');
    params.push(scope.locationId);
  }
  
  return { conditions, params };
}

/**
 * Build Prisma where clause for scope (for non-raw queries)
 */
function buildScopeWhereClause(scope?: SearchScope): Record<string, unknown> {
  if (!scope || scope.type === 'global') {
    return {};
  }
  
  const where: Record<string, unknown> = {};
  
  if (scope.type === 'shopify_store') {
    where.platform = 'shopify';
    if (scope.domain) {
      where.shopifyDomain = scope.domain;
    }
  }
  
  else if (scope.type === 'square_merchant') {
    where.platform = 'square';
    if (scope.merchantId) {
      where.merchantId = scope.merchantId;
    }
  }
  
  else if (scope.type === 'vendor') {
    if (scope.vendorId) {
      where.vendorOrgId = scope.vendorId;
    }
  }
  
  else if (scope.type === 'platform') {
    if (scope.platform) {
      where.platform = scope.platform;
    }
  }
  
  if (scope.locationId) {
    where.squareLocationId = scope.locationId;
  }
  
  return where;
}

export class SearchService {
  private prisma: PrismaClient;
  private defaultLimit: number;
  private maxListingsPerProduct: number;

  constructor(config: SearchServiceConfig) {
    this.prisma = config.prisma;
    this.defaultLimit = config.defaultLimit ?? 20;
    this.maxListingsPerProduct = config.maxListingsPerProduct ?? 3;
  }

  /**
   * Search for products across all marketplace listings
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    const limit = query.limit ?? this.defaultLimit;
    const filters = query.filters ?? {};
    
    // 1. Execute search
    const searchStart = Date.now();
    const searchResults = await this.executeSearch(query);
    const searchMs = Date.now() - searchStart;
    
    // 2. Group by ProductMaster and rank
    const rankStart = Date.now();
    const results = await this.processResults(searchResults, query, limit);
    const rankingMs = Date.now() - rankStart;
    
    const totalMs = Date.now() - startTime;
    
    return {
      results,
      total: results.length,
      query: query.text,
      filters,
      timing: {
        searchMs,
        rankingMs,
        totalMs,
      },
    };
  }

  /**
   * Execute the MySQL FULLTEXT search
   */
  private async executeSearch(query: SearchQuery): Promise<SearchResultRow[]> {
    const limit = (query.limit ?? this.defaultLimit) * 5; // Get more for grouping
    
    // For simple searches, use Prisma's built-in search
    // For complex FULLTEXT, we'd use raw SQL
    const where = this.buildWhereClause(query);
    
    const results = await this.prisma.marketplaceSearchIndex.findMany({
      where,
      take: limit,
      orderBy: [
        { totalSales: 'desc' },
        { viewCount: 'desc' },
      ],
    });
    
    // Calculate distance if user location provided
    return (results as PrismaSearchRow[]).map((result) => {
      let distance: number | undefined;

      if (query.userLocation && result.locationLat && result.locationLng) {
        distance = calculateDistance(
          query.userLocation,
          {
            lat: Number(result.locationLat),
            lng: Number(result.locationLng)
          }
        );
      }

      return {
        listingId: result.listingId as string,
        productMasterId: result.productMasterId as string,
        vendorOrgId: result.vendorOrgId as string,
        vendorName: result.vendorName as string,
        vendorRating: result.vendorRating ? Number(result.vendorRating) : null,
        // Platform identifiers for runtime scoping
        platform: result.platform as string | null,
        merchantId: result.merchantId as string | null,
        platformProductId: result.platformProductId as string | null,
        platformVariantId: result.platformVariantId as string | null,
        price: Number(result.price),
        currency: result.currency as string,
        authenticated: result.authenticated as boolean,
        inStock: result.inStock as boolean,
        availableQuantity: null,
        locationLat: result.locationLat ? Number(result.locationLat) : null,
        locationLng: result.locationLng ? Number(result.locationLng) : null,
        city: result.city as string | null,
        state: result.state as string | null,
        distance,
        relevance: 1, // Prisma doesn't return relevance score
      };
    });
  }

  /**
   * Execute raw MySQL FULLTEXT search (for better relevance scoring)
   * CRITICAL: Supports runtime scoping via query.scope
   */
  async executeFulltextSearch(query: SearchQuery): Promise<SearchResultRow[]> {
    const limit = (query.limit ?? this.defaultLimit) * 5;
    const params: (string | number | boolean)[] = [];
    
    // Build WHERE conditions
    const conditions: string[] = ['active = true'];
    
    // CRITICAL: Apply runtime scope conditions
    const scopeConditions = buildScopeConditions(query.scope);
    conditions.push(...scopeConditions.conditions);
    params.push(...scopeConditions.params);
    
    // FULLTEXT search on searchText
    if (query.text && query.text.trim()) {
      conditions.push('MATCH(searchText) AGAINST(? IN NATURAL LANGUAGE MODE)');
      params.push(query.text);
    }
    
    // Filters
    if (query.filters?.brand) {
      conditions.push('brand = ?');
      params.push(query.filters.brand);
    }
    
    if (query.filters?.category) {
      conditions.push('category = ?');
      params.push(query.filters.category);
    }
    
    if (query.filters?.priceMin !== undefined) {
      conditions.push('price >= ?');
      params.push(query.filters.priceMin);
    }
    
    if (query.filters?.priceMax !== undefined) {
      conditions.push('price <= ?');
      params.push(query.filters.priceMax);
    }
    
    if (query.filters?.authenticatedOnly) {
      conditions.push('authenticated = true');
    }
    
    if (query.filters?.inStockOnly !== false) {
      conditions.push('inStock = true');
    }
    
    if (query.filters?.vendorOrgId) {
      conditions.push('vendorOrgId = ?');
      params.push(query.filters.vendorOrgId);
    }
    
    // Build ORDER BY
    let orderBy = 'relevance DESC, price ASC';
    if (query.sortBy === 'price_low') {
      orderBy = 'price ASC';
    } else if (query.sortBy === 'price_high') {
      orderBy = 'price DESC';
    }
    
    // Build SELECT with relevance score and platform identifiers
    const selectClause = query.text && query.text.trim()
      ? `*, MATCH(searchText) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance`
      : `*, 1 as relevance`;
    
    const sql = `
      SELECT ${selectClause}
      FROM marketplace_search_index
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ?
    `;
    
    const queryParams = query.text && query.text.trim()
      ? [query.text, ...params, limit]
      : [...params, limit];
    
    try {
      const results = await (this.prisma.$queryRawUnsafe as Function)(sql, ...queryParams) as PrismaSearchRow[];

      // Calculate distance and include platform identifiers
      return results.map((result): SearchResultRow => {
        let distance: number | undefined;

        if (query.userLocation && result.locationLat && result.locationLng) {
          distance = calculateDistance(
            query.userLocation,
            { lat: Number(result.locationLat), lng: Number(result.locationLng) }
          );
        }

        return {
          listingId: result.listingId as string,
          productMasterId: result.productMasterId as string,
          vendorOrgId: result.vendorOrgId as string,
          vendorName: result.vendorName as string,
          vendorRating: result.vendorRating ? Number(result.vendorRating) : null,
          platform: result.platform as string | null,
          merchantId: result.merchantId as string | null,
          platformProductId: result.platformProductId as string | null,
          platformVariantId: result.platformVariantId as string | null,
          price: Number(result.price),
          currency: result.currency as string,
          authenticated: result.authenticated as boolean,
          inStock: result.inStock as boolean,
          availableQuantity: null,
          locationLat: result.locationLat ? Number(result.locationLat) : null,
          locationLng: result.locationLng ? Number(result.locationLng) : null,
          city: result.city as string | null,
          state: result.state as string | null,
          distance,
          relevance: result.relevance ? Number(result.relevance) : 1,
        };
      });
    } catch (error) {
      console.error('FULLTEXT search failed, falling back to Prisma:', error);
      return this.executeSearch(query);
    }
  }

  /**
   * Build Prisma where clause from query filters and scope
   */
  private buildWhereClause(query: SearchQuery) {
    const where: any = {
      active: true,
    };
    
    // CRITICAL: Apply runtime scope
    const scopeWhere = buildScopeWhereClause(query.scope);
    Object.assign(where, scopeWhere);
    
    // Text search (using contains for Prisma - not as good as FULLTEXT)
    if (query.text && query.text.trim()) {
      where.searchText = {
        contains: query.text,
      };
    }
    
    // Filters
    if (query.filters?.brand) {
      where.brand = query.filters.brand;
    }
    
    if (query.filters?.category) {
      where.category = query.filters.category;
    }
    
    if (query.filters?.priceMin !== undefined || query.filters?.priceMax !== undefined) {
      where.price = {};
      if (query.filters.priceMin !== undefined) {
        where.price.gte = query.filters.priceMin;
      }
      if (query.filters.priceMax !== undefined) {
        where.price.lte = query.filters.priceMax;
      }
    }
    
    if (query.filters?.authenticatedOnly) {
      where.authenticated = true;
    }
    
    if (query.filters?.inStockOnly !== false) {
      where.inStock = true;
    }
    
    if (query.filters?.vendorOrgId) {
      where.vendorOrgId = query.filters.vendorOrgId;
    }
    
    return where;
  }

  /**
   * Process search results: group by product and rank listings
   * CRITICAL: Handles scoped results differently than global
   */
  private async processResults(
    searchResults: SearchResultRow[],
    query: SearchQuery,
    limit: number
  ): Promise<SearchResult[]> {
    // Group by ProductMaster
    const grouped = this.groupByProductMaster(searchResults);
    
    // Determine if we're in scoped mode
    const isScoped = query.scope && query.scope.type !== 'global';
    
    const results: SearchResult[] = [];
    
    for (const [productMasterId, listings] of grouped) {
      // Get product master details
      const productMaster = await this.prisma.productMaster.findUnique({
        where: { id: productMasterId },
        select: {
          id: true,
          brandName: true,
          productName: true,
          description: true,
          gtin: true,
        },
      });
      
      if (!productMaster) continue;
      
      // Rank listings for this product
      const rankedListings = rankListings(listings, {
        userLocation: query.userLocation,
        sortBy: query.sortBy,
      });
      
      // In global mode: show top 3 vendors per product
      // In scoped mode: show all (should be one vendor anyway)
      const maxListings = isScoped ? 999 : this.maxListingsPerProduct;
      const topListings = rankedListings.slice(0, maxListings);
      
      results.push({
        product: {
          id: productMaster.id,
          brand: productMaster.brandName || '',
          name: productMaster.productName,
          description: productMaster.description || '',
          gtin: productMaster.gtin ?? undefined,
          images: [], // TODO: Get from ProductContent or media
        },
        listings: topListings,
        totalVendors: listings.length,
        relevanceScore: topListings[0]?.relevanceScore ?? 0,
      });
    }
    
    // Sort results by relevance and limit
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return results.slice(0, limit);
  }

  /**
   * Group search results by ProductMaster ID
   */
  private groupByProductMaster(
    results: SearchResultRow[]
  ): Map<string, SearchResultRow[]> {
    const grouped = new Map<string, SearchResultRow[]>();
    
    for (const result of results) {
      const existing = grouped.get(result.productMasterId) || [];
      existing.push(result);
      grouped.set(result.productMasterId, existing);
    }
    
    return grouped;
  }

  /**
   * Get autocomplete suggestions
   */
  async suggest(prefix: string, limit: number = 10): Promise<string[]> {
    if (!prefix || prefix.length < 2) return [];
    
    const results = await this.prisma.marketplaceSearchIndex.findMany({
      where: {
        active: true,
        OR: [
          { productName: { startsWith: prefix } },
          { brand: { startsWith: prefix } },
        ],
      },
      select: {
        productName: true,
        brand: true,
      },
      take: limit * 2,
      distinct: ['productName'],
    });
    
    // Combine and dedupe suggestions
    const suggestions = new Set<string>();
    for (const result of results) {
      if (result.productName.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.add(result.productName);
      }
      if (result.brand.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.add(result.brand);
      }
    }
    
    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get trending/popular products
   */
  async getTrending(limit: number = 10): Promise<SearchResult[]> {
    const results = await this.prisma.marketplaceSearchIndex.findMany({
      where: {
        active: true,
        inStock: true,
      },
      orderBy: [
        { totalSales: 'desc' },
        { viewCount: 'desc' },
      ],
      take: limit * 3,
    });
    
    // Convert to search results (Decimal → number)
    const searchResults: SearchResultRow[] = (results as PrismaSearchRow[]).map((r) => ({
      listingId: r.listingId as string,
      productMasterId: r.productMasterId as string,
      vendorOrgId: r.vendorOrgId as string,
      vendorName: r.vendorName as string,
      vendorRating: r.vendorRating ? Number(r.vendorRating) : null,
      price: Number(r.price),
      currency: r.currency as string,
      authenticated: r.authenticated as boolean,
      inStock: r.inStock as boolean,
      availableQuantity: null,
      locationLat: r.locationLat ? Number(r.locationLat) : null,
      locationLng: r.locationLng ? Number(r.locationLng) : null,
      city: r.city as string | null,
      state: r.state as string | null,
      relevance: 1,
    }));
    
    return this.processResults(searchResults, { text: '' }, limit);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a search service instance
 */
export function createSearchService(
  prisma: PrismaClient,
  options?: Partial<SearchServiceConfig>
): SearchService {
  return new SearchService({
    prisma,
    ...options,
  });
}

/**
 * Simple search function (creates ephemeral service)
 */
export async function searchProducts(
  prisma: PrismaClient,
  query: SearchQuery
): Promise<SearchResponse> {
  const service = createSearchService(prisma);
  return service.search(query);
}

// ============================================================================
// Exports
// ============================================================================

export type { RankedListing, UserLocation, RankFactors } from './ranking-service';

