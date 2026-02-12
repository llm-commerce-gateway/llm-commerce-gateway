/**
 * Gateway Factory with Extension Points
 * 
 * Creates LLM Gateway instances with configurable service implementations.
 * 
 * Open Source: Uses BasicSearchService, BasicCartService, InMemoryCatalog
 * SCM: Can inject MarketplaceSearchService, MarketplaceCartService, etc.
 * 
 * @module core/GatewayFactory
 */

import type {
  SearchService,
  CartService,
  RankingService,
  ProductCatalog,
  IngestionService,
  AnalyticsService,
  GatewayExtensions,
  Product,
  SessionConfig,
  ProviderConfig,
} from '../catalog/interfaces';
import { BasicSearchService } from '../catalog/basic-search-service';
import { BasicCartService, InMemoryCartStorage, RedisCartStorage } from '../catalog/basic-cart-service';
import { InMemoryCatalog } from '../catalog/in-memory-catalog';
import { ToolRegistry } from './ToolRegistry';
import type { ToolContext, ToolResult } from './types';

// ============================================================================
// Gateway Configuration
// ============================================================================

/**
 * Simple gateway configuration for open source usage
 */
export interface SimpleGatewayConfig {
  /**
   * Initial products to load into the catalog
   * Alternative: Use ingestionService to load products
   */
  products?: Product[];

  /**
   * Session storage configuration
   */
  session?: SessionConfig;

  /**
   * LLM provider API keys
   */
  providers?: ProviderConfig;

  /**
   * Extension points - inject custom service implementations
   * If not provided, uses default open source implementations
   */
  extensions?: GatewayExtensions;

  /**
   * Redis client for session/cart storage (optional)
   */
  redis?: RedisClient;

  /**
   * Default currency for pricing
   */
  defaultCurrency?: string;
}

// Minimal Redis client interface
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

// ============================================================================
// Gateway Services Container
// ============================================================================

/**
 * Container for all gateway services
 * Can be extended by SCM with additional services
 */
export interface GatewayServices {
  catalog: ProductCatalog;
  search: SearchService;
  cart: CartService;
  ranking?: RankingService;
  ingestion?: IngestionService;
  analytics?: AnalyticsService;
}

/**
 * Create gateway services with defaults or custom implementations
 */
export function createGatewayServices(config: SimpleGatewayConfig): GatewayServices {
  // 1. Create or use provided catalog
  const catalog = config.extensions?.productCatalog 
    ?? new InMemoryCatalog(config.products);

  // 2. Create or use provided search service
  const search = config.extensions?.searchService 
    ?? new BasicSearchService({ catalog });

  // 3. Create or use provided cart service
  let cart: CartService;
  if (config.extensions?.cartService) {
    cart = config.extensions.cartService;
  } else {
    // Use Redis if provided, otherwise in-memory
    const storage = config.redis
      ? new RedisCartStorage({
          redis: config.redis,
          ttlSeconds: config.session?.ttlSeconds ?? 86400,
        })
      : new InMemoryCartStorage({
          ttlMs: (config.session?.ttlSeconds ?? 86400) * 1000,
        });

    cart = new BasicCartService({
      catalog,
      storage,
      defaultCurrency: config.defaultCurrency,
    });
  }

  // 4. Optional services (SCM provides these)
  const ranking = config.extensions?.rankingService;
  const ingestion = config.extensions?.ingestionService;
  const analytics = config.extensions?.analyticsService;

  return {
    catalog,
    search,
    cart,
    ranking,
    ingestion,
    analytics,
  };
}

// ============================================================================
// Tool Definitions for Open Source Gateway
// ============================================================================

/**
 * Register open source commerce tools
 * Uses the provided services for implementation
 */
