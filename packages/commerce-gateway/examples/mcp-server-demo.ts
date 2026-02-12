#!/usr/bin/env node
/**
 * MCP Server Demo
 * 
 * A minimal MCP server example with mock backends.
 * Use this as a starting point for your own MCP server.
 * 
 * Build: npx tsup examples/mcp-server-demo.ts --format esm --outDir dist/examples
 * Run: node dist/examples/mcp-server-demo.js
 * 
 * Then add to Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "demo-shop": {
 *       "command": "node",
 *       "args": ["/path/to/dist/examples/mcp-server-demo.js"]
 *     }
 *   }
 * }
 * 
 * @license MIT
 */

import { MCPServer } from '../src/mcp/index.js';
import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
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
} from '../src/backends/interfaces.js';

// ============================================================================
// Mock Product Data
// ============================================================================

const PRODUCTS: Product[] = [
  {
    id: 'prod_001',
    name: 'Hydrating Face Serum',
    slug: 'hydrating-face-serum',
    description: 'A lightweight, fast-absorbing serum that delivers intense hydration with hyaluronic acid and vitamin E.',
    price: { amount: 45.00, currency: 'USD' },
    images: [{ url: 'https://example.com/serum.jpg', alt: 'Hydrating Face Serum' }],
    category: 'Skincare',
    tags: ['hydrating', 'serum', 'anti-aging', 'vitamin-e'],
    availability: { inStock: true, quantity: 150 },
  },
  {
    id: 'prod_002',
    name: 'Repairing Hair Mask',
    slug: 'repairing-hair-mask',
    description: 'Deep conditioning treatment that repairs damaged hair and restores shine with argan oil and keratin.',
    price: { amount: 32.00, currency: 'USD' },
    images: [{ url: 'https://example.com/mask.jpg', alt: 'Repairing Hair Mask' }],
    category: 'Hair Care',
    tags: ['repair', 'conditioning', 'damaged-hair', 'argan-oil'],
    availability: { inStock: true, quantity: 85 },
  },
  {
    id: 'prod_003',
    name: 'Volumizing Shampoo',
    slug: 'volumizing-shampoo',
    description: 'Sulfate-free shampoo that adds body and lift to fine, flat hair without weighing it down.',
    price: { amount: 28.00, currency: 'USD' },
    images: [{ url: 'https://example.com/shampoo.jpg', alt: 'Volumizing Shampoo' }],
    category: 'Hair Care',
    tags: ['volume', 'shampoo', 'fine-hair', 'sulfate-free'],
    availability: { inStock: true, quantity: 200 },
  },
  {
    id: 'prod_004',
    name: 'Nourishing Body Lotion',
    slug: 'nourishing-body-lotion',
    description: 'Rich, non-greasy body lotion with shea butter and coconut oil for 24-hour moisture.',
    price: { amount: 24.00, currency: 'USD', compareAtPrice: 30.00 },
    images: [{ url: 'https://example.com/lotion.jpg', alt: 'Nourishing Body Lotion' }],
    category: 'Body Care',
    tags: ['moisturizing', 'body-lotion', 'shea-butter', 'coconut-oil'],
    availability: { inStock: true, quantity: 120 },
  },
  {
    id: 'prod_005',
    name: 'Exfoliating Face Scrub',
    slug: 'exfoliating-face-scrub',
    description: 'Gentle daily exfoliator with natural jojoba beads that removes dead skin cells and unclogs pores.',
    price: { amount: 22.00, currency: 'USD' },
    images: [{ url: 'https://example.com/scrub.jpg', alt: 'Exfoliating Face Scrub' }],
    category: 'Skincare',
    tags: ['exfoliating', 'scrub', 'pore-care', 'jojoba'],
    availability: { inStock: false, quantity: 0 },
  },
  {
    id: 'prod_006',
    name: 'Anti-Frizz Hair Oil',
    slug: 'anti-frizz-hair-oil',
    description: 'Lightweight finishing oil that tames frizz, adds shine, and protects against heat damage.',
    price: { amount: 38.00, currency: 'USD' },
    images: [{ url: 'https://example.com/oil.jpg', alt: 'Anti-Frizz Hair Oil' }],
    category: 'Hair Care',
    tags: ['anti-frizz', 'oil', 'heat-protection', 'shine'],
    availability: { inStock: true, quantity: 75 },
  },
];

