# @betterdata/commerce-gateway

[![npm version](https://badge.fury.io/js/%40betterdata%2Fcommerce-gateway.svg)](https://www.npmjs.com/package/@betterdata/commerce-gateway)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![API Stability](https://img.shields.io/badge/API-Stable-green.svg)](docs/oss/INTERFACE_STABILITY.md)

> **Universal LLM Gateway for Conversational Commerce**
> Build AI shopping assistants that work across Claude, ChatGPT, Grok, and Gemini.

## 🚀 The Problem & Solution

**The Problem:**
Every e-commerce platform needs to integrate with multiple AI assistants:
- **Claude** for sophisticated reasoning
- **ChatGPT** for widespread adoption
- **Grok** for real-time social commerce

Each has different APIs, authentication, and tool-calling formats. Building these integrations from scratch is time-consuming and error-prone.

**The Solution:**
**@betterdata/commerce-gateway** provides a universal abstraction layer:
- **Universal Tool Format**: Define tools once, use everywhere.
- **Pluggable Backends**: Clean interfaces for products, cart, and orders.
- **Session Management**: Redis-based sessions with cross-platform transfer.
- **Production Ready**: Rate limiting, auth, and logging built-in.

---

## 📦 Package Exports

Primary import paths:
- `@betterdata/commerce-gateway`
- `@betterdata/commerce-gateway/mcp`
- `@betterdata/commerce-gateway/adapters`
- `@betterdata/commerce-gateway/openai`
- `@betterdata/commerce-gateway/grok`
- `@betterdata/commerce-gateway/session`
- `@betterdata/commerce-gateway/auth`
- `@betterdata/commerce-gateway/links`
- `@betterdata/commerce-gateway/backends`
- `@betterdata/commerce-gateway/backends/demo`
- `@betterdata/commerce-gateway/tools`
- `@betterdata/commerce-gateway/observability`
- `@betterdata/commerce-gateway/errors`
- `@betterdata/commerce-gateway/validation`
- `@betterdata/commerce-gateway/ingestion`
- `@betterdata/commerce-gateway/catalog`
- `@betterdata/commerce-gateway/federation`
- `@betterdata/commerce-gateway/federation/hub`
- `@betterdata/commerce-gateway/federation/registry`
- `@betterdata/commerce-gateway/registry`
- `@betterdata/commerce-gateway/federation/tools`
- `@betterdata/commerce-gateway/federation/discovery`
- `@betterdata/commerce-gateway/federation/auth`
- `@betterdata/commerce-gateway/federation/auth/dev`
- `@betterdata/commerce-gateway/federation/analytics`
- `@betterdata/commerce-gateway/federation/providers`
- `@betterdata/commerce-gateway/formatters`
- `@betterdata/commerce-gateway/capabilities`
- `@betterdata/commerce-gateway/extensions`
- `@betterdata/commerce-gateway/feature-flags`

Avoid deep imports from `src/*`; use the exports above.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│ @betterdata/commerce-gateway                                 │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │  Claude │ │ OpenAI  │ │  Grok   │ │ Custom  │        │
│ │   MCP   │ │Functions│ │  Tools  │ │ Adapter │        │
│ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
│      └───────────┼───────────┼───────────┘             │
│                  ▼                                      │
│ ┌─────────────────────────────────────────────────────┐│
│ │              Universal Tool Registry                ││
│ └────────────────────────┬────────────────────────────┘│
│                          ▼                              │
│ ┌─────────────────────────────────────────────────────┐│
│ │              Backend Interfaces                     ││
│ │   ProductBackend · CartBackend · OrderBackend      ││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │ Shopify │    │  WooC   │    │ Custom  │
      │  Store  │    │Commerce │    │   DB    │
      └─────────┘    └─────────┘    └─────────┘
```

---

## ⚡ Quick Start

```bash
npm install @betterdata/commerce-gateway
```

### 1. Create Your Backend
Implement the `ProductBackend` interface (or use a pre-built one for Shopify/WooCommerce).

```typescript
import type { ProductBackend } from '@betterdata/commerce-gateway';

export const myBackend: ProductBackend = {
  async searchProducts(query) {
    // Connect to your DB or API here
    return { products: [...], total: 0, hasMore: false };
  },
  // ... implement details and inventory methods
};
```

### 2. Start the Gateway
```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';

const gateway = new LLMGateway({
  backends: {
    products: myBackend,
    // Add cart/orders when ready
  },
  llmProviders: ['anthropic', 'openai', 'grok'],
  session: {
    redis: { url: process.env.REDIS_URL } // Optional persistence
  }
});

await gateway.start(3000);
console.log('🚀 Gateway running on http://localhost:3000');
```

---

## 🧩 Core Concepts

### Backends
Backends are the bridge between the AI and your data.
- **ProductBackend**: Search, details, inventory, recommendations.
- **CartBackend**: Create cart, add/remove items.
- **OrderBackend**: Create orders, check status.

### Marketplace Mode
The gateway supports **multi-vendor** setups out of the box.
- **Global Search**: Search across multiple vendors/stores.
- **Runtime Scoping**: Scope search to specific vendors (`shopify_store`, `square_merchant`).
- **Platform Identifiers**: Track original IDs across platforms.

---

## 🔌 Integrations

### 🧠 Claude Desktop (MCP)
Native support for Anthropic's Model Context Protocol. No HTTP server required for local storage!

```typescript
import { MCPServer } from '@betterdata/commerce-gateway/mcp';

const server = new MCPServer({
  backends: { products: myBackend },
  name: 'my-store',
  tools: ['search_products', 'add_to_cart']
});

server.start(); // Stdio transport for Claude Desktop
```

### 🤖 OpenAI / ChatGPT
Full support for Function Calling and the Assistants API.

```typescript
import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';

const adapter = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  backends: { products: myBackend }
});

