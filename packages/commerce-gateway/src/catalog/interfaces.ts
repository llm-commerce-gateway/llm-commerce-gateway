/**
 * Catalog Extension Point Interfaces
 * 
 * These interfaces define the contract between the open source LLM Gateway
 * and proprietary extensions (like Better Data SCM).
 * 
 * Open Source: Provides basic implementations (keyword search, in-memory cart)
 * Proprietary: Can extend with advanced features (ranking, multi-vendor, analytics)
 * 
 * @module catalog/interfaces
 */

// ============================================================================
// Core Product Types (Open Source)
// ============================================================================

/**
 * Minimal product representation for open source gateway
 * Suitable for single-store search (Shopify, Square, WooCommerce)
 */
export interface Product {
  id: string;
  externalId?: string;        // Platform-specific ID (e.g., Shopify product ID)
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images?: string[];
  inStock: boolean;
  quantity?: number;
  variants?: ProductVariant[];
  sku?: string;
  gtin?: string;              // UPC/EAN for product matching
  metadata?: Record<string, unknown>;
}

/**
 * Product variant (size, color, etc.)
 */
export interface ProductVariant {
  id: string;
  externalId?: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  quantity?: number;
  options?: Record<string, string>;  // e.g., { size: 'L', color: 'Blue' }
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search query input
 */
export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'newest';
}

/**
 * Search filters
 */
export interface SearchFilters {
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  // Open source: simple filters
  // SCM extends with: authenticatedOnly, vendorOrgId, etc.
}

/**
 * Search result
 */
export interface SearchResult {
  products: Product[];
  total: number;
  query: SearchQuery;
  timing?: {
    searchMs: number;
  };
}

// ============================================================================
// Cart Types
// ============================================================================

/**
 * Shopping cart
 */
export interface Cart {
  id: string;
  sessionId: string;
  items: CartItem[];
  totalItems: number;
  totalValue: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cart item
 */
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  subtotal: number;
  image?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Ranking Types (Extension Point for SCM)
// ============================================================================

/**
 * Context for ranking algorithms
 * Basic in open source, extended in SCM with location, vendor ratings, etc.
 */
export interface RankingContext {
  userLocation?: {
    lat: number;
    lng: number;
  };
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'distance';
  // SCM extends with: medianPrice, vendorPreferences, etc.
}

// ============================================================================
// EXTENSION POINT INTERFACES
// These interfaces can be implemented by SCM for advanced features
// ============================================================================

/**
 * Search Service Interface
 * 
 * Open Source: BasicSearchService (keyword search on local products)
 * SCM: MarketplaceSearchService (multi-vendor, FULLTEXT, ranking)
 */
export interface SearchService {
  /**
   * Search for products
   */
  search(query: SearchQuery): Promise<SearchResult>;
  
  /**
   * Get autocomplete suggestions (optional)
   */
  suggest?(prefix: string, limit?: number): Promise<string[]>;
}

/**
 * Ranking Service Interface
 * 
 * Open Source: Not implemented (returns products as-is)
 * SCM: Multi-factor ranking (distance, authentication, vendor rating, price)
 */
export interface RankingService {
  /**
   * Rank products based on context
   */
  rank(products: Product[], context: RankingContext): Product[];
}

/**
 * Cart Service Interface
 * 
 * Open Source: BasicCartService (in-memory or Redis)
 * SCM: MarketplaceCartService (multi-vendor, attribution tracking)
 */
export interface CartService {
  /**
   * Add item to cart
   */
  addItem(
    sessionId: string, 
    productId: string, 
    quantity: number,
    variantId?: string
  ): Promise<Cart>;
  
  /**
   * Remove item from cart
   */
  removeItem(sessionId: string, itemId: string): Promise<Cart>;
  
  /**
   * Update item quantity
   */
  updateQuantity(sessionId: string, itemId: string, quantity: number): Promise<Cart>;
  
  /**
   * Get cart contents
   */
  getCart(sessionId: string): Promise<Cart>;
  
  /**
   * Clear all items from cart
   */
  clearCart(sessionId: string): Promise<void>;
}

/**
 * Product Catalog Interface
 * 
 * Open Source: In-memory product catalog or simple DB
 * SCM: ProductMaster + ProductListing with matching
 */
export interface ProductCatalog {
  /**
   * Get a product by ID
   */
  getProduct(productId: string): Promise<Product | null>;
  
  /**
   * Get multiple products by IDs
   */
  getProducts(productIds: string[]): Promise<Product[]>;
  
  /**
   * Add or update a product
   */
  upsertProduct(product: Product): Promise<Product>;
  
  /**
   * Remove a product
   */
  removeProduct(productId: string): Promise<void>;
  
  /**
   * List all products (with pagination)
   */
  listProducts(options?: { limit?: number; offset?: number }): Promise<Product[]>;
}

/**
 * Ingestion Service Interface
 * 
 * Open Source: Simple CSV import, basic Shopify/Square fetchers
 * SCM: Full pipeline with matching, deduplication, platform accounts
 */
export interface IngestionService {
  /**
   * Import products from a source
   */
  importProducts(products: Product[]): Promise<IngestionResult>;
  
  /**
   * Sync from external platform (if supported)
   */
  syncFromPlatform?(platformConfig: PlatformConfig): Promise<IngestionResult>;
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  totalProcessed: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    productId?: string;
    sku?: string;
    error: string;
  }>;
}

/**
 * Platform configuration for external sync
 */
export interface PlatformConfig {
  platform: 'shopify' | 'square' | 'woocommerce' | 'csv' | 'google_merchant_center';
  credentials?: Record<string, string>;
  options?: Record<string, unknown>;
}

// ============================================================================
// Analytics Extension Point (SCM-only)
// ============================================================================

/**
 * Analytics tracking interface (optional, SCM implements)
 */
export interface AnalyticsService {
  /**
   * Track a search event
   */
  trackSearch?(query: string, resultCount: number, context?: Record<string, unknown>): Promise<void>;
  
  /**
   * Track an add-to-cart event
   */
  trackCartAdd?(productId: string, context?: Record<string, unknown>): Promise<void>;
  
  /**
   * Track a conversion event
   */
  trackConversion?(orderId: string, context?: Record<string, unknown>): Promise<void>;
}

// ============================================================================
// Gateway Configuration Types
// ============================================================================

/**
 * Session storage configuration
 */
export interface SessionConfig {
  storage: 'memory' | 'redis';
  redisUrl?: string;
  ttlSeconds?: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  anthropic?: { apiKey: string };
  openai?: { apiKey: string };
  grok?: { apiKey: string };
  google?: { apiKey: string };
}

/**
 * Gateway extension points
 * 
 * Pass custom implementations to override defaults:
 * - searchService: Custom search (default: BasicSearchService)
 * - cartService: Custom cart (default: BasicCartService)
 * - rankingService: Custom ranking (default: none)
 * - productCatalog: Custom catalog (default: InMemoryCatalog)
 * - analyticsService: Custom analytics (default: none)
 */
export interface GatewayExtensions {
  searchService?: SearchService;
  cartService?: CartService;
  rankingService?: RankingService;
  productCatalog?: ProductCatalog;
  ingestionService?: IngestionService;
  analyticsService?: AnalyticsService;
}
