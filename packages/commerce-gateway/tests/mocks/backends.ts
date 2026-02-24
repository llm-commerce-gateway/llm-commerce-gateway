/**
 * @betterdata/commerce-gateway - Mock Backends
 * 
 * Mock implementations of backend interfaces for testing.
 * 
 * @license MIT
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
  CartItem,
  Order,
  Address,
  PaymentInfo,
  ShortLink,
} from '../../src/backends/interfaces';

// ============================================================================
// Type for internal inventory tracking
// ============================================================================

type InventoryMap = Map<string, number>;

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'Bond Repair Oil',
    slug: 'bond-repair-oil',
    description: 'Intensive hair repair oil for damaged hair',
    price: { amount: 78, currency: 'USD' },
    images: [{ url: 'https://example.com/oil.jpg', alt: 'Bond Repair Oil' }],
    category: 'haircare',
    tags: ['treatment', 'oil'],
    attributes: { size: '60ml', type: 'oil' },
    availability: { inStock: true, quantity: 150 },
  },
  {
    id: 'prod-002',
    name: 'Repair Mask',
    slug: 'repair-mask',
    description: 'Deep conditioning repair mask',
    price: { amount: 65, currency: 'USD' },
    images: [{ url: 'https://example.com/mask.jpg', alt: 'Repair Mask' }],
    category: 'haircare',
    tags: ['treatment', 'mask'],
    attributes: { size: '200ml', type: 'mask' },
    availability: { inStock: true, quantity: 200 },
  },
  {
    id: 'prod-003',
    name: 'Leave-In Spray',
    slug: 'leave-in-spray',
    description: 'Lightweight leave-in conditioning spray',
    price: { amount: 42, currency: 'USD' },
    images: [{ url: 'https://example.com/spray.jpg', alt: 'Leave-In Spray' }],
    category: 'haircare',
    tags: ['styling', 'spray'],
    attributes: { size: '150ml', type: 'spray' },
    availability: { inStock: true, quantity: 300 },
  },
  {
    id: 'prod-004',
    name: 'Scalp Serum',
    slug: 'scalp-serum',
    description: 'Nourishing scalp treatment serum',
    price: { amount: 95, currency: 'USD' },
    images: [{ url: 'https://example.com/serum.jpg', alt: 'Scalp Serum' }],
    category: 'haircare',
    tags: ['scalp', 'serum'],
    attributes: { size: '50ml', type: 'serum' },
    availability: { inStock: false, quantity: 0 },
  },
];

// ============================================================================
// Mock Product Backend
// ============================================================================

export interface MockProductBackendOptions {
  products?: Product[];
  searchDelay?: number;
  throwOnSearch?: boolean;
  throwOnDetails?: boolean;
}

export class MockProductBackend implements ProductBackend {
  private products: Product[];
  private inventory: InventoryMap = new Map();
  private searchDelay: number;
  private throwOnSearch: boolean;
  private throwOnDetails: boolean;

  constructor(options: MockProductBackendOptions = {}) {
    this.products = options.products ?? [...MOCK_PRODUCTS];
    this.searchDelay = options.searchDelay ?? 0;
    this.throwOnSearch = options.throwOnSearch ?? false;
    this.throwOnDetails = options.throwOnDetails ?? false;

    // Initialize inventory from product availability
    for (const product of this.products) {
      this.inventory.set(product.id, product.availability?.quantity ?? 0);
    }
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    if (this.throwOnSearch) {
      throw new Error('Backend search error');
    }

    if (this.searchDelay > 0) {
      await new Promise((r) => setTimeout(r, this.searchDelay));
    }

    let results = this.products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
    );

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter((p) => p.category === filters.category);
      }
      if (filters.priceMin !== undefined) {
        results = results.filter((p) => p.price.amount >= filters.priceMin!);
      }
      if (filters.priceMax !== undefined) {
        results = results.filter((p) => p.price.amount <= filters.priceMax!);
      }
      if (filters.inStock !== undefined) {
        results = results.filter((p) => p.availability?.inStock === filters.inStock);
      }
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      products: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    if (this.throwOnDetails) {
      throw new Error('Backend details error');
    }

    return this.products.find((p) => p.id === productId) ?? null;
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    const locationId = options?.locationId ?? 'loc-001';
    const locationName = locationId === 'loc-001' ? 'Main Warehouse' : 'Location';

    return productIds.map((productId) => {
      const qty = this.inventory.get(productId) ?? 0;

      return {
        productId,
        inStock: qty > 0,
        quantity: qty,
        locations: [
          {
            locationId,
            locationName,
            quantity: qty,
          },
        ],
      } satisfies InventoryStatus;
    });
  }

  async getRecommendations(
    context: {
      productIds?: string[];
      sessionId?: string;
      strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
      userPreferences?: Record<string, unknown>;
    },
    limit = 5
  ): Promise<Recommendation[]> {
    const productIds = context.productIds ?? [];
    const strategy = context.strategy ?? 'similar';

    // Simple recommendation: return other products not in the input set
    const recommendations = this.products
      .filter((p) => !productIds.includes(p.id))
      .slice(0, limit);

    return recommendations.map((product) => ({
      product,
      reason: `Recommended based on ${strategy} strategy`,
      strategy,
      confidence: 0.85,
    })) satisfies Recommendation[];
  }

  // Test helpers
  addProduct(product: Product): void {
    this.products.push(product);
    this.inventory.set(product.id, product.availability?.quantity ?? 0);
  }

  removeProduct(productId: string): void {
    this.products = this.products.filter((p) => p.id !== productId);
    this.inventory.delete(productId);
  }

  setInventory(productId: string, quantity: number): void {
    this.inventory.set(productId, quantity);
    // Also update product availability for consistency
    const product = this.products.find((p) => p.id === productId);
    if (product) {
      product.availability = {
        ...product.availability,
        inStock: quantity > 0,
        quantity,
      };
    }
  }
}

// ============================================================================
// Mock Cart Backend
// ============================================================================

export interface MockCartBackendOptions {
  carts?: Map<string, Cart>;
  throwOnCreate?: boolean;
  throwOnGet?: boolean;
  throwOnAdd?: boolean;
}

export class MockCartBackend implements CartBackend {
  private carts: Map<string, Cart>;
  private sessionToCart: Map<string, string> = new Map();
  private throwOnCreate: boolean;
  private throwOnGet: boolean;
  private throwOnAdd: boolean;
  private nextCartId = 1;

  constructor(options: MockCartBackendOptions = {}) {
    this.carts = options.carts ?? new Map();
    this.throwOnCreate = options.throwOnCreate ?? false;
    this.throwOnGet = options.throwOnGet ?? false;
    this.throwOnAdd = options.throwOnAdd ?? false;
  }

  async createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart> {
    if (this.throwOnCreate) {
      throw new Error('Backend create cart error');
    }

    const cart: Cart = {
      id: `cart-${this.nextCartId++}`,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
      metadata,
    };

    this.carts.set(cart.id, cart);
    this.sessionToCart.set(sessionId, cart.id);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    if (this.throwOnGet) {
      throw new Error('Backend get cart error');
    }

    return this.carts.get(cartId) ?? null;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const existingCartId = this.sessionToCart.get(sessionId);
    if (existingCartId) {
      const existingCart = this.carts.get(existingCartId);
      if (existingCart) {
        return existingCart;
      }
    }
    return this.createCart(sessionId);
  }

  async addToCart(
    cartId: string,
    item: {
      productId: string;
      variantId?: string;
      quantity: number;
    },
    options?: {
      reserveInventory?: boolean;
      reserveDurationMinutes?: number;
    }
  ): Promise<Cart> {
    if (this.throwOnAdd) {
      throw new Error('Backend add to cart error');
    }

    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    const newItem: CartItem = {
      id: `item-${Date.now()}`,
      productId: item.productId,
      variantId: item.variantId,
      name: `Product ${item.productId}`,
      quantity: item.quantity,
      unitPrice: 0,
      totalPrice: 0,
    };

    cart.items.push(newItem);
    this.recalculateCart(cart);

    return cart;
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    const itemIndex = cart.items.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Cart item not found: ${itemId}`);
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const item = cart.items[itemIndex];
      item.quantity = quantity;
      item.totalPrice = item.unitPrice * quantity;
    }

    this.recalculateCart(cart);

    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    cart.items = cart.items.filter((i) => i.id !== itemId && i.productId !== itemId);
    this.recalculateCart(cart);

    return cart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    cart.items = [];
    this.recalculateCart(cart);

    return cart;
  }

  private recalculateCart(cart: Cart): void {
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal; // Could add tax/shipping here
  }

  // Test helpers
  getCartCount(): number {
    return this.carts.size;
  }

  clearAllCarts(): void {
    this.carts.clear();
    this.sessionToCart.clear();
  }
}

// ============================================================================
// Mock Order Backend
// ============================================================================

export interface MockOrderBackendOptions {
  orders?: Map<string, Order>;
  throwOnCreate?: boolean;
  throwOnGet?: boolean;
}

export class MockOrderBackend implements OrderBackend {
  private orders: Map<string, Order>;
  private throwOnCreate: boolean;
  private throwOnGet: boolean;
  private nextOrderNumber = 1000;

  constructor(options: MockOrderBackendOptions = {}) {
    this.orders = options.orders ?? new Map();
    this.throwOnCreate = options.throwOnCreate ?? false;
    this.throwOnGet = options.throwOnGet ?? false;
  }

  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo,
    options?: {
      notes?: string;
      isGift?: boolean;
      giftMessage?: string;
    }
  ): Promise<Order> {
    if (this.throwOnCreate) {
      throw new Error('Backend create order error');
    }

    const order: Order = {
      id: `order-${Date.now()}`,
      orderNumber: `ORD-${this.nextOrderNumber++}`,
      status: 'pending',
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: cart.subtotal,
      tax: cart.subtotal * 0.08,
      shipping: 0,
      total: cart.subtotal * 1.08,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress ?? shippingAddress,
      createdAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (this.throwOnGet) {
      throw new Error('Backend get order error');
    }

    return this.orders.get(orderId) ?? null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    const orders = Array.from(this.orders.values());
    return orders.find((o) => o.orderNumber === orderNumber) ?? null;
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
    const subtotal = cart.subtotal;
    const shipping = shippingAddress ? 10 : 0;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      total,
      currency: cart.currency,
    };
  }

  // Test helpers
  getOrderCount(): number {
    return this.orders.size;
  }

  clearAllOrders(): void {
    this.orders.clear();
  }
}

// ============================================================================
// Mock Link Generator
// ============================================================================

export interface MockLinkGeneratorOptions {
  domain?: string;
  throwOnCreate?: boolean;
}

export class MockLinkGenerator implements LinkGenerator {
  private domain: string;
  private throwOnCreate: boolean;
  private links: Map<string, ShortLink> = new Map();

  constructor(options: MockLinkGeneratorOptions = {}) {
    this.domain = options.domain ?? 'https://test.link';
    this.throwOnCreate = options.throwOnCreate ?? false;
  }

  async createProductLink(
    product: Product,
    context?: {
      sessionId?: string;
      campaign?: string;
      source?: string;
    }
  ): Promise<ShortLink> {
    if (this.throwOnCreate) {
      throw new Error('Link generation failed');
    }

    const link: ShortLink = {
      id: `link-${Date.now()}`,
      shortUrl: `${this.domain}/p/${product.id}`,
      originalUrl: `https://shop.example.com/products/${product.id}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: {
        productId: product.id,
        sessionId: context?.sessionId,
        campaign: context?.campaign,
        source: context?.source,
      },
    };

    this.links.set(link.id, link);
    return link;
  }

  async createCartLink(cart: Cart, expiryHours?: number): Promise<ShortLink> {
    if (this.throwOnCreate) {
      throw new Error('Link generation failed');
    }

    const hours = expiryHours ?? 24;
    const link: ShortLink = {
      id: `link-${Date.now()}`,
      shortUrl: `${this.domain}/c/${cart.id}`,
      originalUrl: `https://shop.example.com/cart/${cart.id}`,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      metadata: {
        cartId: cart.id,
        itemCount: cart.itemCount,
      },
    };

    this.links.set(link.id, link);
    return link;
  }

  async createLink(
    url: string,
    metadata?: Record<string, unknown>
  ): Promise<ShortLink> {
    if (this.throwOnCreate) {
      throw new Error('Link generation failed');
    }

    const id = `link-${Date.now()}`;
    const link: ShortLink = {
      id,
      shortUrl: `${this.domain}/l/${id}`,
      originalUrl: url,
      metadata,
    };

    this.links.set(link.id, link);
    return link;
  }

  async trackConversion(
    linkId: string,
    event: {
      type: string;
      value?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Mock implementation - just log or no-op
    const link = this.links.get(linkId);
    if (link) {
      link.metadata = {
        ...link.metadata,
        lastConversion: {
          type: event.type,
          value: event.value,
          timestamp: new Date(),
        },
      };
    }
  }

  // Test helpers
  getLinkCount(): number {
    return this.links.size;
  }

  clearAllLinks(): void {
    this.links.clear();
  }
}