// Use in your Express/Hono route
app.post('/api/chat', async (req, res) => {
  const response = await adapter.handleRequest(req.body);
  res.json(response);
});
```

### ✖️ Grok (X.com)
Optimized for social commerce on X (Twitter).
- **Tweet-Optimized**: Enforces 280-char context window.
- **Emoji-Rich**: Automatically adds relevant emojis to products.
- **Mobile-First**: Formats responses for mobile viewing.

```typescript
import { GrokAdapter } from '@betterdata/commerce-gateway/grok';

const grok = new GrokAdapter({
  apiKey: process.env.GROK_API_KEY,
  backends: { products: myBackend },
  maxTokens: 280 // Tweet mode
});
```

---

## ⚙️ Configuration

### Authentication
Secure your gateway with API keys, OAuth, or JWT.

```typescript
auth: {
  apiKeys: ['sk_live_...'],
  oauth: {
    google: { clientId: '...', clientSecret: '...' }
  }
}
```

### Rate Limiting
Built-in sliding window rate limiting (Redis-backed).

```typescript
rateLimits: {
  anonymous: { requests: 10, window: 60 },
  authenticated: { requests: 100, window: 60 }
}
```

### Sessions
- **Redis**: Fast, ephemeral session storage.
- **Transfer**: Start a session in Claude, generate a token, and resume in ChatGPT.

---

## Telemetry (Optional)

This gateway includes optional, opt-in telemetry to help us understand ecosystem health and prioritize fixes.

Telemetry is disabled by default.

### What telemetry does

If enabled, the gateway sends anonymous, aggregate metrics, such as:

- Gateway version
- Uptime
- Enabled features (registry/federation/streaming)
- High-level usage counts
- Performance indicators (latency, error rate)

### What telemetry does NOT do

We never collect:

- Prompts or LLM inputs
- Tool input or output payloads
- API keys or secrets
- End-user or customer data
- Tenant/org/customer identifiers (names, domains, emails)
- Headers/body captures or anything identifying

Telemetry data cannot be used to identify you or your users.

### Enabling Telemetry

```yaml
telemetry:
  enabled: true
  endpoint: https://telemetry.betterdata.co
```

Or map an environment variable into config:

```typescript
const telemetryEnabled = process.env.TELEMETRY_ENABLED === 'true';

const gateway = new LLMGateway({
  telemetry: { enabled: telemetryEnabled },
});
```

### Disabling Telemetry

Telemetry is disabled by default.
To explicitly disable:

```yaml
telemetry:
  enabled: false
```

### Transparency

The telemetry payload schema is documented in:

`docs/telemetry/schema.json`

You can preview the payload locally:

`GET /telemetry/preview` (also available at `/api/telemetry/preview`)

The gateway works fully with telemetry disabled.

---

## 🌐 Federation Hub

Route shopping intent across multiple merchants with the Federation Hub.

```
┌─────────────────────────────────────────────────────────┐
│                   Federation Hub                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Merchant Registry                      │    │
│  │  vuoriclothing.com → https://api.vuori.com/llm  │    │
│  │  macys.com → https://llm.macys.com/gateway      │    │
│  │  nike.com → https://nike-gateway.example.com    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │   Vuori   │   │   Macy's  │   │   Nike    │
    │  Gateway  │   │  Gateway  │   │  Gateway  │
    └───────────┘   └───────────┘   └───────────┘
```

### Quick Start - Hub Setup

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: { type: 'memory' },
  discovery: { type: 'tag-based' },
  fallback: { suggestAlternatives: true },
});

// Register merchants
await hub.registerMerchant({
  domain: 'vuoriclothing.com',
  aliases: ['vuori'],
  gatewayUrl: 'https://api.vuori.com/llm-gateway',
  tier: 'verified',
  capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
  metadata: { name: 'Vuori', categories: ['activewear', 'athleisure'] },
});

// Execute federated search
const result = await hub.search('shop vuori for joggers under $100');
console.log(result.data); // Products from Vuori
console.log(result.attribution); // { merchant: { name: 'Vuori', ... } }
```

### Quick Start - Merchant Setup

Expose your gateway for federation discovery:

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { integrateFederation } from '@betterdata/commerce-gateway/federation';

const gateway = new LLMGateway({
  backends: { products: myBackend },
});

