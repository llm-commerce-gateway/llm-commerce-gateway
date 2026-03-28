# Contributing to Commerce Gateway

Thank you for your interest in contributing. Commerce Gateway is open infrastructure — contributions from outside Better Data make the protocol more robust, better tested, and more widely adopted.

This document replaces the minimal CONTRIBUTING.md. Please read it before opening a pull request.

---

## What We're Looking For

The highest-value contributions, in priority order:

1. **Connectors** — New storefront or commerce backend connectors. If it exposes product, inventory, order, or pricing data, it can be a connector. WooCommerce, BigCommerce, and Shopify ship with the package — Magento, SAP Commerce, Salesforce Commerce Cloud, custom ERPs are all welcome.
2. **Tool implementations** — Several tools in the built-in tool set are currently placeholders (`get_shipment_status`, `get_purchase_order_status`, `get_trace_events`, `get_demand_forecast`). Implementing these with real schemas and handler logic is high-value.
3. **Protocol improvements** — Changes to `commerce-registry-protocol` that improve federation, discovery, or the HTTP protocol surface.
4. **LLM adapter improvements** — Better handling of MCP/SSE edge cases, streaming improvements, error propagation across the transport layer.
5. **Bug reports and test coverage** — Detailed, reproducible issues. Tests for edge cases in tool dispatch, auth, and federation.

---

## Development Setup

```bash
git clone https://github.com/betterdataco/llm-commerce-gateway.git
cd llm-commerce-gateway
pnpm install
pnpm build
pnpm test
```

**Prerequisites:**
- Node.js 18.0+
- pnpm 8.0+

---

## Before You Start

### For small changes (docs, bug fixes, tool schema fixes)
Open a pull request directly. No issue required.

### For new connectors
Open an issue first using the connector proposal template. Describe the commerce system, the available API, and which tools you plan to support. This avoids duplicated effort and ensures the connector fits the architecture.

### For protocol changes to `commerce-registry-protocol`
Open a GitHub Discussion before any code. Protocol changes affect all implementors — they need public review before implementation begins. Breaking protocol changes require a 30-day comment period.

### For new tool definitions
Check `packages/commerce-gateway/src/tools/builtInTools.ts` first. If the tool concept already exists as a placeholder, implement the handler rather than creating a parallel tool. If it's genuinely new, open an issue to discuss the schema before building.

---

## Building a Connector

Connectors implement the `CommerceConnector` interface from `@betterdata/commerce-gateway`.

### File location
```
packages/commerce-gateway-connectors/src/connectors/{platform}/
  index.ts        ← connector implementation
  types.ts        ← platform-specific types
  README.md       ← connector-specific docs
```

### Connector requirements

A connector must implement:
- `search(query, filters)` — product search
- `getProduct(id)` — product by ID
- `checkAvailability(productId, locationId?)` — availability
- `checkInventory(productId, locationId?)` — stock levels

Optional (implement if the platform supports it):
- `addToCart(sessionId, item)` — cart management
- `createOrder(order)` — order creation
- `getOrderStatus(orderId)` — order status

All methods must return types from `@betterdata/commerce-gateway/catalog`. Do not return platform-native types — map to the open schema.

### Connector review criteria

- Does this use Apache-2.0-compatible or otherwise permissive dependencies?
- Are platform API credentials handled only via constructor config (not hardcoded, not env-var-dependent in the connector itself)?
- Does it map platform data correctly to the open catalog types?
- Does it handle rate limiting and error cases gracefully?
- Does the README include a working quickstart?

---

## Implementing Placeholder Tools

Several tools exist in `builtInTools.ts` with schemas but no handler implementations:

| Tool | Schema | Handler |
|---|---|---|
| `get_shipment_status` | ✅ | ❌ placeholder |
| `get_purchase_order_status` | ✅ | ❌ placeholder |
| `get_trace_events` | ✅ | ❌ placeholder |
| `get_demand_forecast` | ✅ | ❌ placeholder |

To implement a handler:
1. Read the existing Zod schema in `builtInTools.ts` — do not change it without a discussion
2. Add the handler in `packages/commerce-gateway/src/mcp/tools/`
3. Wire it into the tool registry in `packages/commerce-gateway/src/mcp/tools/index.ts`
4. Add integration tests

---

## Code Style

- TypeScript strict mode — no `any` types
- Biome for formatting and linting: `pnpm lint` / `pnpm lint:fix`
- Explicit return types on all exported functions
- All public exports documented with JSDoc

---

## Branch Naming

```
fix/{short-description}
feat/{short-description}
connector/{platform-name}
tool/{tool-name}
protocol/{change-description}
docs/{short-description}
```

## Commit Style

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(connector): add Magento 2 connector
fix(mcp): handle SSE reconnection on transport close
tool(shipment): implement get_shipment_status handler
protocol: add capability negotiation to registry spec
docs(readme): update quickstart for MCP v2
```

---

## Pull Request Checklist

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] New behavior has test coverage
- [ ] No `@repo/*` imports added to any OSS package
- [ ] If adding a connector: README.md included in connector directory
- [ ] If changing a tool schema: existing tests updated
- [ ] If changing a public API: JSDoc updated
- [ ] CHANGELOG.md entry added under `[Unreleased]`

---

## OSS Boundary Rule

**The single most important contribution rule:**

OSS packages (`commerce-gateway`, `commerce-gateway-mcp`, `registry-mcp`, `commerce-gateway-connectors`, `commerce-registry-protocol`) must never import from `@repo/*` packages.

`@repo/*` is the internal namespace for Better Data's proprietary platform code. If your contribution requires access to a database, RBAC system, or platform infrastructure, it belongs on the proprietary side — not in the OSS packages.

If you're unsure which side something belongs on, read [BOUNDARY-MANAGEMENT.md](BOUNDARY-MANAGEMENT.md) or open a GitHub Discussion.

CI enforces this automatically. PRs that introduce `@repo/*` imports in OSS packages will fail.

---

## Response Times

We commit to:

- **Issues:** First response within 48 hours
- **Pull requests:** First review within 48 hours
- **Protocol discussions:** Response within 48 hours, resolution timeline communicated

---

## Security Issues

Do NOT open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).

---

## Code of Conduct

Be direct. Be specific. Be respectful. Critique code and design, not people.

---

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0 for gateway runtime packages and MIT for `commerce-registry-protocol`, based on the package you modify.

---

*Commerce Gateway is maintained by [Better Data, Inc.](https://betterdata.co)*
