/**
 * Basic Search Service (Open Source)
 * 
 * Simple keyword-based search for single-tenant catalogs.
 * Suitable for individual Shopify/Square stores.
 * 
 * For multi-vendor marketplace search with ranking, use SCM's MarketplaceSearchService.
 * 
 * @module catalog/basic-search-service
 */

import type {
  SearchService,
  SearchQuery,
  SearchResult,
  Product,
  ProductCatalog,
} from './interfaces';

// ============================================================================
// Basic Search Service
// ============================================================================

export interface BasicSearchServiceConfig {
  catalog: ProductCatalog;
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Simple keyword search service for open source gateway
 * 
 * Features:
 * - Case-insensitive text matching
 * - Filters by category, brand, price range, stock status
 * - Simple relevance sorting (exact match > starts with > contains)
 * 
 * NOT included (SCM features):
 * - Multi-vendor search
 * - FULLTEXT/fuzzy search
 * - Multi-factor ranking
 * - Location-based ranking
 */
export class BasicSearchService implements SearchService {
  private catalog: ProductCatalog;
  private defaultLimit: number;
  private maxLimit: number;

  constructor(config: BasicSearchServiceConfig) {
    this.catalog = config.catalog;
    this.defaultLimit = config.defaultLimit ?? 20;
    this.maxLimit = config.maxLimit ?? 100;
  }

  /**
   * Search for products using simple keyword matching
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const limit = Math.min(query.limit ?? this.defaultLimit, this.maxLimit);
    const offset = query.offset ?? 0;

    // Get all products from catalog
    const allProducts = await this.catalog.listProducts({ limit: 1000 });

    // Filter and score products
    const scoredResults = this.filterProducts(allProducts, query);

    // Sort results and extract products
    const sortedProducts = this.sortProducts(scoredResults, query);

    // Apply pagination
    const total = sortedProducts.length;
    const paginatedResults = sortedProducts.slice(offset, offset + limit);

    return {
      products: paginatedResults,
      total,
      query,
      timing: {
        searchMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get autocomplete suggestions
   */
  async suggest(prefix: string, limit: number = 10): Promise<string[]> {
    if (!prefix || prefix.length < 2) return [];

    const allProducts = await this.catalog.listProducts({ limit: 500 });
    const lowerPrefix = prefix.toLowerCase();
    
    const suggestions = new Set<string>();

    for (const product of allProducts) {
      // Match product names
      if (product.name.toLowerCase().startsWith(lowerPrefix)) {
        suggestions.add(product.name);
      }
      // Match brands
      if (product.brand?.toLowerCase().startsWith(lowerPrefix)) {
        suggestions.add(product.brand);
      }
      // Match categories
      if (product.category?.toLowerCase().startsWith(lowerPrefix)) {
        suggestions.add(product.category);
      }

      if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Filter products based on query and filters
   */
  private filterProducts(products: Product[], query: SearchQuery): ScoredProduct[] {
    const searchText = query.text?.toLowerCase().trim() || '';
    const filters = query.filters ?? {};

    const results: ScoredProduct[] = [];

    for (const product of products) {
      // Calculate text match score
      const score = this.calculateMatchScore(product, searchText);
      
      // Skip products with no text match (if search text provided)
      if (searchText && score === 0) continue;

      // Apply filters
      if (!this.matchesFilters(product, filters)) continue;

      results.push({ product, score });
    }

    return results;
  }

  /**
   * Calculate match score for a product
   * Higher score = better match
   */
  private calculateMatchScore(product: Product, searchText: string): number {
    if (!searchText) return 100; // No search = all products match equally

    let score = 0;
    const lowerSearch = searchText.toLowerCase();

    // Name matching (highest weight)
    const lowerName = product.name.toLowerCase();
    if (lowerName === lowerSearch) {
      score += 100; // Exact match
    } else if (lowerName.startsWith(lowerSearch)) {
      score += 75; // Starts with
    } else if (lowerName.includes(lowerSearch)) {
      score += 50; // Contains
    }

    // Brand matching
    if (product.brand) {
      const lowerBrand = product.brand.toLowerCase();
      if (lowerBrand === lowerSearch) {
        score += 40;
      } else if (lowerBrand.includes(lowerSearch)) {
        score += 20;
      }
    }

    // Category matching
    if (product.category) {
      const lowerCategory = product.category.toLowerCase();
      if (lowerCategory.includes(lowerSearch)) {
        score += 15;
      }
    }

    // Description matching (lowest weight)
    if (product.description) {
      const lowerDesc = product.description.toLowerCase();
      if (lowerDesc.includes(lowerSearch)) {
        score += 10;
      }
    }

    // SKU/GTIN exact match (useful for specific lookups)
    if (product.sku?.toLowerCase() === lowerSearch || 
        product.gtin?.toLowerCase() === lowerSearch) {
      score += 200; // Very high priority for exact SKU/GTIN match
    }

    return score;
  }

  /**
   * Check if product matches all filters
   */
  private matchesFilters(product: Product, filters: SearchQuery['filters']): boolean {
    if (!filters) return true;

    // Category filter
    if (filters.category) {
      if (!product.category?.toLowerCase().includes(filters.category.toLowerCase())) {
        return false;
      }
    }

    // Brand filter
    if (filters.brand) {
      if (!product.brand?.toLowerCase().includes(filters.brand.toLowerCase())) {
        return false;
      }
    }

    // Price range filter
    if (filters.priceMin !== undefined && product.price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== undefined && product.price > filters.priceMax) {
      return false;
    }

    // Stock filter
    if (filters.inStockOnly && !product.inStock) {
      return false;
    }

    return true;
  }

  /**
   * Sort products based on query options
   */
  private sortProducts(products: ScoredProduct[], query: SearchQuery): Product[] {
    const sortBy = query.sortBy ?? 'relevance';

    const getPrice = (p: Product): number => {
      // catalog/interfaces.ts Product has price as a number
      return p.price ?? 0;
    };

    switch (sortBy) {
      case 'price_low':
        products.sort((a, b) => getPrice(a.product) - getPrice(b.product));
        break;
      case 'price_high':
        products.sort((a, b) => getPrice(b.product) - getPrice(a.product));
        break;
      case 'newest':
        // Would need createdAt field - for now, preserve order
        break;
      case 'relevance':
      default:
        // Sort by match score (descending), then by name
        products.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.product.name.localeCompare(b.product.name);
        });
        break;
    }

    return products.map(p => p.product);
  }
}

// ============================================================================
// Helper Types
// ============================================================================

interface ScoredProduct {
  product: Product;
  score: number;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a basic search service
 */
export function createBasicSearchService(
  catalog: ProductCatalog,
  options?: Partial<Omit<BasicSearchServiceConfig, 'catalog'>>
): BasicSearchService {
  return new BasicSearchService({
    catalog,
    ...options,
  });
}
