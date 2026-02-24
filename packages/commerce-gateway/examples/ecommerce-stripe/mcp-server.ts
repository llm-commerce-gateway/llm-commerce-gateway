/**
 * E-Commerce with Stripe - MCP Server for Claude
 * 
 * Full-featured conversational commerce with:
 * - JSON product catalog
 * - Redis cart storage
 * - Stripe checkout
 */

import { MCPServer } from '@betterdata/commerce-gateway/mcp';
import { JsonProductBackend } from './backend/ProductBackend.js';
import { RedisCartBackend } from './backend/CartBackend.js';
import { StripeOrderBackend } from './backend/OrderBackend.js';

// Initialize backends
const productBackend = new JsonProductBackend();

const cartBackend = new RedisCartBackend({
  redisUrl: process.env.REDIS_URL,
  redisToken: process.env.REDIS_TOKEN,
  getProduct: (id) => productBackend.getProductDetails(id),
});

const orderBackend = new StripeOrderBackend({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  successUrl: process.env.SUCCESS_URL ?? 'http://localhost:3000/success',
  cancelUrl: process.env.CANCEL_URL ?? 'http://localhost:3000/cancel',
});

// Create MCP server
const server = new MCPServer({
  backends: {
    products: productBackend,
    cart: cartBackend,
    orders: orderBackend,
  },
  tools: [
    'search_products',
    'get_product_details',
    'add_to_cart',
    'check_inventory',
    'get_recommendations',
    'create_order',
  ],
  resources: ['catalog'],
  prompts: ['shopping_assistant', 'checkout_help'],
  name: 'ecommerce-stripe',
  version: '1.0.0',
});

// Start server
server.start();
console.error('E-Commerce MCP Server started with Stripe integration!');

