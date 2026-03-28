# Commerce Gateway API Reference

Complete reference for all tools, protocol endpoints, and package exports.

---

## Commerce Tools

Defined in `packages/commerce-gateway/src/tools/builtInTools.ts`
and registered in `packages/commerce-gateway/src/mcp/tools/index.ts`.

| Tool | Required Fields | Optional Fields | Returns | Status |
|---|---|---|---|---|
| `search_products` | `query` | `shop_handle`, `filters`, `limit`, `offset` | `ProductResult[]` | ✅ Implemented |
| `get_product_details` | `product_id` | `shop_handle` | `ProductDetail` | ✅ Implemented |
| `check_availability` | `product_id` | `shop_handle`, `location_id`, `quantity` | `AvailabilityResult` | ✅ Implemented |
| `check_inventory` | `product_id` | `shop_handle`, `location_id` | `InventoryResult` | ✅ Implemented |
| `get_recommendations` | `context` | `shop_handle`, `limit` | `ProductResult[]` | ✅ Implemented |
| `add_to_cart` | `product_id`, `quantity` | `session_id`, `shop_handle`, `variant_id` | `CartResult` | ✅ Implemented |
| `create_order` | `items`, `customer` | `shop_handle`, `shipping_address`, `payment` | `OrderResult` | ✅ Implemented |
| `shop` | `query` | `shop_handle`, `intent` | `ShopResult` | ✅ Implemented |
| `get_shipment_status` | `order_id` | `shop_handle` | `ShipmentStatus` | ⚠️ Placeholder |
| `get_purchase_order_status` | `po_id` | `shop_handle` | `POStatus` | ⚠️ Placeholder |
| `get_trace_events` | `product_id` | `shop_handle`, `from_date`, `to_date` | `TraceEvent[]` | ⚠️ Placeholder |
| `get_demand_forecast` | `sku` | `shop_handle`, `horizon_days` | `ForecastResult` | ⚠️ Placeholder |

---

## Federation Tools

Defined in `packages/commerce-gateway/src/federation/tools/index.ts`.

| Tool | Required Fields | Optional Fields | Returns | Description |
|---|---|---|---|---|
| `shop_merchant` | `merchant_handle`, `tool`, `arguments` | — | `ToolResult` | Execute a tool call against a specific registered merchant |
| `discover_merchants` | — | `capability`, `handle`, `query`, `limit` | `MerchantResult[]` | Discover registered merchants by capability or handle |

### `shop_merchant` example

```json
{
  "tool": "shop_merchant",
  "arguments": {
    "merchant_handle": "acme-supplies",
    "tool": "search_products",
    "arguments": {
      "query": "safety gloves size L",
      "limit": 10
    }
  }
}
```

### `discover_merchants` example

```json
{
  "tool": "discover_merchants",
  "arguments": {
    "capability": "inventory",
    "query": "industrial supplies"
  }
}
```

---

## Registry MCP Tools

Defined in `packages/registry-mcp/src/tools/index.ts` (via `ALL_TOOLS`).

### Discovery tools (OSS — included in published package)

| Tool | Required Fields | Optional Fields | Returns |
|---|---|---|---|
| `registry_list_gateways` | — | `org_id`, `status`, `limit`, `cursor` | `Gateway[]` |
| `registry_get_gateway` | `gateway_id` | — | `Gateway` |
| `registry_get_usage` | `gateway_id` | `period`, `from`, `to` | `UsageStats` |

### Direct MCP server tools (also registered in `packages/registry-mcp/src/index.ts`)

| Tool | Description |
|---|---|
| `shop` | Route a shopping query through the registry to the best matching merchant |
| `price_check` | Check price for a product across registered merchants |
| `check_availability` | Check product availability across registered merchants |

### Admin tools (Cloud-only — NOT in published OSS package)

| Tool | Description |
|---|---|
| `registry_update_gateway` | Update gateway record (write operation) |
| `registry_get_audit_logs` | Retrieve audit log entries |
| Impersonation tools | SuperAdmin operations |

These are excluded from `@betterdata/registry-mcp` npm publish. See [BOUNDARY-MANAGEMENT.md](BOUNDARY-MANAGEMENT.md).

---

## Protocol HTTP Endpoints

Defined in `packages/commerce-gateway/src/core/protocol-endpoints.ts`.

| Method | Path | Body / Params | Response |
|---|---|---|---|
| `GET` | `/health` | — | `{ status: "ok", version: string }` |
| `POST` | `/search` | `{ query, filters?, shop_handle?, limit? }` | `ProductResult[]` |
| `GET` | `/product/:id` | path: `id` | `ProductDetail` |
| `GET` | `/product/gtin/:gtin` | path: `gtin` | `ProductDetail` |
| `POST` | `/pricing` | `{ product_id, quantity, shop_handle? }` | `PricingResult` |
| `POST` | `/availability` | `{ product_id, location_id?, shop_handle? }` | `AvailabilityResult` |

