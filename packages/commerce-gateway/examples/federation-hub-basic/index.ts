/**
 * Federation Hub Basic Example
 *
 * Demonstrates:
 * 1. Setting up a federation hub
 * 2. Registering two mock merchants
 * 3. Executing federated searches
 * 4. Discovery functionality
 *
 * Run with: npx ts-node examples/federation-hub-basic/index.ts
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { LLMGateway } from '../../src/core/Gateway.js';
import {
  FederationHub,
  integrateFederation,
  type MerchantRegistration,
} from '../../src/federation/index.js';
import { activewearBackend, electronicsBackend } from './mock-backends.js';

// ============================================================================
// Configuration
// ============================================================================

const HUB_PORT = 3000;
const ACTIVEWEAR_PORT = 3001;
const ELECTRONICS_PORT = 3002;

// ============================================================================
// Merchant Registrations
// ============================================================================

const VUORI_MERCHANT: MerchantRegistration = {
  domain: 'vuori-mock.example.com',
  aliases: ['vuori', 'vuori clothing', 'activewear store'],
  gatewayUrl: `http://localhost:${ACTIVEWEAR_PORT}`,
  tier: 'verified',
  capabilities: {
    search: true,
    cart: false,
    checkout: false,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: 'Vuori (Mock)',
    description: 'Premium activewear and athleisure brand',
    categories: ['activewear', 'athleisure', 'workout', 'fitness', 'clothing'],
    logoUrl: 'https://vuoriclothing.com/logo.png',
  },
};

const TECHSTORE_MERCHANT: MerchantRegistration = {
  domain: 'techstore-mock.example.com',
  aliases: ['techstore', 'tech store', 'electronics store'],
  gatewayUrl: `http://localhost:${ELECTRONICS_PORT}`,
  tier: 'registered',
  capabilities: {
    search: true,
    cart: false,
    checkout: false,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: 'TechStore (Mock)',
    description: 'Your one-stop shop for electronics and gadgets',
    categories: ['electronics', 'tech', 'gadgets', 'computers', 'phones'],
    logoUrl: 'https://techstore.example.com/logo.png',
  },
};

// ============================================================================
// Create Merchant Gateways
// ============================================================================

async function createMerchantGateway(
  name: string,
  port: number,
  backend: typeof activewearBackend
): Promise<{ app: Hono; server: ReturnType<typeof serve> }> {
  const app = new Hono();

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', merchant: name });
  });

  // Tool execution endpoint (simplified for demo)
  app.post('/api/tools/execute', async (c) => {
    try {
      const body = await c.req.json();
      const { tool, arguments: args } = body;

      console.log(`[${name}] Tool call: ${tool}`, args);

      if (tool === 'search_products') {
        const result = await backend.search(args.query, {
          limit: args.limit ?? 10,
          category: args.category,
        });

        return c.json({
          success: true,
          data: result,
        });
      }

      return c.json({ success: false, error: `Unknown tool: ${tool}` }, 400);
    } catch (error) {
      console.error(`[${name}] Error:`, error);
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      );
    }
  });

  // Well-known endpoint for federation discovery
  app.get('/.well-known/llm-gateway.json', (c) => {
    return c.json({
      schemaVersion: '1.0',
      domain: `${name.toLowerCase()}-mock.example.com`,
      gatewayUrl: `http://localhost:${port}`,
      capabilities: {
        search: true,
        cart: false,
        checkout: false,
        inventory: true,
        recommendations: false,
      },
      verification: {
        methods: ['api_callback'],
      },
      metadata: {
        name: `${name} (Mock)`,
        categories:
          name === 'Vuori'
            ? ['activewear', 'athleisure']
            : ['electronics', 'tech'],
      },
    });
  });

  const server = serve({ fetch: app.fetch, port });
  console.log(`✅ ${name} merchant gateway running on http://localhost:${port}`);

  return { app, server };
}

// ============================================================================
// Create Federation Hub
// ============================================================================

async function createHub(): Promise<FederationHub> {
  const hub = await FederationHub.create({
    registry: {
      type: 'memory',
      initialMerchants: [VUORI_MERCHANT, TECHSTORE_MERCHANT],
    },
    discovery: {
      type: 'tag-based',
      synonyms: {
        activewear: ['athletic', 'sportswear', 'workout', 'fitness', 'gym'],
        electronics: ['tech', 'gadgets', 'computers', 'devices', 'digital'],
      },
    },
    fallback: {
      suggestAlternatives: true,
      maxAlternatives: 3,
    },
    debug: true,
  });

  console.log(`✅ Federation hub created with ${await hub.listMerchants().then((m) => m.length)} merchants`);
  return hub;
}

// ============================================================================
// Demo Script
// ============================================================================

async function runDemo(hub: FederationHub): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 FEDERATION HUB DEMO');
  console.log('='.repeat(60) + '\n');

  // Demo 1: Direct merchant search
  console.log('📦 Demo 1: Direct merchant search');
  console.log('   Query: "shop vuori for joggers"');
  console.log('-'.repeat(40));

  const result1 = await hub.search('shop vuori for joggers');
  console.log('   Status:', result1.status);
  console.log('   Attribution:', result1.attribution?.merchant.name);
  if (result1.data) {
    console.log('   Products found:', result1.data.products?.length ?? 0);
    result1.data.products?.slice(0, 3).forEach((p: any) => {
      console.log(`   - ${p.title} ($${p.price?.amount})`);
    });
  }
  console.log();

  // Demo 2: Another merchant search
  console.log('📦 Demo 2: Search electronics store');
  console.log('   Query: "search techstore for laptops"');
  console.log('-'.repeat(40));

  const result2 = await hub.search('search techstore for laptops');
  console.log('   Status:', result2.status);
  console.log('   Attribution:', result2.attribution?.merchant.name);
  if (result2.data) {
    console.log('   Products found:', result2.data.products?.length ?? 0);
    result2.data.products?.slice(0, 3).forEach((p: any) => {
      console.log(`   - ${p.title} ($${p.price?.amount})`);
    });
  }
  console.log();

  // Demo 3: Discovery - find stores for a category
  console.log('🔍 Demo 3: Discover merchants');
  console.log('   Query: "where can I buy workout clothes"');
  console.log('-'.repeat(40));

  const merchants = await hub.discoverMerchants('workout clothes', { limit: 5 });
  console.log('   Discovered merchants:', merchants.length);
  merchants.forEach((m) => {
    console.log(`   - ${m.name} (${m.domain}) - Score: ${m.relevanceScore?.toFixed(2)}`);
    console.log(`     Categories: ${m.categories.join(', ')}`);
  });
  console.log();

  // Demo 4: Discovery for electronics
  console.log('🔍 Demo 4: Discover electronics stores');
  console.log('   Query: "find gadgets and tech"');
  console.log('-'.repeat(40));

  const techMerchants = await hub.discoverMerchants('gadgets and tech', { limit: 5 });
  console.log('   Discovered merchants:', techMerchants.length);
  techMerchants.forEach((m) => {
    console.log(`   - ${m.name} (${m.domain}) - Score: ${m.relevanceScore?.toFixed(2)}`);
  });
  console.log();

  // Demo 5: Unknown merchant - should suggest alternatives
  console.log('❓ Demo 5: Unknown merchant (fallback)');
  console.log('   Query: "shop unknown-store for products"');
  console.log('-'.repeat(40));

  const result3 = await hub.search('shop unknown-store for products');
  console.log('   Status:', result3.status);
  console.log('   Message:', result3.message);
  if (result3.alternatives && result3.alternatives.length > 0) {
    console.log('   Alternatives suggested:', result3.alternatives.length);
    result3.alternatives.forEach((a) => {
      console.log(`   - ${a.name} (${a.domain})`);
    });
  }
  console.log();

  // Demo 6: Direct shop by domain
  console.log('🎯 Demo 6: Direct shopMerchant call');
  console.log('   Merchant: "vuori-mock.example.com"');
  console.log('   Query: "shorts"');
  console.log('-'.repeat(40));

  const result4 = await hub.shopMerchant('vuori-mock.example.com', 'shorts');
  console.log('   Status:', result4.status);
  if (result4.data) {
    console.log('   Products found:', result4.data.products?.length ?? 0);
    result4.data.products?.forEach((p: any) => {
      console.log(`   - ${p.title} ($${p.price?.amount})`);
    });
  }
  console.log();

  console.log('='.repeat(60));
  console.log('✅ Demo complete!');
  console.log('='.repeat(60));
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('🏗️  Starting Federation Hub Example...\n');

  try {
    // Start merchant gateways
    const [vuoriGateway, techstoreGateway] = await Promise.all([
      createMerchantGateway('Vuori', ACTIVEWEAR_PORT, activewearBackend),
      createMerchantGateway('TechStore', ELECTRONICS_PORT, electronicsBackend),
    ]);

    // Create federation hub
    const hub = await createHub();

    // Create hub HTTP server
    const hubApp = new Hono();

    // Add hub routes
    const { hub: integratedHub } = await integrateFederation(hubApp, {
      mode: 'hub',
      hub: {
        registry: hub.getRegistry(),
        discovery: { type: 'tag-based' },
        registerTools: false, // We're using hub directly
      },
    });

    // Add custom routes for demo
    hubApp.get('/api/health', (c) => {
      return c.json({ status: 'ok', type: 'federation-hub' });
    });

    const hubServer = serve({ fetch: hubApp.fetch, port: HUB_PORT });
    console.log(`✅ Federation Hub running on http://localhost:${HUB_PORT}`);

    // Wait a moment for servers to stabilize
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Run demo
    await runDemo(hub);

    // Keep servers running
    console.log('\n💡 Servers are running. Press Ctrl+C to stop.\n');
    console.log('Try these endpoints:');
    console.log(`  Hub health:        curl http://localhost:${HUB_PORT}/api/health`);
    console.log(`  Vuori health:      curl http://localhost:${ACTIVEWEAR_PORT}/api/health`);
    console.log(`  TechStore health:  curl http://localhost:${ELECTRONICS_PORT}/api/health`);
    console.log(`  Vuori well-known:  curl http://localhost:${ACTIVEWEAR_PORT}/.well-known/llm-gateway.json`);

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down...');
      hubServer.close();
      vuoriGateway.server.close();
      techstoreGateway.server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

