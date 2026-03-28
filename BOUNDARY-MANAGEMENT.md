# OSS / Proprietary Boundary Management

This document defines exactly what is open source in the Commerce Gateway project, what is proprietary to Better Data's hosted platform, and how the boundary is maintained over time.

---

## The Principle

Commerce Gateway is the **protocol and runtime**. Better Data is the **hosted infrastructure and intelligence layer** built on top of it.

The open protocol exists so any team can connect any LLM to any commerce system without building bespoke integrations from scratch. It has no dependency on Better Data's hosted platform. It runs without a Better Data account, contract, or connection.

The hosted layer — multi-tenant orchestration, database-backed registry, RBAC auth, AI commerce intelligence — is where Better Data's commercial platform lives. It requires the open runtime but the runtime does not require it.

```
┌─────────────────────────────────────────────────────────┐
│               BETTER DATA HOSTED PLATFORM               │
│                                                         │
│  PrismaRegistryStore (database-backed registry)         │
│  SecurityAuthProvider (RBAC-backed auth)                │
│  Admin registry tools (impersonation, audit export,     │
│    SuperAdmin writes)                                   │
│  Hosted gateway infrastructure (multi-tenant)           │
│  AI Commerce Intelligence layer                         │
│  Platform analytics and observability                   │
│                                                         │
│                      PROPRIETARY                        │
├─────────────────────────────────────────────────────────┤
│              COMMERCE GATEWAY RUNTIME                   │
│                                                         │
│  Core gateway runtime and tool dispatch                 │
│  MCP / SSE transport layer                              │
│  Built-in tool definitions + Zod schemas                │
│  Federation layer (shop_merchant, discover_merchants)   │
│  RegistryStore interface + MemoryRegistryStore          │
│  AuthAdapter interface + EnvAuthAdapter                 │
│  RegistryAuthProvider interface + StaticAuthProvider    │
│  Shopify / BigCommerce / WooCommerce connectors         │
│  commerce-registry-protocol specification               │
│  Protocol HTTP endpoints                                │
│                                                         │
│         APACHE-2.0 (runtime) + MIT (protocol spec)     │
└─────────────────────────────────────────────────────────┘
```

---

## What Is Open Source

The following are open source under Apache-2.0, except `commerce-registry-protocol` which remains MIT.

### Core packages

| Package | Description |
|---|---|
| `@betterdata/commerce-gateway` | Core gateway runtime, tool dispatch, session management, protocol |
| `@betterdata/commerce-gateway-mcp` | MCP server — Claude, ChatGPT, Grok adapter support via SSE transport |
| `@betterdata/registry-mcp` | MCP server for registry discovery (OSS tools only — see admin tool note below) |
| `@betterdata/commerce-gateway-connectors` | Shopify, BigCommerce, WooCommerce connectors |

### Subpath exports (all Apache-2.0)

All subpath exports of `@betterdata/commerce-gateway` are Apache-2.0:

- `@betterdata/commerce-gateway` — main entry
- `@betterdata/commerce-gateway/mcp`
- `@betterdata/commerce-gateway/tools`
- `@betterdata/commerce-gateway/registry`
- `@betterdata/commerce-gateway/federation`
- `@betterdata/commerce-gateway/adapters`
- `@betterdata/commerce-gateway/validation`
- `@betterdata/commerce-gateway/errors`
- `@betterdata/commerce-gateway/observability`
- `@betterdata/commerce-gateway/ingestion`
- `@betterdata/commerce-gateway/catalog`
- `@betterdata/commerce-gateway/capabilities`
- `@betterdata/commerce-gateway/extensions`

### Protocol specification

`commerce-registry-protocol` is MIT. The registry protocol spec is open for anyone to implement a compatible registry. Better Data operates the hosted registry at `registry.betterdata.co` but the protocol is not locked to that implementation.

### Pluggable interface defaults

| Implementation | Description | Status |
|---|---|---|
| `EnvAuthAdapter` | Reads API key and org ID from env vars | Apache-2.0 |
| `MemoryRegistryStore` | In-memory registry, zero dependencies | Apache-2.0 |
| `StaticAuthProvider` | Single-user auth for self-hosted / dev | Apache-2.0 |

These defaults are deliberately minimal. They are the floor, not the ceiling. Production deployments implement the interfaces against their own infrastructure.

### Built-in tool definitions (OSS)

All commerce tools registered in `builtInTools.ts` and the federation tools (`shop_merchant`, `discover_merchants`) are Apache-2.0. Their Zod schemas are Apache-2.0.

