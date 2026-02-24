# Better Data Marketplace - Developer Guide

## Overview

The Better Data Marketplace enables multi-vendor product search across Claude, ChatGPT, and Grok. Vendors can list products once and reach customers wherever they chat with AI.

### Key Features

- **Multi-Vendor Catalog**: Products from multiple Shopify/Square stores in one unified search
- **Runtime Scoping**: Same deployment supports global search OR vendor-specific search
- **AI-Native**: Optimized for LLM tools (Claude MCP, ChatGPT Functions, Grok tools)
- **Smart Ranking**: Authentication, distance, price, rating, shipping
- **Platform Identifiers**: Complete tracking of Shopify/Square/Google Merchant product IDs
- **Analytics**: Track performance by AI platform (Claude vs ChatGPT vs Grok)

## Architecture

```
VendorPlatformAccount (Shopify/Square credentials)
    ↓
ProductListing (vendor-specific offering + platform IDs)
    ↓
MarketplaceSearchIndex (denormalized for fast search)
    ↓
LLM Tools (product_search, add_to_cart)
```

### Runtime Scoping

**Key Innovation**: Scope is a **request parameter**, not configuration. One deployment serves multiple use cases:

```typescript
// Global search (all vendors)
const results = await searchProducts({
  text: 'Nike Air Max 97',
  scope: { type: 'global' },
});

// Shopify store search (single vendor)
const results = await searchProducts({
  text: 'Nike Air Max 97',
  scope: {
    type: 'shopify_store',
    domain: 'mybrand.myshopify.com',
  },
});

// Square merchant search
const results = await searchProducts({
  text: 'running shoes',
  scope: {
    type: 'square_merchant',
    merchantId: 'sq_merchant_123',
  },
});

// Vendor scope (all platforms for one vendor)
const results = await searchProducts({
  text: 'sneakers',
  scope: {
    type: 'vendor',
    vendorId: 'org-vendor-123',
  },
});
```

### Supported Scope Types

| Scope Type | Use Case | Parameters |
|------------|----------|------------|
| `global` | Marketplace (all vendors) | None |
| `shopify_store` | Single Shopify store | `domain` |
| `square_merchant` | Single Square merchant | `merchantId` |
| `vendor` | All platforms for one vendor | `vendorId` |
| `platform` | All vendors on one platform | `platform` |

## Core Concepts

### Core Concepts

| Concept | Description |
|---------|-------------|
| **ProductMaster** | Canonical product record (e.g., "Nike Air Max 97"). Shared across all vendors. |
| **ProductListing** | Vendor-specific offering with price, inventory, location. Links to ProductMaster. |
| **VendorProfile** | Marketplace seller profile extending Organization. |
| **MarketplaceSearchIndex** | Denormalized search table with FULLTEXT indexes for fast MySQL search. |

### Data Flow

1. **Vendor connects platform** (Shopify/Square)
2. **Products ingested** via pipeline
3. **Matcher links to ProductMaster** (GTIN or fuzzy name match)
4. **ProductListing created** with vendor-specific data
5. **Search index updated** for AI discovery
6. **LLM searches and ranks listings**
7. **Cart tracks attribution** (which LLM, which search)

## Quick Start

### Installation

```bash
npm install @betterdata/commerce-gateway
```

### Basic Setup

```typescript
import { 
  createMarketplaceSearchHandler,
  createCartHandler,
  createAnalyticsService 
} from '@betterdata/commerce-gateway';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize handlers
const searchHandler = createMarketplaceSearchHandler(prisma);
const cartHandler = createCartHandler(prisma);
const analyticsService = createAnalyticsService(prisma);
```

### Search Products

