/**
 * Better Data Backend Implementation
 * 
 * This example shows how Better Data integrates with the open-source LLM Gateway.
 * It implements the backend interfaces using the Better Data Prisma schema.
 * 
 * This file is for reference only - the actual implementation lives in the
 * closed-source Better Data platform.
 */

import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  LinkGenerator,
  Product,
  ProductFilters,
  ProductSearchResult,
  InventoryStatus,
  Recommendation,
  Cart,
  Order,
  Address,
  PaymentInfo,
  ShortLink,
} from '../src/backends/interfaces.js';

// This would be imported from @repo/database in the actual implementation
type PrismaClient = unknown;

/**
 * Better Data Product Backend
 * 
 * Connects to the Better Data product catalog via Prisma.
 */
export class BetterDataProductBackend implements ProductBackend {
  constructor(
    private prisma: PrismaClient,
    private organizationId?: string
  ) {}

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    // Implementation would use Better Data's Prisma schema
    // with full-text search and vector similarity
    
    // Example pseudo-code:
    // const products = await this.prisma.product.findMany({
    //   where: {
    //     organizationId: this.organizationId,
    //     status: 'ACTIVE',
    //     OR: [
    //       { name: { contains: query } },
    //       { description: { contains: query } },
    //     ],
    //     ...(filters?.category && { primaryCategory: { name: filters.category } }),
    //   },
    //   include: { primaryCategory: true, inventoryItems: true },
    //   take: options?.limit ?? 20,
    //   skip: options?.offset ?? 0,
    // });

    return {
      products: [],
      total: 0,
      hasMore: false,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    // const product = await this.prisma.product.findFirst({
    //   where: { id: productId, status: 'ACTIVE' },
    //   include: {
    //     primaryCategory: true,
    //     productAttributes: { include: { attribute: true } },
    //     inventoryItems: { include: { location: true } },
    //   },
    // });
    
    return null;
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    // const inventoryItems = await this.prisma.inventoryItem.findMany({
    //   where: {
    //     productId: { in: productIds },
    //     ...(options?.locationId && { locationId: options.locationId }),
    //   },
    //   include: { location: true },
    // });
    
    return productIds.map(id => ({
      productId: id,
      inStock: true,
      quantity: 100,
    }));
  }

  async getRecommendations(
    context: {
      productIds?: string[];
      sessionId?: string;
      strategy?: 'similar' | 'complementary' | 'trending' | 'personalized';
      userPreferences?: Record<string, unknown>;
    },
    limit?: number
  ): Promise<Recommendation[]> {
    // Use Better Data's AI recommendation engine
    // This could use vector similarity, collaborative filtering, etc.
    
    return [];
  }
}

/**
 * Better Data Cart Backend
 * 
 * Manages shopping carts using the AI Commerce Cart model.
 */
export class BetterDataCartBackend implements CartBackend {
  constructor(
    private prisma: PrismaClient,
    private organizationId?: string
  ) {}

  async createCart(
    sessionId: string,
    metadata?: Record<string, unknown>
  ): Promise<Cart> {
    // const cart = await this.prisma.cart.create({
    //   data: {
    //     sessionId,
    //     organizationId: this.organizationId,
    //     status: 'ACTIVE',
    //     currency: 'USD',
    //     metadata,
    //   },
    //   include: { items: true },
    // });
    
    return {
      id: `cart_${Date.now()}`,
      sessionId,
      items: [],
      subtotal: 0,
      currency: 'USD',
      itemCount: 0,
      metadata,
    };
  }

  async getCart(cartId: string): Promise<Cart | null> {
    // return this.prisma.cart.findUnique({
    //   where: { id: cartId },
    //   include: { items: { include: { product: true, variant: true } } },
    // });
    
    return null;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    // const existing = await this.prisma.cart.findFirst({
    //   where: { sessionId, status: 'ACTIVE' },
    // });
    // if (existing) return existing;
    
    return this.createCart(sessionId);
  }

  async addToCart(
    cartId: string,
    item: { productId: string; variantId?: string; quantity: number },
    options?: { reserveInventory?: boolean; reserveDurationMinutes?: number }
  ): Promise<Cart> {
    // Fetch product details, add to cart, optionally create inventory reservation
    
    return {
      id: cartId,
      items: [],
      subtotal: 0,
      currency: 'USD',
      itemCount: item.quantity,
    };
  }

