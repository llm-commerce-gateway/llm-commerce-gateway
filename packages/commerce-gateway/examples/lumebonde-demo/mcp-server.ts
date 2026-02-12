/**
 * Lumebondé Demo - MCP Server for Claude
 * 
 * Full-featured luxury retail assistant with:
 * - Multi-location inventory
 * - Personalized recommendations
 * - Link generation with analytics
 */

// Use direct relative imports for examples outside pnpm workspace
import { MCPServer } from '../../dist/mcp.js';
import { LumebondeBackend } from './backend/LumebondeBackend.js';

// Initialize backend
const backend = new LumebondeBackend({
  redisUrl: process.env.REDIS_URL,
  redisToken: process.env.REDIS_TOKEN,
});

// Create MCP server
const server = new MCPServer({
  backends: {
    products: backend,
    cart: backend,
    orders: backend,
  },
  tools: [
    'search_products',
    'get_product_details',
    'add_to_cart',
    'check_inventory',
    'get_recommendations',
    'create_order',
  ],
  resources: ['catalog', 'categories', 'featured_products'],
  prompts: [
    'shopping_assistant',
    'gift_finder',
    'checkout_help',
  ],
  name: 'lumebonde',
  version: '1.0.0',
  description: 'Lumebondé Luxury Retail Assistant',
});

// Start server
server.start();
console.error('Lumebondé MCP Server started!');
console.error('Store locations: NYC, LA, Miami, Online');
console.error('Products: Watches, Bags, Accessories, Eyewear');

