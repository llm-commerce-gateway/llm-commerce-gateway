# Connector status

**Canonical:** [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) (matches `src/`).  
**Capability matrix (BD / partners):** [CONNECTOR_CAPABILITY.md](./CONNECTOR_CAPABILITY.md).

| Connector | API | Catalog / cart | Order get |
| --- | --- | --- | --- |
| Shopify | Storefront GraphQL | Implemented | **Not supported** (Admin API required; methods throw) |
| WooCommerce | REST `wc/v3` | Implemented; cart is in-memory (no native cart API) | Implemented via REST orders |
| BigCommerce | REST v3 | Implemented | Implemented via REST orders |

This is **not** Shopify UCP (`/api/ucp/mcp`) or Shop MCP.

Older “skeleton / TODO / not yet implemented” language in this file was stale and has been removed.
