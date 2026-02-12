# @betterdata/commerce-gateway-bigcommerce

> **BigCommerce Connector** — Connect your BigCommerce store to the Better Data LLM Gateway. Search products, manage carts, and create orders from Claude, ChatGPT, or any LLM.

## Install

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-bigcommerce
```

## Usage

Register the connector with `LLMGateway`:

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { BigCommerceConnector } from '@betterdata/commerce-gateway-bigcommerce';

const connector = new BigCommerceConnector({
  storeHash: process.env.BIGCOMMERCE_STORE_HASH!,
  accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN!,
  apiVersion: 'v3', // optional, default
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
| `storeHash` | Yes | — | BigCommerce store hash |
| `accessToken` | Yes | — | OAuth access token |
| `apiVersion` | No | `v3` | API version |

## Non-goals

This package does **not**:

- Require a Better Data account — works fully self-hosted
- Support multi-channel without additional setup
- Replace your checkout — integrates with BigCommerce Orders API

## License

MIT
