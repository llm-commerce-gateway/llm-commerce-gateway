# Shopify Connector for LLM Gateway

Official Shopify connector for the Better Data LLM Gateway.

## Installation

```bash
npm install @betterdata/llm-gateway-shopify
```

## Setup

1. Create a Private App in your Shopify admin
2. Enable Storefront API access
3. Grant the following permissions:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_write_checkouts`
   - `read_products`
   - `read_inventory`

4. Copy the Storefront API access token

## Usage

```typescript
import { ShopifyConnector } from '@betterdata/llm-gateway-shopify';
import { LLMGateway } from '@betterdata/llm-gateway';

const connector = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01', // Optional, defaults to latest
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
});

gateway.start(3000);
```

## Configuration

```typescript
interface ShopifyConnectorConfig {
  domain: string; // e.g., 'your-store.myshopify.com'
  accessToken: string; // Storefront API access token
  apiVersion?: string; // Shopify API version (default: '2024-01')
  collections?: string[]; // Optional: Only include specific collections
  metafieldMap?: Record<string, string>; // Map custom metafields to product attributes
}
```

## Features

- ✅ Product search with natural language queries
- ✅ Real-time inventory (ATP) checking
- ✅ Draft order creation for checkout
- ✅ Collection-based filtering
- ✅ Tag-based discovery
- ✅ Variant support

## Rate Limiting

Shopify Storefront API has rate limits. The connector automatically handles rate limiting and will retry requests when appropriate.

## Non-Goals (OSS v1.0.0)

- OAuth app creation or provisioning automation
- Webhooks or background job orchestration
- Managed data sync, ETL, or hosted services

## Support

For issues or questions, please open an issue on GitHub.

