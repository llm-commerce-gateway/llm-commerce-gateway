/**
 * Lumebondé Demo - OpenAI/ChatGPT Server
 * 
 * HTTP server for luxury retail conversations.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';
import { DubLinkGenerator, createLinkAnalytics } from '@betterdata/commerce-gateway/links';
import { LumebondeBackend } from './backend/LumebondeBackend.js';

// Initialize backend
const backend = new LumebondeBackend({
  redisUrl: process.env.REDIS_URL,
  redisToken: process.env.REDIS_TOKEN,
});

// Initialize link generator (optional)
const links = process.env.DUB_API_KEY
  ? new DubLinkGenerator({
      apiKey: process.env.DUB_API_KEY,
      domain: process.env.DUB_DOMAIN ?? 'luxe.link',
      storeBaseUrl: 'https://lumebonde.com',
      qrCode: true,
    })
  : undefined;

// Create OpenAI adapter
const adapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  backends: {
    products: backend,
    cart: backend,
    orders: backend,
    links,
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
  systemPrompt: `You are a knowledgeable luxury shopping assistant for Lumebonde, a premium accessories brand.

Your personality:
- Sophisticated but approachable
- Knowledgeable about materials, craftsmanship, and care
- Helpful with gift recommendations
- Aware of multi-location inventory (NYC, LA, Miami stores + online)

Key information:
- Free shipping on orders over $200
- 30-day returns on all items
- Complimentary gift wrapping available
- Store pickup available at NYC, LA, and Miami locations

When showing products:
- Highlight quality materials and craftsmanship
- Mention the rating and reviews
- Note if items are on sale
- Suggest complementary items for bundles

For gifts:
- Ask about the recipient and occasion
- Consider price range and preferences
- Offer gift wrapping and personalization options`,
});

// Create Hono app
const app = new Hono();
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', brand: 'Lumebonde' }));

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

// Streaming endpoint
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

// Get tools
app.get('/api/tools', (c) => c.json(adapter.listTools()));

// Get store locations
app.get('/api/locations', (c) => c.json(backend.getStoreLocations()));

// Start server
const port = parseInt(process.env.PORT ?? '3001');
console.log(`Lumebonde OpenAI Server starting on http://localhost:${port}`);
console.log(`Link generation: ${links ? 'Enabled' : 'Disabled'}`);

serve({ fetch: app.fetch, port });

