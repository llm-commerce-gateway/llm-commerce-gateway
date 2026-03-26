/**
 * @betterdata/commerce-gateway - Demo Backend
 * 
 * A simple in-memory backend implementation for testing and examples.
 * This backend uses mock data and doesn't require any external dependencies.
 * 
 * @example
 * ```typescript
 * import { DemoBackend } from '@betterdata/commerce-gateway/backends/demo';
 * 
 * const gateway = new LLMGateway({
 *   backends: DemoBackend.create(),
 *   // ...
 * });
 * ```
 * 
 * @license Apache-2.0
 */

import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  GatewayBackends,
  Product,
  ProductFilters,
  ProductSearchResult,
  InventoryStatus,
  Recommendation,
  Cart,
  CartItem,
  Order,
  Address,
  PaymentInfo,
} from './interfaces';

// ============================================================================
// Mock Product Data (Lumebonde example)
// ============================================================================

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod_001',
    name: 'Velvet Matte Lipstick - Ruby',
    slug: 'velvet-matte-lipstick-ruby',
    description: 'Long-lasting matte lipstick with velvety finish. Rich ruby red color perfect for any occasion.',
    price: { amount: 24.99, currency: 'USD', compareAtPrice: 29.99 },
    images: [
      { url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa', alt: 'Velvet Matte Lipstick - Ruby' },
    ],
    category: 'beauty.makeup.lipstick',
    tags: ['lipstick', 'matte', 'long-lasting', 'ruby'],
    availability: { inStock: true, quantity: 45 },
    attributes: {
      color: 'Ruby Red',
      finish: 'Matte',
      ingredients: ['Beeswax', 'Carnauba Wax', 'Vitamin E'],
      benefits: ['Long-lasting', 'Hydrating', 'Smudge-proof'],
    },
  },
  {
    id: 'prod_002',
    name: 'Velvet Matte Lipstick - Rose',
    slug: 'velvet-matte-lipstick-rose',
    description: 'Elegant rose pink matte lipstick. Perfect for everyday wear.',
    price: { amount: 24.99, currency: 'USD', compareAtPrice: 29.99 },
    images: [
      { url: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133', alt: 'Velvet Matte Lipstick - Rose' },
    ],
    category: 'beauty.makeup.lipstick',
    tags: ['lipstick', 'matte', 'rose', 'everyday'],
    availability: { inStock: true, quantity: 32 },
    attributes: {
      color: 'Rose Pink',
      finish: 'Matte',
      ingredients: ['Beeswax', 'Carnauba Wax', 'Vitamin E'],
      benefits: ['Long-lasting', 'Hydrating', 'Smudge-proof'],
    },
  },
  {
    id: 'prod_003',
    name: 'Hydrating Face Serum',
    slug: 'hydrating-face-serum',
    description: 'Intensive hydrating serum with hyaluronic acid. Perfect for dry and sensitive skin.',
    price: { amount: 39.99, currency: 'USD' },
    images: [
      { url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571', alt: 'Hydrating Face Serum' },
    ],
    category: 'beauty.skincare.serum',
    tags: ['serum', 'hydrating', 'hyaluronic-acid', 'skincare'],
    availability: { inStock: true, quantity: 28 },
    attributes: {
      skinType: 'Dry, Sensitive',
      keyIngredients: ['Hyaluronic Acid', 'Vitamin C', 'Niacinamide'],
      benefits: ['Hydrating', 'Brightening', 'Anti-aging'],
    },
  },
  {
    id: 'prod_004',
    name: 'Gentle Cleansing Oil',
    slug: 'gentle-cleansing-oil',
    description: 'Oil-based cleanser that removes makeup and impurities without stripping skin.',
    price: { amount: 29.99, currency: 'USD' },
    images: [
      { url: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8', alt: 'Gentle Cleansing Oil' },
    ],
    category: 'beauty.skincare.cleanser',
    tags: ['cleanser', 'oil', 'gentle', 'makeup-remover'],
    availability: { inStock: true, quantity: 15 },
    attributes: {
      skinType: 'All Skin Types',
      keyIngredients: ['Jojoba Oil', 'Argan Oil', 'Vitamin E'],
      benefits: ['Deep Cleansing', 'Moisturizing', 'Non-stripping'],
    },
  },
];

// ============================================================================
// Demo Product Backend
// ============================================================================

class DemoProductBackend implements ProductBackend {
  private products: Product[];

  constructor(products: Product[] = MOCK_PRODUCTS) {
    this.products = products;
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const queryLower = query.toLowerCase();

    // Simple text search
    let results = this.products.filter((product) => {
      const matchesQuery =
        product.name.toLowerCase().includes(queryLower) ||
        product.description?.toLowerCase().includes(queryLower) ||
        product.tags?.some((tag) => tag.toLowerCase().includes(queryLower));

      if (!matchesQuery) return false;

      // Apply filters
      if (filters?.category && product.category !== filters.category) return false;
      if (filters?.tags && !filters.tags.some((tag) => product.tags?.includes(tag))) return false;
      if (filters?.priceMin && product.price.amount < filters.priceMin) return false;
      if (filters?.priceMax && product.price.amount > filters.priceMax) return false;
      if (filters?.inStock && !product.availability?.inStock) return false;

      return true;
    });

    const total = results.length;
    const hasMore = results.length > offset + limit;
    const paginatedResults = results.slice(offset, offset + limit);

    // Build facets
    const categoryCounts = new Map<string, number>();
    paginatedResults.forEach((p) => {
      if (p.category) {
        categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
      }
    });

    return {
      products: paginatedResults,
      total,
      hasMore,
      facets: {
        categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count })),
      },
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    return this.products.find((p) => p.id === productId || p.slug === productId) ?? null;
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    return productIds.map((id) => {
      const product = this.products.find((p) => p.id === id);
      return {
        productId: id,
        inStock: product?.availability?.inStock ?? false,
        quantity: product?.availability?.quantity ?? 0,
        locations: options?.locationId
          ? [
              {
                locationId: options.locationId,
                locationName: 'Main Warehouse',
                quantity: product?.availability?.quantity ?? 0,
                leadTimeDays: 2,
              },
            ]
          : undefined,
      };
    });
  }

  async getRecommendations(
    context: {
      productIds?: string[];
      sessionId?: string;
      strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
      userPreferences?: Record<string, unknown>;
    },
    limit: number = 10
  ): Promise<Recommendation[]> {
    const { productIds, strategy = 'trending' } = context;
    let candidates: Product[] = [];

    switch (strategy) {
      case 'similar': {
        if (productIds && productIds.length > 0) {
          const sourceProducts = this.products.filter((p) => productIds.includes(p.id));
          const categories = new Set(sourceProducts.map((p) => p.category).filter(Boolean));
          candidates = this.products.filter(
            (p) => !productIds.includes(p.id) && p.category && categories.has(p.category)
          );
        }
        break;
      }
      case 'complementary': {
        if (productIds && productIds.length > 0) {
          const sourceProducts = this.products.filter((p) => productIds.includes(p.id));
          const categories = new Set(sourceProducts.map((p) => p.category).filter(Boolean));
          candidates = this.products.filter(
            (p) => !productIds.includes(p.id) && p.category && !categories.has(p.category)
          );
        }
        break;
      }
      case 'trending':
      case 'personalized':
      case 'bundle':
      default: {
        candidates = this.products.filter((p) => !productIds?.includes(p.id));
        break;
      }
    }

    return candidates.slice(0, limit).map((product) => ({
      product,
      reason: strategy === 'similar' ? 'Similar to products you viewed' : 'Recommended for you',
      confidence: 0.85,
      strategy,
    }));
  }
}

