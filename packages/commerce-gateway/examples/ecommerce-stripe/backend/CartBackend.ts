/**
 * E-Commerce with Stripe - Cart Backend
 * 
 * Redis-based cart storage implementation.
 * Falls back to in-memory if Redis is not available.
 */

import type { CartBackend, Cart, CartItem, AddToCartInput, Product } from '@betterdata/llm-gateway/backends';

interface CartStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// Simple in-memory store (fallback)
class InMemoryCartStore implements CartStore {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttl: number = 86400): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Redis store (if REDIS_URL is set)
class RedisCartStore implements CartStore {
  private url: string;
  private token?: string;

  constructor(url: string, token?: string) {
    this.url = url;
    this.token = token;
  }

  private async command(...args: string[]): Promise<unknown> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(args),
    });
    const result = await response.json() as { result: unknown };
    return result.result;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command('GET', key);
    return result as string | null;
  }

  async set(key: string, value: string, ttl: number = 86400): Promise<void> {
    await this.command('SETEX', key, ttl.toString(), value);
  }

  async del(key: string): Promise<void> {
    await this.command('DEL', key);
  }
}

export class RedisCartBackend implements CartBackend {
  private store: CartStore;
  private prefix = 'cart:';
  private getProduct: (id: string) => Promise<Product | null>;

  constructor(options: {
    redisUrl?: string;
    redisToken?: string;
    getProduct: (id: string) => Promise<Product | null>;
  }) {
    this.getProduct = options.getProduct;

    if (options.redisUrl) {
      this.store = new RedisCartStore(options.redisUrl, options.redisToken);
      console.log('Using Redis for cart storage');
    } else {
      this.store = new InMemoryCartStore();
      console.log('Using in-memory cart storage (set REDIS_URL for persistence)');
    }
  }

  async createCart(sessionId: string): Promise<Cart> {
    const cart: Cart = {
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
    };

    await this.saveCart(cart);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const data = await this.store.get(`${this.prefix}${cartId}`);
    if (!data) return null;

    const cart = JSON.parse(data) as Cart;
    return cart;
  }

  async addToCart(cartId: string, input: AddToCartInput): Promise<{ cart: Cart; addedItem: CartItem }> {
    let cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    // Get product details
    const product = await this.getProduct(input.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Find variant if specified
    let variant = product.variants?.[0];
    if (input.variantId) {
      variant = product.variants?.find(v => v.id === input.variantId);
      if (!variant) {
        throw new Error('Variant not found');
      }
    }

    const price = variant?.price?.amount ?? product.price.amount;
    const quantity = input.quantity ?? 1;

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      i => i.productId === input.productId && i.variantId === input.variantId
    );

    let addedItem: CartItem;

    if (existingIndex >= 0) {
      // Update existing item
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].totalPrice = cart.items[existingIndex].unitPrice * cart.items[existingIndex].quantity;
      addedItem = cart.items[existingIndex];
    } else {
      // Add new item
      addedItem = {
        id: `item_${Date.now()}`,
        productId: input.productId,
        variantId: input.variantId,
        name: product.name + (variant ? ` - ${variant.name}` : ''),
        sku: variant?.sku ?? input.productId,
        quantity,
        unitPrice: price,
        totalPrice: price * quantity,
        imageUrl: product.imageUrl,
      };
      cart.items.push(addedItem);
    }

    // Recalculate totals
    cart = this.recalculateCart(cart);
    await this.saveCart(cart);

    return { cart, addedItem };
  }

  async updateCartItem(
    cartId: string,
    itemId: string,
    updates: { quantity?: number }
  ): Promise<Cart> {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    const itemIndex = cart.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) {
      throw new Error('Item not found in cart');
    }

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        // Remove item
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = updates.quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].unitPrice * updates.quantity;
      }
    }

    const updatedCart = this.recalculateCart(cart);
    await this.saveCart(updatedCart);
    return updatedCart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    return this.updateCartItem(cartId, itemId, { quantity: 0 });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.store.del(`${this.prefix}${cartId}`);
  }

  private recalculateCart(cart: Cart): Cart {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.total = cart.subtotal; // Add tax/shipping here if needed
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    return cart;
  }

  private async saveCart(cart: Cart): Promise<void> {
    await this.store.set(`${this.prefix}${cart.id}`, JSON.stringify(cart), 86400 * 7);
  }
}

