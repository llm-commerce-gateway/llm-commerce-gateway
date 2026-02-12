# @betterdata/commerce-gateway-shopify

> **Shopify Connector** — Connect your Shopify store to the Better Data LLM Gateway using the Storefront API. Search products, manage carts, and create checkouts from Claude, ChatGPT, or any LLM.

## Install

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-shopify
```

## Usage

Register the connector with `LLMGateway` (or `createGateway`):

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { ShopifyConnector } from '@betterdata/commerce-gateway-shopify';

const connector = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01', // optional, default
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
  llmProviders: ['anthropic', 'openai'],
});

await gateway.start(3000);
```

### Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `domain` | Yes | — | Shopify store domain (e.g. `your-store.myshopify.com`) |
| `accessToken` | Yes | — | Storefront API access token |
| `apiVersion` | No | `2024-01` | Shopify API version |

## Non-goals

This package does **not**:

- Require a Better Data account — works fully self-hosted
- Use the Admin API — Storefront API only (public storefront)
- Support order retrieval — requires Admin API (not in Storefront)
- Replace your checkout — integrates with Shopify Checkout

## License

MIT
