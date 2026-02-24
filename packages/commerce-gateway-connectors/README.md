# @betterdata/commerce-gateway-connectors

[![npm](https://img.shields.io/npm/v/@betterdata/commerce-gateway-connectors)](https://www.npmjs.com/package/@betterdata/commerce-gateway-connectors)

Commerce platform adapters for `@betterdata/commerce-gateway`.

## Supported Platforms

- Shopify
- WooCommerce
- BigCommerce

## Install

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-connectors
```

## Subpath Imports

```ts
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors/shopify';
import { WooCommerceConnector } from '@betterdata/commerce-gateway-connectors/woocommerce';
import { BigCommerceConnector } from '@betterdata/commerce-gateway-connectors/bigcommerce';
```

## Connector Setup

### Shopify

```ts
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors/shopify';

const shopify = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01',
});
```

- Credentials: Storefront API token
- API version: `2024-01` default in connector
- Typical scopes: read products, inventory, and checkout/cart capabilities for your storefront

### WooCommerce

```ts
import { WooCommerceConnector } from '@betterdata/commerce-gateway-connectors/woocommerce';

const woocommerce = new WooCommerceConnector({
  url: 'https://your-store.com/',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
  version: 'wc/v3',
});
```

- Credentials: REST API consumer key + consumer secret
- API version: `wc/v3` default
- Permissions: read/write as needed for cart/order flows

### BigCommerce

```ts
import { BigCommerceConnector } from '@betterdata/commerce-gateway-connectors/bigcommerce';

const bigcommerce = new BigCommerceConnector({
  storeHash: process.env.BIGCOMMERCE_STORE_HASH!,
  accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN!,
  apiVersion: 'v3',
});
```

- Credentials: OAuth access token + store hash
- API version: `v3` default
- Permissions: catalog, inventory, carts/orders based on your use case

## Use with Gateway

```ts
import { LLMGateway } from '@betterdata/commerce-gateway';

const gateway = new LLMGateway({
  backends: shopify.getBackends(),
  session: { redis: { url: process.env.REDIS_URL! } },
});
```

## Writing a Custom Connector

You can skip this package and implement your own connector by returning `GatewayBackends`:

```ts
import type { GatewayBackends } from '@betterdata/commerce-gateway/backends';

export function createMyConnector(): GatewayBackends {
  return {
    products: myProductBackend,
    cart: myCartBackend,
    orders: myOrderBackend,
  };
}
```

## License

MIT
