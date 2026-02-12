# LLM Gateway Connectors

Pre-built connectors for popular e-commerce platforms.

## Available Connectors

### Shopify

```bash
npm install @betterdata/commerce-gateway-shopify
```

```typescript
import { ShopifyConnector } from '@betterdata/commerce-gateway-shopify';
import { LLMGateway } from '@betterdata/commerce-gateway';

const connector = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01',
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
});
```

## Packaging Note (OSS)

Connector packages are published as separate npm packages:

- `@betterdata/commerce-gateway-shopify`
- `@betterdata/commerce-gateway-bigcommerce`
- `@betterdata/commerce-gateway-woocommerce`

This directory contains shared source. Each published connector must have its own
package metadata and publishable entrypoints.

### BigCommerce

```bash
npm install @betterdata/commerce-gateway-bigcommerce
```

```typescript
import { BigCommerceConnector } from '@betterdata/commerce-gateway-bigcommerce';
import { LLMGateway } from '@betterdata/commerce-gateway';

const connector = new BigCommerceConnector({
  storeHash: process.env.BIGCOMMERCE_STORE_HASH!,
  accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN!,
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
});
```

### WooCommerce

```bash
npm install @betterdata/commerce-gateway-woocommerce
```

```typescript
import { WooCommerceConnector } from '@betterdata/commerce-gateway-woocommerce';
import { LLMGateway } from '@betterdata/commerce-gateway';

const connector = new WooCommerceConnector({
  url: 'https://your-store.com',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
});
```

## Building Custom Connectors

See [CONNECTOR_INTERFACE.md](../llm-gateway/docs/CONNECTOR_INTERFACE.md) for documentation on building your own connector.

