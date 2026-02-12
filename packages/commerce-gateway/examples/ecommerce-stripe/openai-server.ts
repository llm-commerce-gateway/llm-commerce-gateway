/**
 * E-Commerce with Stripe - OpenAI/ChatGPT Server
 * 
 * HTTP server for OpenAI Function Calling integration.
 * Can be used with ChatGPT, GPT-4, or any OpenAI-compatible API.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenAIAdapter } from '@betterdata/llm-gateway/openai';
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

// Create OpenAI adapter
const adapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
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
  model: 'gpt-4-turbo',
  systemPrompt: `You are a helpful shopping assistant for a tech gadgets store.
You can help customers find products, add items to their cart, and complete purchases.
Be friendly, concise, and helpful. When showing products, include key details like price and features.
When customers want to buy, guide them through adding to cart and checking out.`,
});

// Create Hono app
const app = new Hono();

// Enable CORS
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Chat endpoint
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json();
    const response = await adapter.handleRequest(body);
    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of adapter.handleStreamingRequest!(body)) {
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        }
        controller.enqueue('data: [DONE]\n\n');
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// Get available tools
app.get('/api/tools', (c) => {
  return c.json(adapter.listTools());
});

// Start server
const port = parseInt(process.env.PORT ?? '3001');
console.log(`OpenAI Server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

