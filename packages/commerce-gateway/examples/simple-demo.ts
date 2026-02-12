/**
 * Simple Demo - @betterdata/llm-gateway
 * 
 * A minimal example showing how to set up the LLM Gateway with mock backends.
 * Perfect for testing and development.
 * 
 * Run with: npx ts-node examples/simple-demo.ts
 */

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
  Order,
  Address,
  PaymentInfo,
} from '../src/backends/interfaces.js';
import { LLMGateway } from '../src/core/Gateway.js';

// ============================================================================
// Mock Product Data
// ============================================================================

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod_001',
    name: 'Ultra Comfort Running Shoes',
    slug: 'ultra-comfort-running-shoes',
    description: 'Lightweight running shoes with advanced cushioning technology.',
    price: { amount: 89.99, currency: 'USD' },
    images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', alt: 'Running Shoes' }],
    availability: { inStock: true, quantity: 50 },
    category: 'Running',
    tags: ['running', 'shoes', 'athletic', 'comfort'],
  },
  {
    id: 'prod_002',
    name: 'Pro Tennis Racket',
    slug: 'pro-tennis-racket',
    description: 'Professional-grade tennis racket with carbon fiber frame.',
    price: { amount: 149.99, currency: 'USD' },
    images: [{ url: 'https://images.unsplash.com/photo-1617083277624-24c25f8c6c27', alt: 'Tennis Racket' }],
    availability: { inStock: true, quantity: 25 },
    category: 'Tennis',
    tags: ['tennis', 'racket', 'sports', 'professional'],
  },
  {
    id: 'prod_003',
    name: 'Yoga Mat Premium',
    slug: 'yoga-mat-premium',
    description: 'Non-slip yoga mat made from eco-friendly materials.',
    price: { amount: 45.00, currency: 'USD' },
    images: [{ url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f', alt: 'Yoga Mat' }],
    availability: { inStock: true, quantity: 100 },
    category: 'Yoga',
    tags: ['yoga', 'mat', 'fitness', 'eco-friendly'],
  },
  {
    id: 'prod_004',
    name: 'Wireless Fitness Earbuds',
    slug: 'wireless-fitness-earbuds',
    description: 'Sweat-resistant earbuds with 12-hour battery life.',
    price: { amount: 79.99, currency: 'USD' },
    images: [{ url: 'https://images.unsplash.com/photo-1590658165737-15a047b7c0b0', alt: 'Wireless Earbuds' }],
    availability: { inStock: false, quantity: 0 },
    category: 'Electronics',
    tags: ['earbuds', 'wireless', 'fitness', 'audio'],
  },
  {
    id: 'prod_005',
    name: 'Performance Protein Powder',
    slug: 'performance-protein-powder',
    description: 'Whey protein isolate with 25g protein per serving.',
    price: { amount: 54.99, currency: 'USD' },
    images: [{ url: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d', alt: 'Protein Powder' }],
    availability: { inStock: true, quantity: 75 },
    category: 'Nutrition',
    tags: ['protein', 'nutrition', 'fitness', 'supplements'],
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
    const queryLower = query.toLowerCase();
    
    let results = MOCK_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(queryLower) ||
      p.description?.toLowerCase().includes(queryLower) ||
      p.tags?.some(t => t.toLowerCase().includes(queryLower)) ||
      p.category?.toLowerCase().includes(queryLower)
    );

    // Apply filters
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

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 20;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      products: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    return MOCK_PRODUCTS.find(p => p.id === productId) ?? null;
  }

  async checkInventory(productIds: string[], options?: { locationId?: string }): Promise<InventoryStatus[]> {
    return productIds.map(id => {
      const product = MOCK_PRODUCTS.find(p => p.id === id);
      return {
        productId: id,
        inStock: product?.availability?.inStock ?? false,
        quantity: product?.availability?.quantity ?? 0,
      };
    });
  }

  async getRecommendations(context: {
    productIds?: string[];
    sessionId?: string;
    strategy?: 'similar' | 'complementary' | 'trending' | 'personalized';
    userPreferences?: Record<string, unknown>;
  }, limit?: number): Promise<Recommendation[]> {
    // Return random products as recommendations
    const shuffled = [...MOCK_PRODUCTS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit ?? 3).map(p => ({
      product: p,
      confidence: Math.random(),
      reason: 'Frequently bought together',
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
    item: { productId: string; variantId?: string; quantity: number },
    options?: { reserveInventory?: boolean; reserveDurationMinutes?: number }
  ): Promise<Cart> {
    const cart = carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
    if (!product) throw new Error('Product not found');

    const existingItem = cart.items.find(i => i.productId === item.productId);
    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
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
      status: 'PENDING',
      items: cart.items,
      subtotal: cart.subtotal,
      shipping,
      tax,
      total: cart.subtotal + shipping + tax,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress ?? shippingAddress,
      createdAt: new Date(),
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    // In a real implementation, this would fetch from database
    return null;
  }
}

// ============================================================================
// Main - Start the Gateway
// ============================================================================

async function main() {
  console.log('🛍️  Starting LLM Gateway Demo...\n');

  const gateway = new LLMGateway({
    backends: {
      products: new MockProductBackend(),
      cart: new MockCartBackend(),
      orders: new MockOrderBackend(),
    },
    session: {
      redis: {
        // For demo, we'll use a mock or require real Redis
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    },
    auth: {
      apiKeys: ['demo-api-key-12345'],
      jwtSecret: 'demo-jwt-secret-should-be-32-chars-min!',
    },
    rateLimits: {
      windowMs: 60000,
      maxRequests: 100,
    },
    llmProviders: ['anthropic', 'openai', 'grok', 'google'],
    port: 3001,
  });

  gateway.start();
  
  console.log(`
✅ Gateway is running!

📡 Endpoints:
   - Swagger UI:     http://localhost:3001/swagger-ui
   - OpenAPI Spec:   http://localhost:3001/openapi
   - List Tools:     http://localhost:3001/tools

🔧 Tool Execution:
   - MCP (Claude):   POST http://localhost:3001/mcp/tools/call
   - OpenAI:         POST http://localhost:3001/openai/functions
   - Google:         POST http://localhost:3001/google/functions
   - Grok:           POST http://localhost:3001/grok/functions

🔑 API Key: demo-api-key-12345

📝 Example - Search Products:
   curl -X POST http://localhost:3001/openai/functions \\
     -H "Content-Type: application/json" \\
     -H "Authorization: Bearer demo-api-key-12345" \\
     -d '{"toolName":"search_products","arguments":{"query":"running shoes"}}'

📝 Example - Get Tools for OpenAI:
   curl http://localhost:3001/llm/openai/tools \\
     -H "Authorization: Bearer demo-api-key-12345"
`);
}

main().catch(console.error);