```typescript
const results = await searchHandler.search({
  query: 'Nike Air Max 97 silver',
  userLocation: {
    lat: 40.7128,
    lng: -74.0060, // NYC
  },
  filters: {
    authenticatedOnly: true,
    inStockOnly: true,
    priceMax: 200,
  },
  limit: 10,
});

// Returns grouped by ProductMaster with ranked vendor listings
console.log(results);
// {
//   products: [
//     {
//       product: { id, brand, name, description },
//       listings: [
//         { vendorName, price, authenticated, distance, rankScore },
//         ...
//       ],
//       totalVendors: 5,
//     }
//   ]
// }
```

### Add to Cart

```typescript
const result = await cartHandler.addToCart(
  { listingId: 'listing-abc123', quantity: 1 },
  {
    sessionId: 'user-session-xyz',
    llmProvider: 'anthropic',
    timestamp: new Date(),
    lastSearchQuery: 'Nike sneakers',
    lastListingRank: 1,
  }
);

console.log(result.content);
// ✅ Added **Air Max 97** from **Sneaker Paradise** to your cart.
```

### Get Analytics

```typescript
const attribution = await analyticsService.getAttribution('vendor-org-id', '30d');

console.log(attribution);
// {
//   byProvider: [
//     { provider: 'anthropic', events: 45, revenue: 6750, percentage: 50.5 },
//     { provider: 'openai', events: 32, revenue: 4200, percentage: 36.0 },
//   ]
// }
```

## MCP Integration (Claude Desktop)

### Tool Definitions

The gateway provides MCP-compatible tools:

```typescript
import { 
  marketplaceSearchToolDefinition,
  addToCartToolDefinition,
  viewCartToolDefinition,
} from '@betterdata/commerce-gateway';

// Register with MCP server
server.setRequestHandler('tools/list', async () => ({
  tools: [
    marketplaceSearchToolDefinition,
    addToCartToolDefinition,
    viewCartToolDefinition,
  ],
}));
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "better-data-marketplace": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "DATABASE_URL": "mysql://..."
      }
    }
  }
}
```

## OpenAI Function Calling

```typescript
const tools = [
  {
    type: "function",
    function: marketplaceSearchToolDefinition,
  },
];

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  tools,
});
```

## Ranking Algorithm

Listings are ranked by multiple factors:

| Factor | Max Points | Criteria |
|--------|------------|----------|
| **Authentication** | +20 | Signal Tag verified |
| **Distance** | +30 | <10mi: 30, <50mi: 20, <200mi: 10 |
| **Vendor Rating** | +15 | ≥4.5: 15, ≥4.0: 10, ≥3.5: 5 |
| **Price** | +10 | Competitive vs median |
| **Shipping** | +10 | Free shipping, fast delivery |

Base score: 100 + factor bonuses.

## Webhook Integration

### Shopify Webhooks

```typescript
// POST /webhooks/shopify/products/update
app.post('/webhooks/shopify/products/update', 
  verifyShopifyWebhook,
  async (req, res) => {
    await webhookHandler.handleShopify('product.update', req.body, shopDomain);
    res.sendStatus(200);
  }
);
```

### Supported Events

- `product.update` - Update listing price/inventory
- `product.delete` - Deactivate listing
- `inventory.update` - Real-time stock sync

## Error Handling

```typescript
import { 
  GatewayError, 
  ValidationError, 
  BackendError 
} from '@betterdata/commerce-gateway';

try {
  await cartHandler.addToCart(...);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.details);
  } else if (error instanceof BackendError) {
    console.log('Database error:', error.message);
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `SHOPIFY_WEBHOOK_SECRET` | No | For webhook verification |
| `SQUARE_WEBHOOK_SECRET` | No | For webhook verification |
| `MARKETPLACE_URL` | No | Base URL for listing links |

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  SearchQuery,
  SearchResult,
  RankedListing,
  Cart,
  CartItem,
  VendorCart,
  AnalyticsPeriod,
  ProviderAttribution,
} from '@betterdata/commerce-gateway';
```

## Testing

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch
```

## Next Steps

- [Vendor Integration Guide](./VENDOR_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
- [Launch Checklist](./LAUNCH_CHECKLIST.md)

