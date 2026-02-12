/**
 * Lumebondé Demo - Backend Implementation
 * 
 * Full-featured luxury retail backend with:
 * - Multi-location inventory
 * - Personalized recommendations
 * - Store pickup options
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Use direct relative imports for examples outside pnpm workspace
import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  Product,
  ProductFilters,
  ProductSearchResult,
  Cart,
  CartItem,
  AddToCartInput,
  Order,
  ShippingAddress,
  InventoryStatus,
  Recommendation,
} from '../../../src/backends/interfaces.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Types for stored data
interface StoredProduct {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  category: string;
  tags: string[];
  images: string[];
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    inventory: Record<string, number>;
  }>;
  attributes: Record<string, string>;
  rating: number;
  reviewCount: number;
}

interface StoredLocation {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  timezone: string;
  isPickupEnabled: boolean;
  isShipFromEnabled: boolean;
}

interface InventoryData {
  locations: StoredLocation[];
  shippingOptions: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    freeThreshold: number | null;
  }>;
}

interface CartStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// In-memory store
class InMemoryStore implements CartStore {
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

export interface LumebondeConfig {
  redisUrl?: string;
  redisToken?: string;
}

export class LumebondeBackend implements ProductBackend, CartBackend, OrderBackend {
  private products: StoredProduct[];
  private inventoryData: InventoryData;
  private cartStore: CartStore;
  private orders: Map<string, Order> = new Map();

  constructor(config: LumebondeConfig = {}) {
    // Load data
    const productsPath = join(__dirname, '../data/products.json');
    const inventoryPath = join(__dirname, '../data/inventory.json');
    
    this.products = JSON.parse(readFileSync(productsPath, 'utf-8'));
    this.inventoryData = JSON.parse(readFileSync(inventoryPath, 'utf-8'));
    
    // Use in-memory store (can be replaced with Redis)
    this.cartStore = new InMemoryStore();
  }

  // ============================================================================
  // Product Backend
  // ============================================================================

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    let results = [...this.products];
    const q = query.toLowerCase();

    // Text search
    if (query) {
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters?.category) {
      results = results.filter(p => p.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters?.priceMin !== undefined) {
      results = results.filter(p => p.price >= filters.priceMin!);
    }
    if (filters?.priceMax !== undefined) {
      results = results.filter(p => p.price <= filters.priceMax!);
    }
    if (filters?.inStock !== undefined) {
      results = results.filter(p => {
        const totalStock = this.getTotalStock(p);
        return filters.inStock ? totalStock > 0 : totalStock === 0;
      });
    }
    if (filters?.tags?.length) {
      results = results.filter(p =>
        filters.tags!.some(tag => p.tags.includes(tag.toLowerCase()))
      );
    }

    const total = results.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 10;

    results = results.slice(offset, offset + limit);

    return {
      products: results.map(p => this.mapProduct(p)),
      total,
      hasMore: offset + results.length < total,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    const product = this.products.find(p => p.id === productId || p.slug === productId);
    return product ? this.mapProduct(product) : null;
  }

  async checkInventory(productIds: string[]): Promise<InventoryStatus[]> {
    return productIds.map(id => {
      const product = this.products.find(p => p.id === id);
      if (!product) {
        return { productId: id, available: false, quantity: 0 };
      }

      // Get inventory across all locations
      const locations = this.inventoryData.locations.map(loc => {
        const qty = product.variants.reduce((sum, v) => sum + (v.inventory[loc.id] ?? 0), 0);
        return {
          locationId: loc.id,
          locationName: loc.name,
          quantity: qty,
          leadTimeDays: loc.id === 'online' ? 2 : 0,
        };
      }).filter(l => l.quantity > 0);

      const totalQty = locations.reduce((sum, l) => sum + l.quantity, 0);

      return {
        productId: id,
        available: totalQty > 0,
        quantity: totalQty,
        locations,
      };
    });
  }

  async getRecommendations(context: {
    productIds?: string[];
    userId?: string;
    strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
  }): Promise<Recommendation[]> {
    const strategy = context.strategy ?? 'similar';
    let recommendations: StoredProduct[] = [];
    let reason = '';

    if (context.productIds?.length) {
      const sourceProducts = this.products.filter(p => context.productIds!.includes(p.id));
      const categories = [...new Set(sourceProducts.map(p => p.category))];
      const tags = [...new Set(sourceProducts.flatMap(p => p.tags))];

      if (strategy === 'similar') {
        recommendations = this.products
          .filter(p => !context.productIds!.includes(p.id))
          .filter(p => categories.includes(p.category))
          .slice(0, 5);
        reason = 'Similar items you might like';
      } else if (strategy === 'complementary') {
        // Find complementary categories
        const complementMap: Record<string, string[]> = {
          'Watches': ['Accessories', 'Bags'],
          'Bags': ['Accessories', 'Eyewear'],
          'Accessories': ['Bags', 'Eyewear'],
          'Eyewear': ['Accessories'],
        };
        const compCategories = categories.flatMap(c => complementMap[c] ?? []);
        recommendations = this.products
          .filter(p => compCategories.includes(p.category))
          .slice(0, 5);
        reason = 'Completes your look';
      } else if (strategy === 'bundle') {
        // Mix similar and complementary
        const similar = this.products
          .filter(p => !context.productIds!.includes(p.id))
          .filter(p => tags.some(t => p.tags.includes(t)))
          .slice(0, 2);
        const complementMap: Record<string, string[]> = {
          'Watches': ['Accessories'],
          'Bags': ['Accessories'],
          'Accessories': ['Bags'],
          'Eyewear': ['Accessories'],
        };
        const compCategories = categories.flatMap(c => complementMap[c] ?? []);
        const complementary = this.products
          .filter(p => compCategories.includes(p.category))
          .slice(0, 3);
        recommendations = [...similar, ...complementary];
        reason = 'Bundle and save';
      }
    }

    if (recommendations.length === 0 || strategy === 'trending') {
      // Return top-rated products
      recommendations = [...this.products]
        .sort((a, b) => (b.rating * b.reviewCount) - (a.rating * a.reviewCount))
        .slice(0, 5);
      reason = 'Best sellers';
    }

    return recommendations.map((p, index) => ({
      product: this.mapProduct(p),
      score: 1 - (index * 0.15),
      reason,
      strategy,
    }));
  }

  // ============================================================================
  // Cart Backend
  // ============================================================================

  async createCart(sessionId: string): Promise<Cart> {
    const cart: Cart = {
      id: `lb_cart_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
    };

    await this.cartStore.set(cart.id, JSON.stringify(cart));
    // Also store by sessionId for getOrCreateCart
    await this.cartStore.set(`session:${sessionId}`, cart.id);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const data = await this.cartStore.get(cartId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get or create cart for a session (required by CartBackend interface)
   */
  async getOrCreateCart(sessionId: string): Promise<Cart> {
    // Check if we have an existing cart for this session
    const existingCartId = await this.cartStore.get(`session:${sessionId}`);
    if (existingCartId) {
      const cart = await this.getCart(existingCartId);
      if (cart) return cart;
    }
    // Create a new cart
    return this.createCart(sessionId);
  }

  async addToCart(cartId: string, input: AddToCartInput): Promise<{ cart: Cart; addedItem: CartItem }> {
    let cart = await this.getCart(cartId);
    if (!cart) throw new Error('Cart not found');

    const product = this.products.find(p => p.id === input.productId);
    if (!product) throw new Error('Product not found');

    const variant = input.variantId
      ? product.variants.find(v => v.id === input.variantId)
      : product.variants[0];
    if (!variant) throw new Error('Variant not found');

    const quantity = input.quantity ?? 1;
    const price = variant.price;

    // Check inventory
    const totalStock = Object.values(variant.inventory).reduce((sum, qty) => sum + qty, 0);
    if (totalStock < quantity) {
      throw new Error(`Only ${totalStock} items available`);
    }

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      i => i.productId === input.productId && i.variantId === input.variantId
    );

    let addedItem: CartItem;

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].totalPrice = cart.items[existingIndex].unitPrice * cart.items[existingIndex].quantity;
      addedItem = cart.items[existingIndex];
    } else {
      addedItem = {
        id: `item_${Date.now()}`,
        productId: input.productId,
        variantId: variant.id,
        name: `${product.name} - ${variant.name}`,
        sku: variant.sku,
        quantity,
        unitPrice: price,
        totalPrice: price * quantity,
        imageUrl: product.images[0],
      };
      cart.items.push(addedItem);
    }

    cart = this.recalculateCart(cart);
    await this.cartStore.set(cartId, JSON.stringify(cart));

    return { cart, addedItem };
  }

  async updateCartItem(cartId: string, itemId: string, updates: { quantity?: number }): Promise<Cart> {
    let cart = await this.getCart(cartId);
    if (!cart) throw new Error('Cart not found');

    const itemIndex = cart.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) throw new Error('Item not found');

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = updates.quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].unitPrice * updates.quantity;
      }
    }

    cart = this.recalculateCart(cart);
    await this.cartStore.set(cartId, JSON.stringify(cart));
    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    return this.updateCartItem(cartId, itemId, { quantity: 0 });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.cartStore.del(cartId);
  }

  // ============================================================================
  // Order Backend
  // ============================================================================

  async createOrder(cart: Cart, shippingAddress: ShippingAddress): Promise<Order> {
    const orderId = `LMBD-${Date.now().toString(36).toUpperCase()}`;
    
    // Calculate shipping
    const shippingOption = this.inventoryData.shippingOptions.find(o => o.id === 'standard')!;
    const shippingCost = cart.subtotal >= (shippingOption.freeThreshold ?? 0) ? 0 : shippingOption.price;
    
    // Calculate tax (simplified - 8.875% NY tax)
    const taxRate = shippingAddress.state === 'NY' ? 0.08875 : 0.0725;
    const tax = cart.subtotal * taxRate;

    const order: Order = {
      id: orderId,
      status: 'pending',
      items: cart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: cart.subtotal,
      tax: Math.round(tax * 100) / 100,
      shipping: shippingCost,
      total: Math.round((cart.subtotal + tax + shippingCost) * 100) / 100,
      currency: 'USD',
      shippingAddress,
      paymentStatus: 'pending',
      createdAt: new Date(),
    };

    this.orders.set(orderId, order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) ?? null;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');
    
    order.status = status;
    order.updatedAt = new Date();
    this.orders.set(orderId, order);
    return order;
  }

  // ============================================================================
  // Additional Methods
  // ============================================================================

  /**
   * Get available store locations for pickup
   */
  getStoreLocations(): StoredLocation[] {
    return this.inventoryData.locations.filter(l => l.isPickupEnabled);
  }

  /**
   * Get inventory at a specific location
   */
  async getLocationInventory(productId: string, locationId: string): Promise<number> {
    const product = this.products.find(p => p.id === productId);
    if (!product) return 0;
    
    return product.variants.reduce((sum, v) => sum + (v.inventory[locationId] ?? 0), 0);
  }

  /**
   * Get shipping options for a cart
   */
  getShippingOptions(cartSubtotal: number): typeof this.inventoryData.shippingOptions {
    return this.inventoryData.shippingOptions.map(option => ({
      ...option,
      price: option.freeThreshold && cartSubtotal >= option.freeThreshold ? 0 : option.price,
    }));
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getTotalStock(product: StoredProduct): number {
    return product.variants.reduce((sum, v) => 
      sum + Object.values(v.inventory).reduce((s, qty) => s + qty, 0), 0
    );
  }

  private recalculateCart(cart: Cart): Cart {
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    return cart;
  }

  private mapProduct(p: StoredProduct): Product {
    const totalStock = this.getTotalStock(p);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      slug: p.slug,
      price: {
        amount: p.price,
        currency: p.currency,
        compareAtPrice: p.compareAtPrice,
      },
      imageUrl: p.images[0],
      images: p.images,
      category: p.category,
      tags: p.tags,
      variants: p.variants.map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: { amount: v.price, currency: p.currency },
        available: Object.values(v.inventory).reduce((s, q) => s + q, 0) > 0,
        attributes: {},
      })),
      attributes: p.attributes,
      inStock: totalStock > 0,
      rating: p.rating,
      reviewCount: p.reviewCount,
    };
  }
}