export function registerCommerceTools(services: GatewayServices): void {
  // Search Products Tool
  ToolRegistry.register({
    name: 'search_products',
    description: 'Search for products in the catalog by keyword, brand, category, or other criteria',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text (product name, brand, category)',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        brand: {
          type: 'string',
          description: 'Filter by brand',
        },
        priceMin: {
          type: 'number',
          description: 'Minimum price filter',
        },
        priceMax: {
          type: 'number',
          description: 'Maximum price filter',
        },
        inStockOnly: {
          type: 'boolean',
          description: 'Only show in-stock items',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
      },
      required: ['query'],
    },
    handler: async (input: SearchProductsInput, _context: ToolContext): Promise<ToolResult> => {
      try {
        const result = await services.search.search({
          text: input.query,
          filters: {
            category: input.category,
            brand: input.brand,
            priceMin: input.priceMin,
            priceMax: input.priceMax,
            inStockOnly: input.inStockOnly ?? true,
          },
          limit: input.limit ?? 10,
        });

        // Apply ranking if available
        let products = result.products;
        if (services.ranking) {
          products = services.ranking.rank(products, {
            sortBy: 'relevance',
          });
        }

        // Track analytics if available
        if (services.analytics?.trackSearch) {
          await services.analytics.trackSearch(input.query, products.length);
        }

        return {
          success: true,
          data: {
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              price: p.price,
              currency: p.currency,
              description: p.description,
              image: p.images?.[0],
              inStock: p.inStock,
            })),
            total: result.total,
            query: input.query,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search failed',
        };
      }
    },
  });

  // Get Product Details Tool
  ToolRegistry.register({
    name: 'get_product_details',
    description: 'Get detailed information about a specific product including variants, pricing, and availability',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID',
        },
      },
      required: ['productId'],
    },
    handler: async (input: { productId: string }, _context: ToolContext): Promise<ToolResult> => {
      try {
        const product = await services.catalog.getProduct(input.productId);
        
        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          };
        }

        return {
          success: true,
          data: product,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get product',
        };
      }
    },
  });

  // Add to Cart Tool
  ToolRegistry.register({
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID to add',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add',
          default: 1,
        },
        variantId: {
          type: 'string',
          description: 'Optional variant ID (size, color, etc.)',
        },
      },
      required: ['productId'],
    },
    handler: async (input: AddToCartInput, context: ToolContext): Promise<ToolResult> => {
      try {
        const sessionId = context.sessionId ?? 'anonymous';
        const cart = await services.cart.addItem(
          sessionId,
          input.productId,
          input.quantity ?? 1,
          input.variantId
        );

        // Track analytics if available
        if (services.analytics?.trackCartAdd) {
          await services.analytics.trackCartAdd(input.productId);
        }

        return {
          success: true,
          data: {
            message: 'Added to cart',
            cart: {
              id: cart.id,
              items: cart.items.length,
              totalItems: cart.totalItems,
              totalValue: cart.totalValue,
              currency: cart.currency,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add to cart',
        };
      }
    },
  });

  // View Cart Tool
  ToolRegistry.register({
    name: 'view_cart',
    description: 'View the current shopping cart contents',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (_input: unknown, context: ToolContext): Promise<ToolResult> => {
      try {
        const sessionId = context.sessionId ?? 'anonymous';
        const cart = await services.cart.getCart(sessionId);

        if (cart.items.length === 0) {
          return {
            success: true,
            data: {
              message: 'Your cart is empty',
              cart: {
                id: cart.id,
                items: [],
                totalItems: 0,
                totalValue: 0,
                currency: cart.currency,
              },
            },
          };
        }

        return {
          success: true,
          data: {
            cart: {
              id: cart.id,
              items: cart.items.map(item => ({
                id: item.id,
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal,
              })),
              totalItems: cart.totalItems,
              totalValue: cart.totalValue,
              currency: cart.currency,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get cart',
        };
      }
    },
  });

  // Remove from Cart Tool
  ToolRegistry.register({
    name: 'remove_from_cart',
    description: 'Remove an item from the shopping cart',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'The cart item ID to remove',
        },
      },
      required: ['itemId'],
    },
    handler: async (input: { itemId: string }, context: ToolContext): Promise<ToolResult> => {
      try {
        const sessionId = context.sessionId ?? 'anonymous';
        const cart = await services.cart.removeItem(sessionId, input.itemId);

        return {
          success: true,
          data: {
            message: 'Removed from cart',
            cart: {
              id: cart.id,
              totalItems: cart.totalItems,
              totalValue: cart.totalValue,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove from cart',
        };
      }
    },
  });

  // Update Cart Quantity Tool
  ToolRegistry.register({
    name: 'update_cart_quantity',
    description: 'Update the quantity of an item in the cart',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'The cart item ID to update',
        },
        quantity: {
          type: 'number',
          description: 'New quantity (0 to remove)',
        },
      },
      required: ['itemId', 'quantity'],
    },
    handler: async (input: { itemId: string; quantity: number }, context: ToolContext): Promise<ToolResult> => {
      try {
        const sessionId = context.sessionId ?? 'anonymous';
        const cart = await services.cart.updateQuantity(
          sessionId,
          input.itemId,
          input.quantity
        );

        return {
          success: true,
          data: {
            message: input.quantity === 0 ? 'Removed from cart' : 'Cart updated',
            cart: {
              id: cart.id,
              totalItems: cart.totalItems,
              totalValue: cart.totalValue,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update cart',
        };
      }
    },
  });
}

