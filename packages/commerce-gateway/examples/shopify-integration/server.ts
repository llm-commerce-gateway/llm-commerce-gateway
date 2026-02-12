/**
 * Shopify Integration - Dual Server (MCP + HTTP)
 * 
 * Provides both Claude MCP and OpenAI HTTP endpoints
 * connected to a real Shopify store.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MCPServer } from '@betterdata/llm-gateway/mcp';
import { OpenAIAdapter } from '@betterdata/llm-gateway/openai';
import { ShopifyBackend } from './backend/ShopifyBackend.js';

// Configuration
const config = {
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN!,
  storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  adminAccessToken: process.env.SHOPIFY_ADMIN_TOKEN,
  apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-01',
};

// Validate configuration
if (!config.storeDomain || !config.storefrontAccessToken) {
  console.error('Missing required environment variables:');
  console.error('- SHOPIFY_STORE_DOMAIN');
  console.error('- SHOPIFY_STOREFRONT_TOKEN');
  process.exit(1);
}

// Initialize Shopify backend
const shopify = new ShopifyBackend(config);

// Determine mode from command line
const mode = process.argv[2] ?? 'http';

if (mode === 'mcp') {
  // ============================================================================
  // MCP Server Mode (for Claude)
  // ============================================================================
  
  const mcpServer = new MCPServer({
    backends: {
      products: shopify,
      cart: shopify,
      orders: shopify,
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
    name: 'shopify-store',
    version: '1.0.0',
  });

  mcpServer.start();
  console.error(`Shopify MCP Server started for ${config.storeDomain}`);

} else {
  // ============================================================================
  // HTTP Server Mode (for OpenAI/ChatGPT)
  // ============================================================================

  const adapter = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    backends: {
      products: shopify,
      cart: shopify,
      orders: shopify,
    },
    tools: [
      'search_products',
      'get_product_details',
      'add_to_cart',
      'check_inventory',
      'get_recommendations',
      'create_order',
    ],
    model: 'gpt-4-turbo',
    systemPrompt: `You are a helpful shopping assistant for ${config.storeDomain}.
Help customers find products, add items to their cart, and complete purchases.
Be friendly and helpful. When showing products, include prices and availability.`,
  });

  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ 
    status: 'ok',
    store: config.storeDomain,
  }));

  app.post('/api/chat', async (c) => {
    const body = await c.req.json();
    const response = await adapter.handleRequest(body);
    return c.json(response);
  });

  app.get('/api/tools', (c) => c.json(adapter.listTools()));

  const port = parseInt(process.env.PORT ?? '3001');
  console.log(`Shopify HTTP Server starting on http://localhost:${port}`);
  console.log(`Connected to store: ${config.storeDomain}`);

  serve({ fetch: app.fetch, port });
}