---

## Package Subpath Exports

### `@betterdata/commerce-gateway`

```typescript
// Main entry — gateway factory
import { createCommerceGateway, type GatewayConfig } from '@betterdata/commerce-gateway';

// MCP server
import { createMCPServer, type MCPServerConfig } from '@betterdata/commerce-gateway/mcp';

// Tool definitions and registry
import { builtInTools, registerTool } from '@betterdata/commerce-gateway/tools';

// Registry client and store interface
import {
  createRegistryClient,
  type RegistryStore,
  type RegistryAuthProvider,
  MemoryRegistryStore,
  StaticAuthProvider,
} from '@betterdata/commerce-gateway/registry';

// Federation layer
import { createFederationLayer, type FederationConfig } from '@betterdata/commerce-gateway/federation';

// Pluggable adapter interfaces
import {
  type AuthAdapter,
  type AuthResult,
  EnvAuthAdapter,
} from '@betterdata/commerce-gateway/adapters';

// Zod validation utilities
import { validateToolCall, validateToolResult } from '@betterdata/commerce-gateway/validation';

// Error types
import {
  GatewayError,
  ToolNotFoundError,
  AuthError,
  ConnectorError,
} from '@betterdata/commerce-gateway/errors';

// Observability hooks
import { createObserver, type GatewayEvent } from '@betterdata/commerce-gateway/observability';

// Catalog types (shared schema)
import type {
  ProductResult,
  ProductDetail,
  AvailabilityResult,
  InventoryResult,
  CartResult,
  OrderResult,
} from '@betterdata/commerce-gateway/catalog';
```

### `@betterdata/commerce-gateway-connectors`

```typescript
import { ShopifyConnector } from '@betterdata/commerce-gateway-connectors';
import { BigCommerceConnector } from '@betterdata/commerce-gateway-connectors';
import { WooCommerceConnector } from '@betterdata/commerce-gateway-connectors';
```

### `@betterdata/commerce-gateway-mcp`

```typescript
import { createMCPServer } from '@betterdata/commerce-gateway-mcp';
// Claude, ChatGPT, and Grok adapters via MCP/SSE transport
```

### `@betterdata/registry-mcp`

```typescript
import { createRegistryMCPServer } from '@betterdata/registry-mcp';
import { type RegistryStore, MemoryRegistryStore } from '@betterdata/registry-mcp';
import { type RegistryAuthProvider, StaticAuthProvider } from '@betterdata/registry-mcp';
```

---

## Pluggable Interface Reference

### AuthAdapter

```typescript
interface AuthAdapter {
  validateApiKey(apiKey: string): Promise<AuthResult | null>;
}

interface AuthResult {
  organizationId: string;
  organizationName?: string;
  tier?: string;
  permissions?: string[];
}

// Default implementation (reads from env vars)
class EnvAuthAdapter implements AuthAdapter {
  // Reads: COMMERCE_GATEWAY_API_KEY, COMMERCE_GATEWAY_ORG_ID, COMMERCE_GATEWAY_ORG_NAME
}
```

### RegistryStore

```typescript
interface RegistryStore {
  getGateway(id: string, orgId: string): Promise<Gateway | null>;
  listGateways(filters: GatewayFilters): Promise<Gateway[]>;
  discoverGateways(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
  resolveShop(handle: string): Promise<ShopResolution | null>;
  writeAuditEntry(entry: AuditEntry): Promise<void>;
}

// Default implementation (in-memory, zero dependencies)
class MemoryRegistryStore implements RegistryStore { ... }
```

### RegistryAuthProvider

```typescript
interface RegistryAuthContext {
  userId: string;
  organizationId: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: RegistryPermissions;
}

interface RegistryPermissions {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
}

interface RegistryAuthProvider {
  resolveContext(request: Request): Promise<RegistryAuthContext>;
  hasPermission(context: RegistryAuthContext, permission: keyof RegistryPermissions): boolean;
}

// Default implementation (single user, full read+write, no admin)
class StaticAuthProvider implements RegistryAuthProvider { ... }
```

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `TOOL_NOT_FOUND` | 404 | Requested tool is not registered |
| `INVALID_ARGUMENTS` | 400 | Tool arguments fail Zod schema validation |
| `AUTH_FAILED` | 401 | API key validation returned null |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `CONNECTOR_ERROR` | 502 | Upstream connector returned an error |
| `SHOP_NOT_FOUND` | 404 | Shop handle does not resolve to a registered merchant |
| `RATE_LIMITED` | 429 | Request exceeds rate limit |
| `INTERNAL_ERROR` | 500 | Unhandled internal error |
