/**
 * Catalog Module
 * 
 * Product catalog, search, cart, and ingestion for the LLM Gateway.
 * 
 * ## Architecture
 * 
 * This module provides extension point interfaces that can be implemented
 * by proprietary code (like Better Data SCM) for advanced features.
 * 
 * ### Open Source (this package)
 * - BasicSearchService: Simple keyword search
 * - BasicCartService: In-memory or Redis cart
 * - InMemoryCatalog: Simple product storage
 * 
 * ### Proprietary (apps/scm)
 * - MarketplaceSearchService: Multi-vendor FULLTEXT search
 * - RankingService: Multi-factor ranking algorithm
 * - ProductMatcher: GTIN/fuzzy matching to ProductMaster
 * 
 * @module catalog
 */

// ============================================================================
// Extension Point Interfaces
// ============================================================================

export * from './interfaces';

// ============================================================================
// Open Source Basic Implementations
// ============================================================================

// Basic Search (keyword-based, single-tenant)
export {
  BasicSearchService,
  createBasicSearchService,
  type BasicSearchServiceConfig,
} from './basic-search-service';

// Basic Cart (in-memory or Redis)
export {
  BasicCartService,
  InMemoryCartStorage,
  RedisCartStorage,
  createBasicCartService,
  createRedisCartService,
  type BasicCartServiceConfig,
  type CartStorage,
} from './basic-cart-service';

// In-Memory Catalog
export {
  InMemoryCatalog,
  createInMemoryCatalog,
  createCatalogFromJSON,
  parseCSVRow,
  loadProductsFromCSV,
  type CSVColumnMapping,
} from './in-memory-catalog';

// Basic Ingestion (CSV + Shopify/Square fetching)
export {
  BasicIngestionService,
  createBasicIngestionService,
  type BasicIngestionServiceConfig,
  type IngestionProgress,
} from './basic-ingestion';

// ============================================================================
// Legacy Exports (for backwards compatibility)
// These are used by SCM and will be deprecated in open source
// ============================================================================

// Types (legacy - use interfaces.ts instead)
export * from './types';

// Ranking Service (multi-factor ranking algorithm)
export * from './ranking-service';

// Search Service (advanced features in apps/scm use BasicSearchService instead)
// Note: SearchFilters, SearchQuery, SearchResult, SearchService already exported from interfaces.js
export {
  SearchService as MarketplaceSearchService,
  createSearchService,
} from './search-service';
export type {
  SearchScope,
  ProductResult,
  SearchResponse,
  SearchServiceConfig,
} from './search-service';

