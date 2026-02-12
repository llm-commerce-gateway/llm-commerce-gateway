/**
 * Basic Cart Service (Open Source)
 * 
 * Simple cart implementation for single-store scenarios.
 * Supports in-memory storage (development) or Redis (production).
 * 
 * For multi-vendor cart with attribution tracking, use SCM's MarketplaceCartService.
 * 
 * @module catalog/basic-cart-service
 */

import type {
  CartService,
  Cart,
  CartItem,
  ProductCatalog,
} from './interfaces';

// ============================================================================
// Cart Storage Interface
// ============================================================================

/**
 * Storage backend for carts
 */
export interface CartStorage {
  get(sessionId: string): Promise<StoredCart | null>;
  set(sessionId: string, cart: StoredCart): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

interface StoredCart {
  id: string;
  sessionId: string;
  items: StoredCartItem[];
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredCartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  image?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// In-Memory Storage (Development)
// ============================================================================

/**
 * Simple in-memory cart storage
 * Suitable for development/testing
 */
export class InMemoryCartStorage implements CartStorage {
  private carts = new Map<string, StoredCart>();
  private ttlMs: number;

  constructor(options?: { ttlMs?: number }) {
    this.ttlMs = options?.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours default
  }

  async get(sessionId: string): Promise<StoredCart | null> {
    const cart = this.carts.get(sessionId);
    if (!cart) return null;

    // Check TTL
    const age = Date.now() - new Date(cart.createdAt).getTime();
    if (age > this.ttlMs) {
      this.carts.delete(sessionId);
      return null;
    }

    return cart;
  }

  async set(sessionId: string, cart: StoredCart): Promise<void> {
    this.carts.set(sessionId, cart);
  }

  async delete(sessionId: string): Promise<void> {
    this.carts.delete(sessionId);
  }

  /**
   * Clear all carts (useful for testing)
   */
  clear(): void {
    this.carts.clear();
  }

  /**
   * Get cart count (useful for debugging)
   */
  size(): number {
    return this.carts.size;
  }
}

// ============================================================================
// Redis Storage (Production)
// ============================================================================

/**
 * Redis-based cart storage
 * Recommended for production use
 */
export class RedisCartStorage implements CartStorage {
  private redis: RedisClient;
  private prefix: string;
  private ttlSeconds: number;

  constructor(options: {
    redis: RedisClient;
    prefix?: string;
    ttlSeconds?: number;
  }) {
    this.redis = options.redis;
    this.prefix = options.prefix ?? 'cart:';
    this.ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60; // 24 hours default
  }

  async get(sessionId: string): Promise<StoredCart | null> {
    const key = this.prefix + sessionId;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as StoredCart;
  }

  async set(sessionId: string, cart: StoredCart): Promise<void> {
    const key = this.prefix + sessionId;
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(cart));
  }

  async delete(sessionId: string): Promise<void> {
    const key = this.prefix + sessionId;
    await this.redis.del(key);
  }
}

// Minimal Redis client interface (compatible with ioredis, redis, etc.)
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

// ============================================================================
// Basic Cart Service
// ============================================================================

export interface BasicCartServiceConfig {
  storage: CartStorage;
  catalog: ProductCatalog;
  defaultCurrency?: string;
}

/**
 * Simple cart service for open source gateway
 * 
 * Features:
 * - Add/remove/update cart items
 * - Session-based carts
 * - Validates products exist in catalog
 * - Supports in-memory or Redis storage
 * 
 * NOT included (SCM features):
 * - Multi-vendor cart organization
 * - LLM attribution tracking
 * - Vendor rating display
 * - Platform-specific checkout links
 */
export class BasicCartService implements CartService {
  private storage: CartStorage;
  private catalog: ProductCatalog;
  private defaultCurrency: string;

  constructor(config: BasicCartServiceConfig) {
    this.storage = config.storage;
    this.catalog = config.catalog;
    this.defaultCurrency = config.defaultCurrency ?? 'USD';
  }