// ============================================================================
// Mock Backends
// ============================================================================

class MockProductBackend implements ProductBackend {
  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const q = query.toLowerCase();
    
    let results = PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q)) ||
      p.category?.toLowerCase().includes(q)
    );

    if (filters?.category) {
      results = results.filter(p => p.category?.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters?.priceMin !== undefined) {
      results = results.filter(p => p.price.amount >= filters.priceMin!);
    }
    if (filters?.priceMax !== undefined) {
      results = results.filter(p => p.price.amount <= filters.priceMax!);
    }
    if (filters?.inStock !== undefined) {
      results = results.filter(p => p.availability?.inStock === filters.inStock);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 10;

    return {
      products: results.slice(offset, offset + limit),
      total: results.length,
      hasMore: offset + limit < results.length,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    return PRODUCTS.find(p => p.id === productId || p.slug === productId) ?? null;
  }

  async checkInventory(productIds: string[]): Promise<InventoryStatus[]> {
    return productIds.map(id => {
      const product = PRODUCTS.find(p => p.id === id);
      return {
        productId: id,
        inStock: product?.availability?.inStock ?? false,
        quantity: product?.availability?.quantity ?? 0,
      };
    });
  }

  async getRecommendations(
    context: { productIds?: string[]; strategy?: string },
    limit?: number
  ): Promise<Recommendation[]> {
    const shuffled = [...PRODUCTS]
      .filter(p => !context.productIds?.includes(p.id))
      .sort(() => Math.random() - 0.5);
    
    return shuffled.slice(0, limit ?? 3).map(p => ({
      product: p,
      confidence: Math.random() * 0.3 + 0.7,
      reason: context.strategy === 'complementary' 
        ? 'Works great together' 
        : 'Customers also viewed',
      strategy: context.strategy ?? 'similar',
    }));
  }
}

// In-memory cart storage
const carts = new Map<string, Cart>();

class MockCartBackend implements CartBackend {
  async createCart(sessionId: string): Promise<Cart> {
    const cart: Cart = {
      id: `cart_${Date.now()}`,
      sessionId,
      items: [],
      subtotal: 0,
      currency: 'USD',
      itemCount: 0,
    };
    carts.set(cart.id, cart);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    return carts.get(cartId) ?? null;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const existing = Array.from(carts.values()).find(c => c.sessionId === sessionId);
    if (existing) return existing;
    return this.createCart(sessionId);
  }

  async addToCart(
    cartId: string,
    item: { productId: string; variantId?: string; quantity: number }
  ): Promise<Cart> {
    const cart = carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    const product = PRODUCTS.find(p => p.id === item.productId);
    if (!product) throw new Error('Product not found');

    const existing = cart.items.find(i => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalPrice = existing.quantity * existing.unitPrice;
    } else {
      cart.items.push({
        id: `item_${Date.now()}`,
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price.amount,
        totalPrice: product.price.amount * item.quantity,
        imageUrl: product.images?.[0]?.url,
      });
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    
    return cart;
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    const cart = carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    const item = cart.items.find(i => i.id === itemId);
    if (item) {
      item.quantity = quantity;
      item.totalPrice = item.quantity * item.unitPrice;
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    
    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const cart = carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    cart.items = cart.items.filter(i => i.id !== itemId);
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    
    return cart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    cart.items = [];
    cart.subtotal = 0;
    cart.itemCount = 0;
    
    return cart;
  }
}

class MockOrderBackend implements OrderBackend {
  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo
  ): Promise<Order> {
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const shipping = cart.subtotal >= 75 ? 0 : 9.99;
    const tax = cart.subtotal * 0.0825;
    
    return {
      id: `order_${Date.now()}`,
      orderNumber,
      status: 'CONFIRMED',
      items: cart.items,
      subtotal: cart.subtotal,
      shipping,
      tax,
      total: cart.subtotal + shipping + tax,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress ?? shippingAddress,
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return null;
  }
}

// ============================================================================
// Start MCP Server
// ============================================================================

const server = new MCPServer({
  backends: {
    products: new MockProductBackend(),
    cart: new MockCartBackend(),
    orders: new MockOrderBackend(),
  },
  name: 'beauty-shop',
  version: '1.0.0',
  enableResources: true,
  enablePrompts: true,
  debug: process.env.DEBUG === 'true',
});

// Start stdio transport
server.start();

