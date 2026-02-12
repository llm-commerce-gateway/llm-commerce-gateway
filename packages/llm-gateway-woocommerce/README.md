# @betterdata/commerce-gateway-woocommerce

> **WooCommerce Connector** — Connect your WooCommerce store to the Better Data LLM Gateway. Search products, manage carts, and create orders from Claude, ChatGPT, or any LLM.

## Install

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-woocommerce
```

## Usage

Register the connector with `LLMGateway`:

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { WooCommerceConnector } from '@betterdata/commerce-gateway-woocommerce';

const connector = new WooCommerceConnector({
  url: 'https://your-store.com/',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
  version: 'wc/v3', // optional, default
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
| `url` | Yes | — | WordPress site URL (trailing slash recommended) |
| `consumerKey` | Yes | — | WooCommerce REST API consumer key |
| `consumerSecret` | Yes | — | WooCommerce REST API consumer secret |
| `version` | No | `wc/v3` | API version |

## Non-goals

This package does **not**:

- Require a Better Data account — works fully self-hosted
- Use WooCommerce's native cart API — uses in-memory cart (replace with Redis/DB for production)
- Replace your checkout — integrates with WooCommerce Orders API

## License

MIT
