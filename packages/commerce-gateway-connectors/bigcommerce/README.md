# BigCommerce Connector for LLM Gateway

Official BigCommerce connector for the Better Data LLM Gateway.

## Installation

```bash
npm install @betterdata/llm-gateway-bigcommerce
```

## Setup

1. Create an API account in your BigCommerce admin
2. Generate API credentials (OAuth token)
3. Copy your store hash and access token

## Usage

```typescript
import { BigCommerceConnector } from '@betterdata/llm-gateway-bigcommerce';
import { LLMGateway } from '@betterdata/llm-gateway';

const connector = new BigCommerceConnector({
  storeHash: process.env.BIGCOMMERCE_STORE_HASH!,
  accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN!,
});

const gateway = new LLMGateway({
  backends: connector.getBackends(),
});

gateway.start(3000);
```

## Configuration

```typescript
interface BigCommerceConnectorConfig {
  storeHash: string; // Your BigCommerce store hash
  accessToken: string; // OAuth access token
  apiVersion?: string; // API version (default: 'v3')
}
```

## Features

- ✅ Product catalog search
- ✅ Inventory management
- ✅ Cart API integration
- ✅ Order creation
- ✅ Category filtering

## Rate Limiting

BigCommerce API has rate limits. The connector respects these limits and includes retry logic.

## Non-Goals (OSS v1.0.0)

- OAuth app creation or provisioning automation
- Webhooks or background job orchestration
- Managed data sync, ETL, or hosted services

## Support

For issues or questions, please open an issue on GitHub.

