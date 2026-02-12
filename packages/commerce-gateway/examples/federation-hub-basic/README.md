# Federation Hub Basic Example

This example demonstrates the Federation Hub capabilities of `@betterdata/llm-gateway`.

## What This Example Shows

1. **Setting up a Federation Hub** - A central routing layer that directs shopping intent to the right merchant
2. **Mock Merchant Gateways** - Two simulated stores (activewear and electronics)
3. **Federated Search** - Natural language queries routed to the correct merchant
4. **Merchant Discovery** - Finding relevant stores based on what a user is looking for
5. **Fallback Behavior** - Suggestions when a requested merchant isn't found

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Federation Hub (port 3000)                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Registry   │  │  Discovery  │  │     Intent Parser       │  │
│  │  (Memory)   │  │ (Tag-Based) │  │ "shop vuori for..."     │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         └────────────────┴─────────────────────┘                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
  ┌─────────────────┐             ┌─────────────────┐
  │  Vuori (Mock)   │             │ TechStore (Mock)│
  │   Port 3001     │             │    Port 3002    │
  │   activewear    │             │   electronics   │
  └─────────────────┘             └─────────────────┘
```

## Running the Example

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

### Install Dependencies

```bash
cd packages/llm-gateway
pnpm install
```

### Run the Example

```bash
# Using ts-node
npx ts-node examples/federation-hub-basic/index.ts

# Or using tsx (faster)
npx tsx examples/federation-hub-basic/index.ts
```

## Expected Output

```
🏗️  Starting Federation Hub Example...

✅ Vuori merchant gateway running on http://localhost:3001
✅ TechStore merchant gateway running on http://localhost:3002
✅ Federation hub created with 2 merchants
✅ Federation Hub running on http://localhost:3000

============================================================
🚀 FEDERATION HUB DEMO
============================================================

📦 Demo 1: Direct merchant search
   Query: "shop vuori for joggers"
----------------------------------------
   Status: ok
   Attribution: Vuori (Mock)
   Products found: 1
   - Performance Joggers ($98)

📦 Demo 2: Search electronics store
   Query: "search techstore for laptops"
----------------------------------------
   Status: ok
   Attribution: TechStore (Mock)
   Products found: 1
   - ProBook 15" Laptop ($1299)

🔍 Demo 3: Discover merchants
   Query: "where can I buy workout clothes"
----------------------------------------
   Discovered merchants: 1
   - Vuori (Mock) (vuori-mock.example.com) - Score: 0.85
     Categories: activewear, athleisure, workout, fitness, clothing

🔍 Demo 4: Discover electronics stores
   Query: "find gadgets and tech"
----------------------------------------
   Discovered merchants: 1
   - TechStore (Mock) (techstore-mock.example.com) - Score: 0.90

❓ Demo 5: Unknown merchant (fallback)
   Query: "shop unknown-store for products"
----------------------------------------
   Status: merchant_not_connected
   Message: Merchant 'unknown-store' not found
   Alternatives suggested: 2
   - Vuori (Mock) (vuori-mock.example.com)
   - TechStore (Mock) (techstore-mock.example.com)

🎯 Demo 6: Direct shopMerchant call
   Merchant: "vuori-mock.example.com"
   Query: "shorts"
----------------------------------------
   Status: ok
   Products found: 1
   - Kore Shorts ($78)

============================================================
✅ Demo complete!
============================================================
```

## Extending for Real Merchants

### 1. Replace Mock Backends

Instead of mock backends, use real commerce backends:

```typescript
import { ShopifyBackend } from '@betterdata/llm-gateway/backends/shopify';

const myRealBackend = new ShopifyBackend({
  shopDomain: 'mystore.myshopify.com',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
});
```

### 2. Use Persistent Registry

For production, use a file-based registry or implement your own:

```typescript
const hub = await FederationHub.create({
  registry: {
    type: 'file',
    filePath: './merchants.json',
  },
  // ... other options
});
```

### 3. Enable Authentication

For cross-gateway security:

```typescript
const hub = await FederationHub.create({
  auth: {
    enabled: true,
    generateKey: true,
    issuer: 'my-federation-hub',
  },
  // ... other options
});
```

### 4. Add Real Merchants

Register actual merchant gateways:

```typescript
await hub.registerMerchant({
  domain: 'vuoriclothing.com',
  aliases: ['vuori'],
  gatewayUrl: 'https://api.vuori.com/llm-gateway',
  tier: 'verified',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: true,
  },
  metadata: {
    name: 'Vuori',
    categories: ['activewear', 'athleisure'],
    logoUrl: 'https://vuoriclothing.com/logo.png',
  },
});
```

## Files

- `index.ts` - Main example script
- `mock-backends.ts` - Mock product backends
- `README.md` - This file

## Related Documentation

- [Federation Hub Guide](../../docs/federation.md)
- [API Reference](../../docs/api.md)
- [Backend Integration](../../docs/backends.md)