// ============================================================================
// Tool Input Types
// ============================================================================

interface SearchProductsInput {
  query: string;
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  limit?: number;
}

interface AddToCartInput {
  productId: string;
  quantity?: number;
  variantId?: string;
}

// ============================================================================
// Simple Gateway Factory
// ============================================================================

/**
 * Create a simple gateway for open source usage
 * 
 * This is the easiest way to get started with LLM Gateway:
 * 
 * @example
 * ```typescript
 * import { createSimpleGateway } from '@betterdata/llm-gateway';
 * import products from './products.json';
 * 
 * const gateway = createSimpleGateway({
 *   products,
 *   providers: {
 *     anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
 *   },
 * });
 * 
 * // Gateway is ready to use with tools registered
 * ```
 */
export function createSimpleGateway(config: SimpleGatewayConfig): {
  services: GatewayServices;
  registerTools: () => void;
} {
  const services = createGatewayServices(config);

  return {
    services,
    registerTools: () => registerCommerceTools(services),
  };
}

// ============================================================================
// SCM Gateway Factory (Extension Point)
// ============================================================================

/**
 * Configuration for SCM-enhanced gateway
 * Used by Better Data's proprietary marketplace
 */
export interface SCMGatewayConfig extends SimpleGatewayConfig {
  /**
   * Prisma client for database access
   */
  prisma?: unknown;

  /**
   * Enable multi-vendor marketplace features
   */
  marketplace?: {
    enabled: boolean;
    /**
     * Multi-factor ranking configuration
     */
    ranking?: {
      weights?: {
        distance?: number;
        authentication?: number;
        price?: number;
        vendorRating?: number;
      };
    };
    /**
     * LLM attribution tracking
     */
    attribution?: {
      enabled: boolean;
      trackProvider?: boolean;
      trackSearchQuery?: boolean;
    };
  };
}

/**
 * Create SCM-enhanced gateway (called from apps/scm)
 * 
 * This function is meant to be called with SCM's proprietary service implementations:
 * 
 * @example
 * ```typescript
 * // In apps/scm
 * import { createSCMGateway } from '@betterdata/llm-gateway';
 * import { MarketplaceSearchService } from './catalog/search-service';
 * import { MarketplaceCartService } from './catalog/cart-service';
 * import { RankingService } from './catalog/ranking-service';
 * 
 * const gateway = createSCMGateway({
 *   prisma,
 *   extensions: {
 *     searchService: new MarketplaceSearchService({ prisma }),
 *     cartService: new MarketplaceCartService({ prisma }),
 *     rankingService: new RankingService(),
 *   },
 *   marketplace: {
 *     enabled: true,
 *     attribution: { enabled: true },
 *   },
 * });
 * ```
 */
export function createSCMGateway(config: SCMGatewayConfig): {
  services: GatewayServices;
  registerTools: () => void;
  config: SCMGatewayConfig;
} {
  const services = createGatewayServices(config);

  return {
    services,
    registerTools: () => registerCommerceTools(services),
    config,
  };
}
