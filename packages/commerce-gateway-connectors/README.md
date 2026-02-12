# @betterdata/commerce-gateway-connectors

Commerce platform connectors for the [LLM Commerce Gateway](https://github.com/betterdataco/llm-commerce-gateway).

## Supported Platforms

- **Shopify** — Products, inventory, orders via Storefront API
- **BigCommerce** — Products, inventory, orders
- **WooCommerce** — Products, inventory, orders

## Install

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-connectors
```

## Usage

```typescript
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors/shopify';
import { createGateway } from '@betterdata/commerce-gateway';

const connector = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
  apiVersion: '2024-01',
});

const gateway = createGateway({
  backends: connector.getBackends(),
});
```

Or use the main export:

```typescript
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors';
```

## License

MIT
