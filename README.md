# LLM Commerce Gateway

**An open protocol for connecting LLMs to commerce systems.**

LLMs are becoming operational agents. But they have no standard way to talk to commerce systems — inventory, pricing, orders, shipments. Every team builds the same bespoke integrations, over and over, against every storefront and ERP independently.

Commerce Gateway is the open layer that fixes that.

[![npm](https://img.shields.io/npm/v/@betterdata/commerce-gateway)](https://www.npmjs.com/package/@betterdata/commerce-gateway)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/commercegateway)](https://discord.gg/commercegateway)

---

## What It Is

Commerce Gateway is a federated, protocol-level interface that exposes commerce operations as LLM-native tools via MCP (Model Context Protocol) and SSE transport.

Any LLM — Claude, ChatGPT, Grok, or any agent using the MCP standard — can search products, check inventory, price orders, create purchases, and track shipments through a single open tool interface, connected to any storefront or commerce backend.

```
LLM (Claude / ChatGPT / Grok)
         ↓  MCP / SSE
Commerce Gateway (this package)
         ↓  adapter
Shopify / BigCommerce / WooCommerce / ERP / custom
```

The gateway handles federation, tool dispatch, auth, observability, and the protocol translation layer. You bring the connector for your commerce backend.

---

## Packages

| Package | Description |
|---|---|
| [`@betterdata/commerce-gateway`](packages/commerce-gateway) | Core gateway — tools, sessions, adapters, protocol |
| [`@betterdata/commerce-gateway-mcp`](packages/commerce-gateway-mcp) | MCP server for gateway operations |
| [`@betterdata/registry-mcp`](packages/registry-mcp) | MCP server for merchant registry discovery |
| [`@betterdata/commerce-gateway-connectors`](packages/commerce-gateway-connectors) | Shopify, BigCommerce, WooCommerce connectors |

---

## Quickstart

```bash
npm install @betterdata/commerce-gateway @betterdata/commerce-gateway-mcp
```

Create a gateway:

```typescript
import { createCommerceGateway } from '@betterdata/commerce-gateway';
import { createMCPServer } from '@betterdata/commerce-gateway-mcp';

const gateway = createCommerceGateway({
  // Optional: inject your own auth adapter
  // Defaults to EnvAuthAdapter (reads COMMERCE_GATEWAY_API_KEY)
  authAdapter: new MyAuthAdapter(),

  // Optional: inject your own registry store
  // Defaults to MemoryRegistryStore
  registryStore: new MyRegistryStore(),
});

// Start the MCP server — LLMs connect via SSE transport
const server = createMCPServer({ gateway });
await server.listen({ port: 3000 });
```

Connect a storefront:

```typescript
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors';

gateway.registerConnector(
  new ShopifyConnector({
    shopDomain: 'my-shop.myshopify.com',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  })
);
```

Now any MCP-compatible LLM can call:

```json
{
  "tool": "search_products",
  "arguments": {
    "query": "wireless headphones under $100",
    "shop_handle": "my-shop"
  }
}
```

---

## Tool Surface

### Commerce Tools

| Tool | Description |
|---|---|
| `search_products` | Search products by query, filters, shop |
| `get_product_details` | Get full product record by ID |
| `check_availability` | Check product availability at location |
| `check_inventory` | Check stock levels across locations |
| `get_recommendations` | Get product recommendations |
| `add_to_cart` | Add item to active session cart |
| `create_order` | Create a purchase order |
| `get_shipment_status` | Track shipment status |
| `get_purchase_order_status` | Check PO status |
| `get_trace_events` | Get supply chain trace events |
| `get_demand_forecast` | Get demand forecast for SKU |

### Federation Tools

| Tool | Description |
|---|---|
| `shop_merchant` | Execute a tool call against a specific registered merchant |
| `discover_merchants` | Discover registered merchants by capability or handle |

### Registry Tools

| Tool | Description |
|---|---|
| `registry_list_gateways` | List registered gateways |
| `registry_get_gateway` | Get gateway details |
| `registry_update_gateway` | Update gateway record |
| `registry_get_usage` | Get usage stats for a gateway |
| `registry_get_audit_logs` | Retrieve audit log entries |

---

## Protocol Endpoints

The gateway exposes a standard HTTP protocol surface:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/search` | Product search |
| `GET` | `/product/:id` | Product by ID |
| `GET` | `/product/gtin/:gtin` | Product by GTIN |
| `POST` | `/pricing` | Pricing query |
| `POST` | `/availability` | Availability check |

---

## Package Subpath Exports

`@betterdata/commerce-gateway` exposes focused subpath exports:

```typescript
import { createCommerceGateway } from '@betterdata/commerce-gateway';
import { createMCPServer }        from '@betterdata/commerce-gateway/mcp';
import { builtInTools }           from '@betterdata/commerce-gateway/tools';
import { createRegistryClient }   from '@betterdata/commerce-gateway/registry';
import { createFederationLayer }  from '@betterdata/commerce-gateway/federation';

// Lower-level access
import type { AuthAdapter }       from '@betterdata/commerce-gateway/adapters';
import { validateToolCall }       from '@betterdata/commerce-gateway/validation';
import { GatewayError }           from '@betterdata/commerce-gateway/errors';
import { createObserver }         from '@betterdata/commerce-gateway/observability';
```

---

## Pluggable Interfaces

Commerce Gateway is designed around two pluggable interfaces that keep the core clean and the proprietary implementations separate.

### AuthAdapter

```typescript
import type { AuthAdapter, AuthResult } from '@betterdata/commerce-gateway/adapters';

interface AuthAdapter {
  validateApiKey(apiKey: string): Promise<AuthResult | null>;
}

interface AuthResult {
  organizationId: string;
  organizationName?: string;
  tier?: string;
  permissions?: string[];
}
```

Default: `EnvAuthAdapter` reads `COMMERCE_GATEWAY_API_KEY` and `COMMERCE_GATEWAY_ORG_ID` from environment variables. No external dependency required.

### RegistryStore

```typescript
import type { RegistryStore } from '@betterdata/commerce-gateway/registry';

interface RegistryStore {
  getGateway(id: string, orgId: string): Promise<Gateway | null>;
  listGateways(filters: GatewayFilters): Promise<Gateway[]>;
  discoverGateways(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
  resolveShop(handle: string): Promise<ShopResolution | null>;
  writeAuditEntry(entry: AuditEntry): Promise<void>;
}
```

Default: `MemoryRegistryStore` — in-memory, zero dependencies, suitable for self-hosted and development use.

---

## LLM Adapter Support

| LLM | Transport | Package |
|---|---|---|
| Claude (Anthropic) | Remote MCP / SSE | `@betterdata/commerce-gateway-mcp` |
| ChatGPT (OpenAI) | Remote MCP / SSE | `@betterdata/commerce-gateway-mcp` |
| Grok (xAI) | Remote MCP / SSE | `@betterdata/commerce-gateway-mcp` |
| Custom agents | SSE transport | `@betterdata/commerce-gateway-mcp` |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│            LLM Agent (Claude / GPT / Grok)      │
└──────────────────┬──────────────────────────────┘
                   │  MCP / SSE
┌──────────────────▼──────────────────────────────┐
│           Commerce Gateway Runtime              │
│  Tool dispatch · Auth · Session · Observability │
└──────┬───────────────────────────┬──────────────┘
       │ AuthAdapter               │ RegistryStore
┌──────▼──────┐             ┌──────▼──────────────┐
│  Auth layer │             │  Merchant Registry   │
│  (pluggable)│             │  (pluggable)         │
└─────────────┘             └──────────────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│              Connector Layer                    │
│   Shopify · BigCommerce · WooCommerce · Custom  │
└─────────────────────────────────────────────────┘
```

---

## OSS Boundary

Commerce Gateway runtime packages are Apache-2.0 licensed. The protocol spec package remains MIT. The following are open source:

- Core gateway runtime and tool dispatch
- MCP / SSE transport layer
- All built-in tool definitions and Zod schemas
- Federation layer (`shop_merchant`, `discover_merchants`)
- Registry protocol (`RegistryStore` interface + `MemoryRegistryStore`)
- Auth adapter interface + `EnvAuthAdapter`
- Shopify, BigCommerce, WooCommerce connectors
- `commerce-registry-protocol` spec

The following are proprietary to Better Data's hosted platform:

- `PrismaRegistryStore` — database-backed registry (requires Better Data platform)
- `SecurityAuthProvider` — RBAC-backed auth (requires Better Data platform)
- Admin registry tools (impersonation, audit export, SuperAdmin writes)
- Hosted gateway infrastructure and multi-tenant orchestration
- AI Commerce Intelligence layer

See [BOUNDARY-MANAGEMENT.md](BOUNDARY-MANAGEMENT.md) for the full specification.

---

## Self-Hosting

Commerce Gateway runs anywhere Node.js runs. The default `MemoryRegistryStore` and `EnvAuthAdapter` have zero external dependencies.

```bash
# Minimal self-hosted setup
git clone https://github.com/betterdataco/llm-commerce-gateway
cd llm-commerce-gateway
pnpm install
pnpm build

# Configure
export COMMERCE_GATEWAY_API_KEY=your-key
export COMMERCE_GATEWAY_ORG_ID=your-org

# Start
pnpm start
```

For production self-hosting with a persistent registry, implement `RegistryStore` against your own database. The interface is fully documented in [packages/registry-mcp/src/store/interfaces.ts](packages/registry-mcp/src/store/interfaces.ts).

---

## Built With Commerce Gateway

Commerce Gateway is the open protocol that powers the [Better Data](https://betterdata.co) Commerce Chain Optimization platform. The hosted platform adds AI optimization, multi-tenant orchestration, and the full registry infrastructure on top of this runtime.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

We respond to every issue within 48 hours.

---

## License

Gateway packages: Apache-2.0 — see [LICENSE](LICENSE).  
Protocol spec (`commerce-registry-protocol`): MIT — see `commerce-registry-protocol/LICENSE`.

---

*Commerce Gateway is maintained by [Better Data, Inc.](https://betterdata.co)*

