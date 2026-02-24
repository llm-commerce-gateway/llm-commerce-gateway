# Open Source (OSS) Documentation

This directory contains documentation for the open-source features of `@betterdata/commerce-gateway`.

## Overview

The LLM Gateway is an open-source package (MIT License) that provides a universal abstraction layer for building AI shopping assistants. All features documented here are available in the open-source package.

## Documentation Structure

### Core Documentation

- **[API.md](../API.md)** - Complete API reference for the gateway
- **[PROTOCOL.md](../PROTOCOL.md)** - Commerce Gateway Protocol specification
- **[DEPLOYMENT.md](../DEPLOYMENT.md)** - Deployment guides (Vercel, Railway, Docker, self-hosted)
- **[INTEGRATION_TUTORIALS.md](../INTEGRATION_TUTORIALS.md)** - Step-by-step integration guides
- **[CONNECTOR_INTERFACE.md](../CONNECTOR_INTERFACE.md)** - Building custom connectors
- **[PROTOCOL_COMPLIANCE.md](../PROTOCOL_COMPLIANCE.md)** - Protocol compliance checklist
- **[REGISTRY_INTEGRATION.md](../REGISTRY_INTEGRATION.md)** - Commerce Registry Protocol integration

### OSS-Specific Documentation

- **[CAPABILITIES.md](./CAPABILITIES.md)** - Capability discovery system (OSS mode)
- **[OSS_BOUNDARY.md](./OSS_BOUNDARY.md)** - OSS/proprietary import boundary
- **[INTERFACE_STABILITY.md](./INTERFACE_STABILITY.md)** - API stability guarantees and semantic versioning
- **[TELEMETRY.md](./TELEMETRY.md)** - Optional, opt-in telemetry disclosure
- **[OSS_CLOUD_FEDERATION_GUIDE.md](./OSS_CLOUD_FEDERATION_GUIDE.md)** - OSS vs Cloud feature guide
- **[CLOUD_FEDERATION_OSS_ANALYSIS.md](./CLOUD_FEDERATION_OSS_ANALYSIS.md)** - Technical analysis of OSS/Cloud separation

## What's Included in OSS

✅ **Core Gateway** - Universal LLM abstraction layer  
✅ **Federation Hub** - Multi-merchant marketplace support  
✅ **MCP Integration** - Claude Desktop support  
✅ **OpenAI/Grok Adapters** - ChatGPT and Grok integration  
✅ **Backend Interfaces** - Product, Cart, Order backends  
✅ **Session Management** - Redis-based sessions  
✅ **Registry Client** - Commerce Registry Protocol client  
✅ **Capability Discovery** - Runtime feature detection (OSS mode)  

## What's NOT Included in OSS

❌ **Better Data Cloud Providers** - Managed registry/discovery/analytics  
❌ **Marketplace Features** - Multi-vendor marketplace with database  
❌ **Partner Portal** - Better Data partner management  

For Cloud/proprietary features, see [../cloud/README.md](../cloud/README.md).

## Quick Start

```bash
npm install @betterdata/commerce-gateway
```

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';

const gateway = new LLMGateway({
  backends: {
    products: myProductBackend,
    cart: myCartBackend,
    orders: myOrderBackend,
  },
});

await gateway.start(3000);
```

## Contributing

See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

MIT © [Better Data](https://betterdata.com)
