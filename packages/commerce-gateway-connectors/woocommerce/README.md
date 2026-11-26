# WooCommerce Connector for LLM Gateway

Official WooCommerce connector for the Better Data LLM Gateway.

## Installation

```bash
npm install @commercegateway/commerce-gateway-connectors
```

## Setup

1. Install WooCommerce on your WordPress site
2. Go to WooCommerce → Settings → Advanced → REST API
3. Click "Add Key"
4. Set permissions to "Read/Write"
5. Copy the Consumer Key and Consumer Secret

## Usage

```typescript
import { WooCommerceConnector } from '@commercegateway/commerce-gateway-connectors/woocommerce';
import { createGatewayMCPServer } from '@commercegateway/commerce-gateway/mcp';

const connector = new WooCommerceConnector({
  url: 'https://your-store.com',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
  version?: 'wc/v3', // Optional, defaults to 'wc/v3'
});

const server = createGatewayMCPServer({
  slug: 'your-store',
  brandName: 'Your Store',
  endpoint: 'https://example.com/mcp',
  protocol: 'mcp',
  capabilities: { catalog_search: true },
  backends: connector.getBackends(),
});
server.start();
```

## Configuration

```typescript
interface WooCommerceConnectorConfig {
  url: string; // Your WordPress site URL
  consumerKey: string; // WooCommerce REST API consumer key
  consumerSecret: string; // WooCommerce REST API consumer secret
  version?: string; // API version (default: 'wc/v3')
}
```

## Features

- ✅ Product catalog search
- ✅ Inventory checking
- ✅ Cart management
- ✅ Order creation
- ✅ Custom field support

## Rate Limiting

WooCommerce REST API has configurable rate limits. The connector respects these limits.

## Non-Goals (OSS v1.0.0)

- OAuth app creation or provisioning automation
- Webhooks or background job orchestration
- Managed data sync, ETL, or hosted services

## Support

For issues or questions, please open an issue on GitHub.

