# Integration Tutorials

Step-by-step guides for integrating the Better Data LLM Gateway with various platforms and use cases.

## Table of Contents

1. [Quick Start with Shopify](#quick-start-with-shopify)
2. [Custom Backend Integration](#custom-backend-integration)
3. [Claude MCP Integration](#claude-mcp-integration)
4. [OpenAI Functions Integration](#openai-functions-integration)
5. [Multi-Vendor Marketplace](#multi-vendor-marketplace)
6. [Adding Custom Tools](#adding-custom-tools)

---

## Quick Start with Shopify

### Prerequisites

- Shopify store
- Storefront API access token
- Node.js 18+

### Step 1: Install

```bash
npm install @betterdata/commerce-gateway
```

### Step 2: Create Gateway

```typescript
// gateway.ts
import { LLMGateway } from '@betterdata/commerce-gateway';
import { ShopifyBackend } from '@betterdata/commerce-gateway-shopify';

const shopify = new ShopifyBackend({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
});

const gateway = new LLMGateway({
  backends: {
    products: shopify,
    cart: shopify,
    orders: shopify,
  },
});

await gateway.start(3000);
console.log('🚀 Gateway running on http://localhost:3000');
```

### Step 3: Test

```bash
curl http://localhost:3000/health
```

### Step 4: Connect to Claude

See [Claude MCP Integration](#claude-mcp-integration) below.

---

## Custom Backend Integration

### Step 1: Implement Backend Interfaces

```typescript
// my-backend.ts
import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  Product,
  ProductSearchResult,
} from '@betterdata/commerce-gateway';

export class MyProductBackend implements ProductBackend {
  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    // Call your API or database
    const results = await fetch(`https://api.example.com/products?q=${query}`);
    const data = await results.json();
    
    return {
      products: data.items.map(this.transformProduct),
      total: data.total,
      hasMore: data.hasMore,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    const response = await fetch(`https://api.example.com/products/${productId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return this.transformProduct(data);
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    // Implementation
    return [];
  }

  private transformProduct(item: any): Product {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: {
        amount: item.price,
        currency: 'USD',
      },
      images: item.images?.map((img: any) => ({
        url: img.url,
        alt: img.alt,
      })),
    };
  }
}

export class MyCartBackend implements CartBackend {
  // Implement cart methods
}

export class MyOrderBackend implements OrderBackend {
  // Implement order methods
}
```

### Step 2: Use in Gateway

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { MyProductBackend, MyCartBackend, MyOrderBackend } from './my-backend';

const gateway = new LLMGateway({
  backends: {
    products: new MyProductBackend(),
    cart: new MyCartBackend(),
    orders: new MyOrderBackend(),
  },
});

await gateway.start(3000);
```

---

## Claude MCP Integration

### Step 1: Install Claude Desktop

Download and install [Claude Desktop](https://claude.ai/download).

### Step 2: Configure MCP Server

Create `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commerce-gateway": {
      "command": "node",
      "args": [
        "/path/to/your/gateway/dist/mcp/index.js"
      ],
      "env": {
        "GATEWAY_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Step 3: Start Gateway

```bash
node gateway.js
```

### Step 4: Test in Claude

Open Claude Desktop and try:

```
@shop search for red running shoes
```

Claude will use the gateway's MCP tools to search your catalog.

---

## OpenAI Functions Integration

### Step 1: Create OpenAI-Compatible Server

```typescript
// openai-server.ts
import { LLMGateway } from '@betterdata/commerce-gateway';
import { createOpenAIAdapter } from '@betterdata/commerce-gateway/openai';

const gateway = new LLMGateway({
  backends: {
    // Your backends
  },
});

const adapter = createOpenAIAdapter(gateway);

// Expose as OpenAI-compatible endpoint
import express from 'express';
const app = express();

app.post('/v1/chat/completions', async (req, res) => {
  const response = await adapter.handleRequest(req.body);
  res.json(response);
});

app.listen(3000);
```

### Step 2: Configure ChatGPT

In your ChatGPT plugin configuration:

```json
{
  "api_url": "https://your-gateway.com/v1/chat/completions",
  "functions": [
    "search_products",
    "get_product_details",
    "add_to_cart"
  ]
}
```

---

## Multi-Vendor Marketplace

### Step 1: Setup Federation Hub

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: {
    type: 'memory', // Or 'betterdata' for cloud registry
  },
  discovery: {
    type: 'tag-based',
  },
});

// Register multiple gateways
await hub.registerGateway({
  id: 'shopify-store-1',
  name: 'Store 1',
  endpoint: 'https://store1.example.com',
  tags: ['footwear', 'athletic'],
});

await hub.registerGateway({
  id: 'shopify-store-2',
  name: 'Store 2',
  endpoint: 'https://store2.example.com',
  tags: ['apparel', 'casual'],
});
```

### Step 2: Search Across All Vendors

```typescript
// Search all vendors
const results = await hub.searchProducts({
  query: 'running shoes',
  scope: { type: 'global' },
});

// Search specific vendor
const vendorResults = await hub.searchProducts({
  query: 'running shoes',
  scope: {
    type: 'vendor',
    vendorId: 'shopify-store-1',
  },
});
```

---

## Adding Custom Tools

### Step 1: Define Tool Schema

```typescript
// custom-tool.ts
import { z } from 'zod';
import type { ToolHandler } from '@betterdata/commerce-gateway';

const CustomToolSchema = z.object({
  action: z.enum(['check_stock', 'get_reviews']),
  productId: z.string(),
});

export const customTool = {
  name: 'custom_product_action',
  description: 'Perform custom actions on products',
  schema: CustomToolSchema,
  handler: async (input: z.infer<typeof CustomToolSchema>) => {
    // Your custom logic
    if (input.action === 'check_stock') {
      return { inStock: true, quantity: 10 };
    }
    return { reviews: [] };
  },
};
```

### Step 2: Register Tool

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { customTool } from './custom-tool';

const gateway = new LLMGateway({
  backends: {
    // Your backends
  },
  tools: [customTool], // Add custom tool
});

await gateway.start(3000);
```

### Step 3: Use in LLM

The tool will automatically be available to all connected LLMs (Claude, ChatGPT, etc.).

---

## Next Steps

- [API Documentation](./API.md)
- [Protocol Specification](./PROTOCOL.md)
- [Deployment Guides](./DEPLOYMENT.md)
- [Connector Interface](./CONNECTOR_INTERFACE.md)

