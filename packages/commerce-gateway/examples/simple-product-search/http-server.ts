/**
 * Simple Product Search - HTTP Server
 * 
 * Test the gateway without Claude Desktop using curl or browser.
 * 
 * Usage:
 *   npx tsx http-server.ts
 * 
 * Then test with:
 *   curl http://localhost:3000/api/health
 *   curl http://localhost:3000/api/tools
 *   curl -X POST http://localhost:3000/api/tools/execute \
 *     -H "Content-Type: application/json" \
 *     -d '{"toolName":"search_products","input":{"query":"skincare"}}'
 */

import { LLMGateway } from '../../src/index.js';
import { products } from './products.js';

// Simple in-memory backend
const productBackend = {
  async searchProducts(query: string) {
    const q = query.toLowerCase();
    const results = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
    return {
      products: results,
      total: results.length,
      hasMore: false,
    };
  },

  async getProductDetails(productId: string) {
    return products.find(p => p.id === productId) ?? null;
  },

  async checkInventory(productIds: string[]) {
    return productIds.map(id => {
      const product = products.find(p => p.id === id);
      return {
        productId: id,
        available: product?.inStock ?? false,
        quantity: product?.inStock ? 10 : 0,
        locations: [],
      };
    });
  },

  async getRecommendations() {
    return products.filter(p => p.inStock).slice(0, 3).map(p => ({
      product: p,
      score: 0.9,
      reason: 'Popular item',
      strategy: 'trending' as const,
    }));
  },
};

const cartBackend = {
  carts: new Map<string, any>(),
  
  async createCart(sessionId: string) {
    const cart = {
      id: `cart-${Date.now()}`,
      sessionId,
      items: [],
      subtotal: 0,
      itemCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.carts.set(cart.id, cart);
    return cart;
  },

  async getCart(cartId: string) {
    return this.carts.get(cartId) ?? null;
  },

  async addToCart(cartId: string, item: any) {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error('Cart not found');
    cart.items.push({ id: `item-${Date.now()}`, ...item });
    cart.itemCount = cart.items.length;
    cart.subtotal = cart.items.reduce((sum: number, i: any) => sum + (i.totalPrice || 0), 0);
    return cart;
  },

  async updateCartItem() { throw new Error('Not implemented'); },
  async clearCart() { throw new Error('Not implemented'); },
};

const orderBackend = {
  async createOrder() { throw new Error('Not implemented'); },
  async getOrder() { return null; },
};

// Create gateway
const gateway = new LLMGateway({
  backends: {
    products: productBackend as any,
    cart: cartBackend as any,
    orders: orderBackend as any,
  },
  session: {
    // Use in-memory session for testing (no Redis needed)
  },
  cors: true,
  llmProviders: ['anthropic', 'openai'],
});

// Start server
const PORT = 3000;
gateway.start(PORT);

console.log(`
🚀 Simple Product Search HTTP Server running!

Test endpoints:
  curl http://localhost:${PORT}/api/health
  curl http://localhost:${PORT}/api/tools

Search products:
  curl -X POST http://localhost:${PORT}/api/tools/execute \\
    -H "Content-Type: application/json" \\
    -d '{"toolName":"search_products","input":{"query":"skincare"}}'

Get product details:
  curl -X POST http://localhost:${PORT}/api/tools/execute \\
    -H "Content-Type: application/json" \\
    -d '{"toolName":"get_product_details","input":{"productId":"prod-001"}}'
`);

