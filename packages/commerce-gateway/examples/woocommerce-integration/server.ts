/**
 * WooCommerce Integration - Dual Server (MCP + HTTP)
 * 
 * Provides both Claude MCP and OpenAI HTTP endpoints
 * connected to a WooCommerce store.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MCPServer } from '@betterdata/commerce-gateway/mcp';
import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';
import { WooCommerceBackend } from './backend/WooCommerceBackend.js';

// Configuration
const config = {
  siteUrl: process.env.WOOCOMMERCE_SITE_URL!,
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
  apiVersion: process.env.WOOCOMMERCE_API_VERSION ?? 'wc/v3',
};

// Validate configuration
if (!config.siteUrl || !config.consumerKey || !config.consumerSecret) {
  console.error('Missing required environment variables:');
  console.error('- WOOCOMMERCE_SITE_URL');
  console.error('- WOOCOMMERCE_CONSUMER_KEY');
  console.error('- WOOCOMMERCE_CONSUMER_SECRET');
  process.exit(1);
}

// Initialize WooCommerce backend
const woocommerce = new WooCommerceBackend(config);

// Determine mode from command line
const mode = process.argv[2] ?? 'http';

if (mode === 'mcp') {
  // ============================================================================
  // MCP Server Mode (for Claude)
  // ============================================================================
  
  const mcpServer = new MCPServer({
    backends: {
      products: woocommerce,
      cart: woocommerce,
      orders: woocommerce,
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
    name: 'woocommerce-store',
    version: '1.0.0',
  });

  mcpServer.start();
  console.error(`WooCommerce MCP Server started for ${config.siteUrl}`);

} else {
  // ============================================================================
  // HTTP Server Mode (for OpenAI/ChatGPT)
  // ============================================================================

  const adapter = new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    backends: {
      products: woocommerce,
      cart: woocommerce,
      orders: woocommerce,
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
    systemPrompt: `You are a helpful shopping assistant for a WordPress/WooCommerce store.
Help customers find products, add items to their cart, and complete purchases.
Be friendly and helpful. When showing products, include prices and availability.`,
  });

  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ 
    status: 'ok',
    store: config.siteUrl,
  }));

  app.post('/api/chat', async (c) => {
    const body = await c.req.json();
    const response = await adapter.handleRequest(body);
    return c.json(response);
  });

  app.get('/api/tools', (c) => c.json(adapter.listTools()));

  const port = parseInt(process.env.PORT ?? '3001');
  console.log(`WooCommerce HTTP Server starting on http://localhost:${port}`);
  console.log(`Connected to store: ${config.siteUrl}`);

  serve({ fetch: app.fetch, port });
}

