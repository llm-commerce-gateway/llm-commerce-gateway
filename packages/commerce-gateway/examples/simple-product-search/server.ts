/**
 * Simple Product Search - MCP Server for Claude
 * 
 * A minimal "Hello World" for conversational commerce.
 * <50 lines of actual implementation code.
 * 
 * Usage:
 *   npx tsx server.ts
 * 
 * Then configure Claude desktop app with this server.
 */

// Use relative import for running as an example in the monorepo
import { MCPServer } from '../../src/mcp/index.js';
import { products } from './products.js';

// Simple in-memory backend
const backend = {
  async searchProducts(query: string) {
    const q = query.toLowerCase();
    return {
      products: products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        p.category.toLowerCase().includes(q)
      ),
      total: products.length,
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
      };
    });
  },

  async getRecommendations() {
    return products.filter(p => p.inStock).slice(0, 3);
  },
};

// Create and start MCP server
const server = new MCPServer({
  backends: { products: backend } as any,
  tools: ['search_products', 'get_product_details', 'check_inventory'],
  name: 'simple-product-search',
  version: '1.0.0',
});

server.start();
console.error('Simple Product Search MCP Server started!');

