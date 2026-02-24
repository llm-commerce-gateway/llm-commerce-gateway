# @betterdata/commerce-gateway

[![npm](https://img.shields.io/npm/v/@betterdata/commerce-gateway)](https://www.npmjs.com/package/@betterdata/commerce-gateway)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Core routing engine for conversational commerce. It normalizes tool execution across LLM providers and routes those tools to your real commerce backend.

## Install

```bash
npm install @betterdata/commerce-gateway
```

## Minimal TypeScript Setup

```ts
import { LLMGateway } from '@betterdata/commerce-gateway';
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors/shopify';

const connector = new ShopifyConnector({
  domain: process.env.SHOPIFY_STORE_DOMAIN!,
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01',
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
  session: { redis: { url: process.env.REDIS_URL! } },
  llmProviders: ['openai', 'anthropic'],
});

await gateway.start(3000);
```

## Provider Setup

### OpenAI

```ts
import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';

const openai = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  backends: connector.getBackends(),
  tools: ['search_products', 'get_product_details', 'check_inventory'],
});
```

### Anthropic (MCP)

```ts
import { MCPServer } from '@betterdata/commerce-gateway/mcp';

const mcp = new MCPServer({
  backends: connector.getBackends(),
  tools: ['search_products', 'get_product_details', 'check_inventory'],
  name: 'my-store',
});

mcp.start();
```

## Connector Setup (Shopify)

```ts
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors/shopify';

const connector = new ShopifyConnector({
  domain: 'your-store.myshopify.com',
  accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: '2024-01',
});
```

## First Query

After starting `LLMGateway`, call the built-in tool execution endpoint:

```bash
curl -X POST http://localhost:3000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"toolName":"search_products","input":{"query":"moisturizer under $50"}}'
```

## Configuration Reference

| Option | Type | Default | Notes |
|---|---|---|---|
| `backends` | `GatewayBackends` | required | Product/cart/order backend implementations |
| `session.redis.url` | `string` | required | Redis URL for sessions |
| `session.ttl` | `number` | `604800` | Session TTL in seconds (7 days) |
| `llmProviders` | `LLMProvider[]` | unset | Any of `anthropic`, `openai`, `grok`, `google` |
| `port` | `number` | `3000` | HTTP server port |
| `host` | `string` | `0.0.0.0` | HTTP bind host |
| `basePath` | `string` | `/api` | API route prefix |
| `cors` | `boolean \| { origins: string[] }` | `false` | CORS enable/config |
| `rateLimits` | `RateLimitConfig` | unset | Request throttling |
| `auth` | `AuthConfig` | unset | API key/OAuth/JWT controls |
| `telemetry.enabled` | `boolean` | `false` | Optional aggregate telemetry |

## Error Handling Patterns

```ts
try {
  const response = await fetch('http://localhost:3000/api/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName: 'get_product_details',
      input: { productId: 'prod_123' },
    }),
  });

  const payload = await response.json();
  if (!payload.success) {
    console.error('Gateway tool failed:', payload.error);
  }
} catch (error) {
  console.error('Network or gateway startup error:', error);
}
```

Use exported error helpers for application-level handling:

```ts
import { isGatewayError, safeErrorMessage } from '@betterdata/commerce-gateway/errors';
```

## Docs

- Quickstart: `/docs/quickstart.md`
- MCP package: `/packages/commerce-gateway-mcp/README.md`
- Connectors: `/packages/commerce-gateway-connectors/README.md`