  async updateCartItem(
    cartId: string,
    itemId: string,
    quantity: number
  ): Promise<Cart> {
    // await this.prisma.cartItem.update({
    //   where: { id: itemId },
    //   data: { quantity },
    // });
    
    return { id: cartId, items: [], subtotal: 0, currency: 'USD', itemCount: quantity };
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    // await this.prisma.cartItem.delete({ where: { id: itemId } });
    
    return { id: cartId, items: [], subtotal: 0, currency: 'USD', itemCount: 0 };
  }

  async clearCart(cartId: string): Promise<Cart> {
    // await this.prisma.cartItem.deleteMany({ where: { cartId } });
    
    return { id: cartId, items: [], subtotal: 0, currency: 'USD', itemCount: 0 };
  }
}

/**
 * Better Data Order Backend
 * 
 * Creates orders from carts using the Better Data Order model.
 */
export class BetterDataOrderBackend implements OrderBackend {
  constructor(
    private prisma: PrismaClient,
    private organizationId?: string
  ) {}

  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo,
    options?: { notes?: string; isGift?: boolean; giftMessage?: string }
  ): Promise<Order> {
    // Create order in Better Data, update cart status, release/convert reservations
    
    const orderNumber = `BD-${Date.now().toString(36).toUpperCase()}`;
    
    return {
      id: `order_${Date.now()}`,
      orderNumber,
      status: 'PENDING',
      items: cart.items,
      subtotal: cart.subtotal,
      shipping: 9.99,
      tax: cart.subtotal * 0.0825,
      total: cart.subtotal + 9.99 + cart.subtotal * 0.0825,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress ?? shippingAddress,
      createdAt: new Date(),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    // return this.prisma.order.findUnique({ where: { id: orderId } });
    
    return null;
  }

  async calculateTotals(
    cart: Cart,
    shippingAddress?: Address
  ): Promise<{
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  }> {
    // Calculate shipping based on address, apply tax rules
    
    const subtotal = cart.subtotal;
    const shipping = subtotal >= 75 ? 0 : 9.99;
    const tax = (subtotal + shipping) * 0.0825;
    
    return {
      subtotal,
      shipping,
      tax,
      total: subtotal + shipping + tax,
      currency: cart.currency,
    };
  }
}

/**
 * Dub Link Generator
 * 
 * Generates short links using Dub.co for conversational commerce.
 */
export class DubLinkGenerator implements LinkGenerator {
  constructor(
    private dubApiKey: string,
    private domain?: string
  ) {}

  async createProductLink(
    product: Product,
    context?: { sessionId?: string; campaign?: string; source?: string }
  ): Promise<ShortLink> {
    // const response = await fetch('https://api.dub.co/links', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${this.dubApiKey}` },
    //   body: JSON.stringify({
    //     url: `https://shop.example.com/products/${product.slug}`,
    //     domain: this.domain,
    //     tagIds: ['conversational-commerce'],
    //   }),
    // });
    
    return {
      id: `link_${Date.now()}`,
      shortUrl: `https://dub.sh/abc123`,
      originalUrl: `https://shop.example.com/products/${product.slug}`,
    };
  }

  async createCartLink(cart: Cart, expiryHours?: number): Promise<ShortLink> {
    return {
      id: `link_${Date.now()}`,
      shortUrl: `https://dub.sh/cart123`,
      originalUrl: `https://shop.example.com/cart/${cart.id}`,
      expiresAt: expiryHours 
        ? new Date(Date.now() + expiryHours * 60 * 60 * 1000)
        : undefined,
    };
  }

  async trackConversion(
    linkId: string,
    event: { type: string; value?: number; metadata?: Record<string, unknown> }
  ): Promise<void> {
    // Track conversion event in Dub
    console.log(`Tracking conversion for ${linkId}:`, event);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Better Data backends
 * 
 * @example
 * ```typescript
 * import { createBetterDataBackends } from '@betterdata/commerce-gateway/examples/better-data-backend';
 * import { database } from '@repo/database/server';
 * 
 * const backends = createBetterDataBackends(database, {
 *   organizationId: 'org_123',
 *   dubApiKey: process.env.DUB_API_KEY,
 * });
 * ```
 */
export function createBetterDataBackends(
  prisma: PrismaClient,
  options?: {
    organizationId?: string;
    dubApiKey?: string;
    dubDomain?: string;
  }
) {
  return {
    products: new BetterDataProductBackend(prisma, options?.organizationId),
    cart: new BetterDataCartBackend(prisma, options?.organizationId),
    orders: new BetterDataOrderBackend(prisma, options?.organizationId),
    links: options?.dubApiKey 
      ? new DubLinkGenerator(options.dubApiKey, options.dubDomain)
      : undefined,
  };
}

