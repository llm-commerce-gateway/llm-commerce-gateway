/**
 * @betterdata/commerce-gateway - Built-in Commerce Tools
 * 
 * These tools work with any commerce backend that implements the
 * ProductBackend, CartBackend, and OrderBackend interfaces.
 * 
 * @license Apache-2.0
 */

import { z } from 'zod';
import { ToolRegistry } from '../core/ToolRegistry';
import type {
  ToolContext,
  ToolResult,
  SearchProductsInput,
  SearchProductsOutput,
  GetProductDetailsInput,
  GetProductDetailsOutput,
  AddToCartInput,
  AddToCartOutput,
  CheckAvailabilityInput,
  CheckAvailabilityOutput,
  CheckInventoryInput,
  CheckInventoryOutput,
  GetRecommendationsInput,
  GetRecommendationsOutput,
  CreateOrderInput,
  CreateOrderOutput,
} from '../core/types';

// ============================================================================
// Tool Schemas
// ============================================================================

const SearchProductsSchema = z.object({
  query: z.string().describe('Search query for products'),
  filters: z.object({
    category: z.string().optional().describe('Filter by category'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    priceRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional().describe('Filter by price range'),
    inStock: z.boolean().optional().describe('Only show in-stock items'),
  }).optional(),
  pagination: z.object({
    limit: z.number().min(1).max(50).default(20).optional(),
    offset: z.number().min(0).default(0).optional(),
  }).optional(),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popularity', 'rating']).optional(),
});

const GetProductDetailsSchema = z.object({
  productId: z.string().describe('Product ID or slug'),
  includeVariants: z.boolean().optional().default(true),
  includeRelated: z.boolean().optional().default(false),
  includeInventory: z.boolean().optional().default(true),
});

const AddToCartSchema = z.object({
  productId: z.string().describe('Product ID to add'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().int().min(1).default(1).describe('Quantity to add'),
  reserveInventory: z.boolean().optional().default(false).describe('Reserve inventory'),
  reserveDurationMinutes: z.number().optional().default(15).describe('Reservation duration'),
});

const CheckInventorySchema = z.object({
  productId: z.string().describe('Product ID to check'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  locationId: z.string().optional().describe('Specific location to check'),
  quantity: z.number().int().min(1).default(1).describe('Desired quantity'),
});

const CheckAvailabilitySchema = z.object({
  productId: z.string().describe('Product ID to check'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().int().min(1).default(1).describe('Desired quantity'),
});

const GetRecommendationsSchema = z.object({
  productIds: z.array(z.string()).optional().describe('Product IDs for context'),
  context: z.object({
    hairType: z.string().optional(),
    skinType: z.string().optional(),
    concerns: z.array(z.string()).optional(),
    budget: z.enum(['low', 'medium', 'high', 'luxury']).optional(),
  }).optional().describe('User context for personalization'),
  strategy: z.enum(['similar', 'complementary', 'trending', 'bundle', 'personalized']).optional().default('personalized'),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

const AddressSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const CreateOrderSchema = z.object({
  cartId: z.string().describe('Cart ID to convert to order'),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema.optional(),
  paymentMethod: z.string().describe('Payment method'),
  notes: z.string().optional(),
  giftMessage: z.string().optional(),
  isGift: z.boolean().optional().default(false),
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Helper to ensure backends are available
 */
function requireBackends(context: ToolContext): NonNullable<ToolContext['backends']> {
  if (!context.backends) {
    throw new Error('Backends not configured. These tools require a backend implementation.');
  }
  return context.backends;
}

async function searchProductsHandler(
  input: SearchProductsInput,
  context: ToolContext
): Promise<ToolResult<SearchProductsOutput>> {
  try {
    const backends = requireBackends(context);
    const result = await backends.products.searchProducts(
      input.query,
      {
        category: input.filters?.category,
        tags: input.filters?.tags,
        priceMin: input.filters?.priceRange?.min,
        priceMax: input.filters?.priceRange?.max,
        inStock: input.filters?.inStock,
      },
      {
        limit: input.pagination?.limit ?? 20,
        offset: input.pagination?.offset ?? 0,
      }
    );

    return {
      success: true,
      data: {
        products: result.products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description ?? '',
          shortDescription: undefined,
          price: p.price,
          images: p.images ?? [],
          category: p.category,
          tags: p.tags ?? [],
          rating: undefined,
          availability: p.availability ?? { inStock: true },
          relevanceScore: 1.0,
        })),
        totalCount: result.total,
        hasMore: result.hasMore,
        facets: result.facets ? {
          categories: result.facets.categories ?? [],
        } : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

async function getProductDetailsHandler(
  input: GetProductDetailsInput,
  context: ToolContext
): Promise<ToolResult<GetProductDetailsOutput>> {
  try {
    const backends = requireBackends(context);
    const product = await backends.products.getProductDetails(input.productId);
    
    if (!product) {
      return {
        success: false,
        error: `Product not found: ${input.productId}`,
      };
    }

    // Get inventory if requested
    let availability = product.availability ?? { inStock: true };
    if (input.includeInventory) {
      const inventory = await backends.products.checkInventory([product.id]);
      if (inventory.length > 0 && inventory[0]) {
        availability = {
          inStock: inventory[0].inStock,
          quantity: inventory[0].quantity,
        };
      }
    }

    // Get related products if requested
    let relatedProducts: string[] | undefined;
    if (input.includeRelated && backends.products.getRecommendations) {
      const recommendations = await backends.products.getRecommendations(
        { productIds: [product.id], strategy: 'similar' },
        4
      );
      relatedProducts = recommendations.map(r => r.product.id);
    }

    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.variants?.[0]?.sku,
        description: product.description ?? '',
        shortDescription: undefined,
        price: product.price,
        images: product.images ?? [],
        category: product.category,
        tags: product.tags ?? [],
        rating: undefined,
        availability,
        variants: input.includeVariants ? product.variants?.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price ?? product.price,
          attributes: v.attributes ?? {},
          availability: v.availability ?? { inStock: true },
        })) : undefined,
        attributes: product.attributes,
        relatedProducts,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get product details',
    };
  }
}

async function addToCartHandler(
  input: AddToCartInput,
  context: ToolContext
): Promise<ToolResult<AddToCartOutput>> {
  try {
    const backends = requireBackends(context);
    // Get or create cart
    const sessionId = context.sessionId ?? `session-${Date.now()}`;
    const cart = await backends.cart.getOrCreateCart(sessionId);

    // Get product details for the response
    const product = await backends.products.getProductDetails(input.productId);
    if (!product) {
      return {
        success: false,
        error: `Product not found: ${input.productId}`,
      };
    }

    // Use defaults for optional fields
    const quantity = input.quantity ?? 1;

    // Add to cart
    const updatedCart = await backends.cart.addToCart(
      cart.id,
      {
        productId: input.productId,
        variantId: input.variantId,
        quantity,
      },
      {
        reserveInventory: input.reserveInventory,
        reserveDurationMinutes: input.reserveDurationMinutes,
      }
    );

    // Update session with cart ID
    if (context.session) {
      context.session.cartId = updatedCart.id;
    }

    // Find the added item
    const addedItem = updatedCart.items.find(
      i => i.productId === input.productId && 
           (input.variantId ? i.variantId === input.variantId : true)
    );

    return {
      success: true,
      data: {
        cartId: updatedCart.id,
        item: {
          productId: input.productId,
          variantId: input.variantId,
          name: addedItem?.name ?? product.name,
          quantity: addedItem?.quantity ?? quantity,
          unitPrice: addedItem?.unitPrice ?? product.price.amount,
          totalPrice: addedItem?.totalPrice ?? product.price.amount * quantity,
        },
        cart: {
          itemCount: updatedCart.itemCount,
          subtotal: updatedCart.subtotal,
          currency: updatedCart.currency,
          reservedUntil: updatedCart.reservedUntil?.toISOString(),
        },
        message: `Added ${quantity} ${product.name} to your cart.`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add to cart',
    };
  }
}

async function checkInventoryHandler(
  input: CheckInventoryInput,
  context: ToolContext
): Promise<ToolResult<CheckInventoryOutput>> {
  try {
    const backends = requireBackends(context);
    // Use default quantity of 1 if not specified
    const quantity = input.quantity ?? 1;

    const inventory = await backends.products.checkInventory(
      [input.productId],
      input.locationId ? { locationId: input.locationId } : undefined
    );

    if (inventory.length === 0 || !inventory[0]) {
      return {
        success: false,
        error: `Product not found: ${input.productId}`,
      };
    }

    // TypeScript now knows inventory[0] is defined due to the check above
    const status = inventory[0]!;
    const canFulfill = status.quantity >= quantity;

    let message: string;
    if (canFulfill) {
      if (status.quantity <= 10) {
        message = `In stock with ${status.quantity} units available. Low stock - order soon!`;
      } else {
        message = `In stock with ${status.quantity} units available. Ships within 1-2 business days.`;
      }
    } else if (status.quantity > 0) {
      message = `Only ${status.quantity} units available. More stock expected soon.`;
    } else {
      message = 'Currently out of stock. Expected back in stock within 2-3 weeks.';
    }

    return {
      success: true,
      data: {
        productId: input.productId,
        variantId: input.variantId,
        availability: {
          inStock: status.inStock,
          quantityAvailable: status.quantity,
          canFulfill,
          message,
        },
        locations: status.locations?.map(loc => ({
          locationId: loc.locationId,
          locationName: loc.locationName,
          quantityAvailable: loc.quantity,
          leadTimeDays: loc.leadTimeDays,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check inventory',
    };
  }
}

async function checkAvailabilityHandler(
  input: CheckAvailabilityInput,
  context: ToolContext
): Promise<ToolResult<CheckAvailabilityOutput>> {
  try {
    const backends = requireBackends(context);
    const quantity = input.quantity ?? 1;

    const inventory = await backends.products.checkInventory([input.productId]);

    if (inventory.length === 0 || !inventory[0]) {
      return {
        success: false,
        error: `Product not found: ${input.productId}`,
      };
    }

    const status = inventory[0]!;
    const available = status.inStock && status.quantity >= quantity;
    const confidence = available ? 0.9 : 0.4;
    const message = available
      ? 'In stock and available to ship.'
      : 'Currently unavailable. Check back soon.';

    return {
      success: true,
      data: {
        productId: input.productId,
        variantId: input.variantId,
        availability: {
          available,
          message,
          confidence,
        },
        delivery: status.shippingEstimate ? { estimate: status.shippingEstimate } : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check availability',
    };
  }
}

async function getRecommendationsHandler(
  input: GetRecommendationsInput,
  context: ToolContext
): Promise<ToolResult<GetRecommendationsOutput>> {
  try {
    const backends = requireBackends(context);
    if (!backends.products.getRecommendations) {
      return {
        success: false,
        error: 'Recommendations not supported by this backend',
      };
    }

    const recommendations = await backends.products.getRecommendations(
      {
        productIds: input.productIds,
        sessionId: context.sessionId,
        strategy: input.strategy,
        userPreferences: input.context,
      },
      input.limit ?? 5
    );

    return {
      success: true,
      data: {
        recommendations: recommendations.map(rec => ({
          product: {
            id: rec.product.id,
            name: rec.product.name,
            slug: rec.product.slug,
            description: rec.product.description ?? '',
            price: rec.product.price,
            images: rec.product.images ?? [],
            availability: rec.product.availability ?? { inStock: true },
          },
          reason: rec.reason,
          confidence: rec.confidence,
          strategy: rec.strategy,
        })),
        totalAvailable: recommendations.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations',
    };
  }
}

async function createOrderHandler(
  input: CreateOrderInput,
  context: ToolContext
): Promise<ToolResult<CreateOrderOutput>> {
  try {
    const backends = requireBackends(context);
    // Get the cart
    const cart = await backends.cart.getCart(input.cartId);
    if (!cart) {
      return {
        success: false,
        error: `Cart not found: ${input.cartId}`,
      };
    }

    if (cart.items.length === 0) {
      return {
        success: false,
        error: 'Cart is empty',
      };
    }

    // Create the order
    const order = await backends.orders.createOrder(
      cart,
      input.shippingAddress,
      input.billingAddress,
      { method: input.paymentMethod },
      {
        notes: input.notes,
        isGift: input.isGift,
        giftMessage: input.giftMessage,
      }
    );

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: {
          subtotal: order.subtotal,
          shipping: order.shipping,
          tax: order.tax,
          total: order.total,
          currency: order.currency,
        },
        estimatedDelivery: order.estimatedDelivery,
        confirmationUrl: order.trackingUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}

// ============================================================================
// Register Built-in Tools
// ============================================================================

export function registerBuiltInTools(): void {
  ToolRegistry.register({
    name: 'search_products',
    description: `Search for products using natural language queries. 
Supports filtering by category, price range, availability, and tags.
Returns product details including pricing, images, and real-time inventory status.
Use this tool when customers ask about finding products, looking for specific items, or browsing the catalog.`,
    inputSchema: SearchProductsSchema,
    handler: searchProductsHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 100, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'get_product_details',
    description: `Get comprehensive details about a specific product.
Includes pricing, images, variants, inventory levels, ingredients, and usage instructions.
Use this tool when customers want to learn more about a specific product, need ingredient lists, or want to see available size/variant options.`,
    inputSchema: GetProductDetailsSchema,
    handler: getProductDetailsHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 200, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'add_to_cart',
    description: `Add a product to the shopping cart.
Supports specifying quantity and variant selection.
Optionally reserves inventory for a limited time to prevent overselling.
Returns updated cart totals and a checkout link.
Use this tool when customers want to buy a product or add it to their cart.`,
    inputSchema: AddToCartSchema,
    handler: addToCartHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 50, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'check_availability',
    description: `Check buyer-safe availability for a product.
Returns availability status and optional delivery estimate without location details.
Use this tool when customers ask if an item is available.`,
    inputSchema: CheckAvailabilitySchema,
    handler: checkAvailabilityHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 200, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'check_inventory',
    description: `Check real-time inventory availability for a product.
Returns quantity available, location-specific stock levels, and alternative options.
Use this tool when customers ask about availability, stock levels, or want to know if an item will ship quickly.`,
    inputSchema: CheckInventorySchema,
    handler: checkInventoryHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 200, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'get_recommendations',
    description: `Get personalized product recommendations based on user preferences and context.
Supports multiple strategies: similar (related products), complementary (works well together), trending (popular items), bundle (value sets), and personalized (based on user context).
Use this tool when customers need suggestions, want to discover products, or are building a routine.`,
    inputSchema: GetRecommendationsSchema,
    handler: getRecommendationsHandler,
    options: {
      requiresAuth: false,
      rateLimit: { requests: 100, windowMs: 60000 },
    },
  });

  ToolRegistry.register({
    name: 'create_order',
    description: `Create an order from the shopping cart.
Requires shipping address and payment method.
Calculates shipping, tax, and total.
Returns order confirmation with estimated delivery.
Use this tool when the customer is ready to complete their purchase.`,
    inputSchema: CreateOrderSchema,
    handler: createOrderHandler,
    options: {
      requiresAuth: true,
      rateLimit: { requests: 10, windowMs: 60000 },
    },
  });
}

// Export individual tools for custom usage
export {
  SearchProductsSchema,
  GetProductDetailsSchema,
  AddToCartSchema,
  CheckAvailabilitySchema,
  CheckInventorySchema,
  GetRecommendationsSchema,
  CreateOrderSchema,
  searchProductsHandler,
  getProductDetailsHandler,
  addToCartHandler,
  checkAvailabilityHandler,
  checkInventoryHandler,
  getRecommendationsHandler,
  createOrderHandler,
};