await integrateFederation(gateway, {
  mode: 'merchant',
  merchant: {
    config: {
      domain: 'mystore.com',
      name: 'My Store',
      categories: ['fashion', 'accessories'],
    },
  },
});

await gateway.start(3000);
// Now exposes /.well-known/llm-gateway.json
```

### Key Features

- **🔍 Intent Parsing**: Natural language → merchant + query + filters
- **🏪 Multi-Merchant**: Register unlimited merchant gateways
- **🔐 JWT Auth**: Secure cross-gateway communication
- **📊 Analytics**: Track searches, resolutions, and tool calls
- **🔄 Fallback**: Suggest alternatives when merchant not found
- **🏷️ Discovery**: Find merchants by category and keywords

See `examples/federation-hub-basic/` for a complete working example.

---

## 📦 Examples

Check out `packages/commerce-gateway/examples` for full code:

1.  **Simple Product Search**: Minimal example (50 lines).
2.  **E-commerce with Stripe**: Full cart + checkout flow.
3.  **Shopify Integration**: Connect to a live Shopify store.
4.  **Grok Twitter Bot**: Social commerce bot example.
5.  **Federation Hub Basic**: Multi-merchant federation demo.
6.  **Lumebondé Cosmetics (OSS)**: In-memory catalog demo with 15 skincare/haircare products. No SCM dependencies.

### Lumebondé Cosmetics Quick Start

```bash
# Navigate to example
cd packages/commerce-gateway/examples/lumebonde-cosmetics

# Run demo
npx tsx demo.ts

# Search products
npx tsx demo.ts search "vitamin C serum"

# Import with CLI
npx llm-gateway json --file ./data/catalog.json
npx llm-gateway csv --file ./data/catalog.csv
```

See [`examples/lumebonde-cosmetics/README.md`](examples/lumebonde-cosmetics/README.md) for full documentation.

---

## 🔒 API Stability

This package follows [Semantic Versioning](https://semver.org/) with explicit stability guarantees:

| Version | Allowed Changes |
|---------|-----------------|
| **Patch** | Bug fixes only |
| **Minor** | Additive only (new optional fields, new interfaces) |
| **Major** | Breaking changes |

**Key guarantees:**
- Public interfaces won't change in minor releases
- Deprecation warnings before any removal
- CI enforces API surface stability

📖 **[Full Interface Stability Policy](docs/oss/INTERFACE_STABILITY.md)**

### Capability Discovery

Check what features are available at runtime:

```typescript
const caps = await hub.getCapabilities();

if (caps.features.discovery.rankedResults) {
  // Use ML-powered ranking (Cloud feature)
} else {
  console.log('Using default sort (OSS)');
}
```

📖 **[Capability Discovery Guide](docs/oss/CAPABILITIES.md)**

---

---

## 🏪 Commerce Gateway Registry

The gateway integrates with the Commerce Gateway Registry for brand and GTIN resolution:

```typescript
import { RegistryClient } from '@betterdata/commerce-gateway/registry';

const registry = new RegistryClient({
  apiUrl: process.env.REGISTRY_URL, // Optional; use your own registry URL for self-hosted
});

// Resolve brand name
const brand = await registry.resolveBrand('Nike');
if (brand.found) {
  console.log(`Found gateway: ${brand.gateway?.endpoint}`);
}

// Resolve GTIN
const gtin = await registry.resolveGTIN('0012345678901');
if (gtin.found) {
  console.log(`Product: ${gtin.product_name}`);
  console.log(`Authoritative source: ${gtin.authoritative_source?.brand}`);
}
```

### @shop Namespace

The gateway supports the `@shop` namespace for brand and GTIN queries:

- `@shop nike` - Search Nike's catalog
- `@shop nike running shoes` - Search Nike for running shoes
- `@shop 0012345678901` - Lookup product by GTIN

---

## 📚 Documentation

- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Integration Tutorials](./docs/INTEGRATION_TUTORIALS.md)** - Step-by-step guides
- **[Deployment Guides](./docs/DEPLOYMENT.md)** - Deploy to Vercel, Railway, Docker
- **[Protocol Specification](./docs/PROTOCOL.md)** - Commerce Gateway Protocol
- **[Connector Interface](./docs/CONNECTOR_INTERFACE.md)** - Build custom connectors

---

## 🚀 Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/betterdata/llm-gateway&env=REDIS_URL)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/betterdata/llm-gateway)

---

## Non-goals

This package intentionally does **not**:

- Require a Better Data account or hosted services — works fully self-hosted
- Ship proprietary features (billing, metering, multi-tenant entitlements)
- Replace your existing cart/checkout — it orchestrates tools; you own the flows
- Collect prompts or tool payloads (telemetry is opt-in and aggregate-only)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

---

---

> *Lumebondé is a fictitious brand used for demonstration purposes only.*

## 📄 License

MIT © [Better Data](https://betterdata.com)

---

## 🔗 Links

- [Website](https://betterdata.com)
- [Documentation](https://docs.betterdata.com)
- [GitHub](https://github.com/betterdata/llm-gateway)
- [npm](https://www.npmjs.com/package/@betterdata/commerce-gateway)
- [Discord](https://discord.gg/betterdata)