  /**
   * Add item to cart
   */
  async addItem(
    sessionId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ): Promise<Cart> {
    // Validate product exists
    const product = await this.catalog.getProduct(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Get or create cart
    let storedCart = await this.storage.get(sessionId);
    if (!storedCart) {
      storedCart = this.createEmptyCart(sessionId);
    }

    // Determine price (variant or main product)
    let price = product.price;
    let itemName = product.name;
    let sku = product.sku;
    let image = product.images?.[0];

    if (variantId && product.variants) {
      const variant = product.variants.find(v => v.id === variantId);
      if (variant) {
        price = variant.price;
        itemName = `${product.name} - ${variant.name}`;
        sku = variant.sku ?? product.sku;
      }
    }

    // Check if item already in cart
    const existingIndex = storedCart.items.findIndex(
      item => item.productId === productId && item.variantId === variantId
    );

    if (existingIndex >= 0) {
      // Update quantity
      const existingItem = storedCart.items[existingIndex];
      if (existingItem) {
        existingItem.quantity += quantity;
      }
    } else {
      // Add new item
      storedCart.items.push({
        id: this.generateId(),
        productId,
        variantId,
        name: itemName,
        sku,
        quantity,
        price,
        image,
      });
    }

    storedCart.updatedAt = new Date().toISOString();
    await this.storage.set(sessionId, storedCart);

    return this.toCart(storedCart);
  }

  /**
   * Remove item from cart
   */
  async removeItem(sessionId: string, itemId: string): Promise<Cart> {
    const storedCart = await this.storage.get(sessionId);
    if (!storedCart) {
      throw new Error('Cart not found');
    }

    const itemIndex = storedCart.items.findIndex(item => item.id === itemId);
    if (itemIndex < 0) {
      throw new Error('Item not found in cart');
    }

    storedCart.items.splice(itemIndex, 1);
    storedCart.updatedAt = new Date().toISOString();
    await this.storage.set(sessionId, storedCart);

    return this.toCart(storedCart);
  }

  /**
   * Update item quantity
   */
  async updateQuantity(
    sessionId: string,
    itemId: string,
    quantity: number
  ): Promise<Cart> {
    if (quantity <= 0) {
      return this.removeItem(sessionId, itemId);
    }

    const storedCart = await this.storage.get(sessionId);
    if (!storedCart) {
      throw new Error('Cart not found');
    }

    const item = storedCart.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Item not found in cart');
    }

    item.quantity = quantity;
    storedCart.updatedAt = new Date().toISOString();
    await this.storage.set(sessionId, storedCart);

    return this.toCart(storedCart);
  }

  /**
   * Get cart contents
   */
  async getCart(sessionId: string): Promise<Cart> {
    const storedCart = await this.storage.get(sessionId);
    if (!storedCart) {
      return this.toCart(this.createEmptyCart(sessionId));
    }
    return this.toCart(storedCart);
  }

  /**
   * Clear cart
   */
  async clearCart(sessionId: string): Promise<void> {
    await this.storage.delete(sessionId);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createEmptyCart(sessionId: string): StoredCart {
    const now = new Date().toISOString();
    return {
      id: this.generateId(),
      sessionId,
      items: [],
      currency: this.defaultCurrency,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toCart(stored: StoredCart): Cart {
    const items: CartItem[] = stored.items.map(item => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      image: item.image,
      metadata: item.metadata,
    }));

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      id: stored.id,
      sessionId: stored.sessionId,
      items,
      totalItems,
      totalValue,
      currency: stored.currency,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
    };
  }

  private generateId(): string {
    return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a basic cart service with in-memory storage
 */
export function createBasicCartService(
  catalog: ProductCatalog,
  options?: {
    currency?: string;
    ttlMs?: number;
  }
): BasicCartService {
  return new BasicCartService({
    catalog,
    storage: new InMemoryCartStorage({ ttlMs: options?.ttlMs }),
    defaultCurrency: options?.currency,
  });
}

/**
 * Create a basic cart service with Redis storage
 */
export function createRedisCartService(
  catalog: ProductCatalog,
  redis: RedisClient,
  options?: {
    currency?: string;
    ttlSeconds?: number;
    keyPrefix?: string;
  }
): BasicCartService {
  return new BasicCartService({
    catalog,
    storage: new RedisCartStorage({
      redis,
      ttlSeconds: options?.ttlSeconds,
      prefix: options?.keyPrefix,
    }),
    defaultCurrency: options?.currency,
  });
}