Registry discovery tools (`registry_list_gateways`, `registry_get_gateway`) are Apache-2.0.

---

## What Is Proprietary

The following are proprietary to Better Data, Inc. and are not in this repository.

### Database-backed implementations

| Implementation | Lives In | Description |
|---|---|---|
| `PrismaRegistryStore` | `packages/hosted-gateway` | Implements `RegistryStore` using Prisma + PlanetScale |
| `SecurityAuthProvider` | `packages/hosted-gateway` | Implements `RegistryAuthProvider` using Better Data's RBAC system |
| `PrismaAuthAdapter` | `packages/hosted-gateway` | Implements `AuthAdapter` using Prisma API key validation |

These implement the open interfaces against Better Data's internal database. They are not published to npm. The interfaces themselves are Apache-2.0 — only the Prisma implementations are proprietary.

### Admin registry tools

The following registry MCP tools are cloud-only and are NOT included in the published `@betterdata/registry-mcp` package:

- User/org impersonation tools
- SuperAdmin write operations
- Audit log export
- Admin search and list operations beyond standard discovery

These tools exist in the OSS repo during development but are excluded from the npm publish via the `files` array in `package.json`. They are moved to `packages/hosted-gateway` before each OSS release.

### Hosted platform infrastructure

- Better Data's multi-tenant gateway orchestration
- Platform-level rate limiting, quotas, and entitlements
- AI Commerce Intelligence layer (product recommendations, demand forecasting models)
- Platform analytics and cross-tenant observability

---

## How the Boundary Is Maintained

### No proprietary code in OSS packages

The gateway runtime packages in this repo — `commerce-gateway`, `commerce-gateway-mcp`, `registry-mcp`, `commerce-gateway-connectors` — are Apache-2.0. `commerce-registry-protocol` is MIT. Better Data's proprietary implementations live in `packages/hosted-gateway` inside `bd-forge-main` and reference these packages as dependencies, not the other way around.

### No @repo/* imports in OSS packages

OSS packages must never import from `@repo/*` workspace packages. `@repo/*` is the internal monorepo namespace for Better Data's proprietary platform code.

CI enforces this at every PR:

```bash
# Must return zero results
grep -rn "from ['\"]@repo/" packages/commerce-gateway/src/
grep -rn "from ['\"]@repo/" packages/commerce-gateway-mcp/src/
grep -rn "from ['\"]@repo/" packages/registry-mcp/src/
grep -rn "from ['\"]@repo/" packages/commerce-gateway-connectors/src/
```

### No workspace:* references in published packages

Published package.json files must reference external npm versions, not workspace paths.

CI verifies:

```bash
grep "workspace:" packages/commerce-gateway/package.json  # must be zero
```

### Admin tools excluded from publish

The `files` array in `packages/registry-mcp/package.json` explicitly excludes admin tool source files. The `npm publish --dry-run` gate in CI verifies the published file list does not include admin tool implementations.

### Interface portability guarantee

Implementations built against `RegistryStore`, `AuthAdapter`, and `RegistryAuthProvider` interfaces will continue to work across major versions of the OSS packages. Breaking changes to these interfaces require:

- A major version bump
- A migration guide in CHANGELOG.md
- A 30-day public comment period before merging

---

## The Registry Boundary

The Commerce Gateway registry is a separate concern from the Loop Engine registry.

| Registry | URL | Stores | Protocol |
|---|---|---|---|
| Commerce Gateway Registry | `registry.betterdata.co` | Merchant/gateway routing records | `commerce-registry-protocol` (MIT) |
| Loop Engine Registry | `registry.loopengine.dev` | Loop definitions | Loop Registry API (MIT) |

The `commerce-registry-protocol` specification is MIT. The hosted implementation at `registry.betterdata.co` is proprietary infrastructure. Anyone can implement a compatible registry using the open protocol spec.

---

## Governance

Commerce Gateway is currently maintained by Better Data, Inc. The stated intention is to evolve toward broader governance as the ecosystem develops.

In the interim:

- All breaking interface changes have a public comment period (GitHub Discussions)
- The OSS/proprietary boundary document is reviewed and updated with each minor release
- Any contributor with merge rights is bound by this document

Questions about the boundary: open a [GitHub Discussion](https://github.com/betterdataco/llm-commerce-gateway/discussions) or email [oss@betterdata.co](mailto:oss@betterdata.co).

---

*Maintained by Better Data, Inc. Last reviewed: March 2026.*