// ============================================================================
// Demo Cart Backend
// ============================================================================

class DemoCartBackend implements CartBackend {
  private carts = new Map<string, Cart>();

  async createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart> {
    const cart: Cart = {
      id: `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
      metadata,
    };
    this.carts.set(cart.id, cart);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    return this.carts.get(cartId) ?? null;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const existing = Array.from(this.carts.values()).find((c) => c.sessionId === sessionId);
    if (existing) return existing;
    return this.createCart(sessionId);
  }

  async addToCart(
    cartId: string,
    item: { productId: string; variantId?: string; quantity: number },
    options?: { reserveInventory?: boolean; reserveDurationMinutes?: number }
  ): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error(`Cart not found: ${cartId}`);

    // In a real implementation, you'd fetch product details from ProductBackend
    // For demo, we'll create a simple item
    const cartItem: CartItem = {
      id: `item_${Date.now()}`,
      productId: item.productId,
      variantId: item.variantId,
      name: `Product ${item.productId}`,
      quantity: item.quantity,
      unitPrice: 24.99, // Would come from product
      totalPrice: 24.99 * item.quantity,
    };

    // Check if item already exists
    const existingIndex = cart.items.findIndex(
      (i) => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      const existingItem = cart.items[existingIndex];
      if (existingItem) {
        existingItem.quantity += item.quantity;
        existingItem.totalPrice = existingItem.unitPrice * existingItem.quantity;
      }
    } else {
      cart.items.push(cartItem);
    }

    // Update totals
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    // Handle reservation
    if (options?.reserveInventory) {
      const reserveMinutes = options.reserveDurationMinutes ?? 30;
      cart.reservedUntil = new Date(Date.now() + reserveMinutes * 60 * 1000);
    }

    this.carts.set(cartId, cart);
    return cart;
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error(`Cart not found: ${cartId}`);

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new Error(`Item not found: ${itemId}`);

    item.quantity = quantity;
    item.totalPrice = item.unitPrice * quantity;

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error(`Cart not found: ${cartId}`);

    cart.items = cart.items.filter((i) => i.id !== itemId);
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error(`Cart not found: ${cartId}`);

    cart.items = [];
    cart.subtotal = 0;
    cart.total = 0;
    cart.itemCount = 0;

    this.carts.set(cartId, cart);
    return cart;
  }
}

// ============================================================================
// Demo Order Backend
// ============================================================================

class DemoOrderBackend implements OrderBackend {
  private orders = new Map<string, Order>();

  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    _payment?: PaymentInfo,
    _options?: { notes?: string; isGift?: boolean; giftMessage?: string }
  ): Promise<Order> {
    // Calculate shipping (simplified)
    const shipping = cart.subtotal >= 75 ? 0 : 9.99;
    const taxRate = 0.0825; // 8.25%
    const tax = (cart.subtotal + shipping) * taxRate;
    const total = cart.subtotal + shipping + tax;

    const order: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
      status: 'PENDING',
      items: cart.items,
      subtotal: cart.subtotal,
      shipping,
      tax,
      total,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress ?? shippingAddress,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    return Array.from(this.orders.values()).find((o) => o.orderNumber === orderNumber) ?? null;
  }

  async calculateTotals(
    cart: Cart,
    _shippingAddress?: Address
  ): Promise<{ subtotal: number; shipping: number; tax: number; total: number; currency: string }> {
    const shipping = cart.subtotal >= 75 ? 0 : 9.99;
    const taxRate = 0.0825;
    const tax = (cart.subtotal + shipping) * taxRate;
    const total = cart.subtotal + shipping + tax;

    return {
      subtotal: cart.subtotal,
      shipping,
      tax,
      total,
      currency: cart.currency,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a complete demo backend setup
 */
export function createDemoBackend(customProducts?: Product[]): GatewayBackends {
  return {
    products: new DemoProductBackend(customProducts),
    cart: new DemoCartBackend(),
    orders: new DemoOrderBackend(),
  };
}

/**
 * Demo backend singleton (for convenience)
 */
export const DemoBackend = {
  create: createDemoBackend,
  ProductBackend: DemoProductBackend,
  CartBackend: DemoCartBackend,
  OrderBackend: DemoOrderBackend,
};
