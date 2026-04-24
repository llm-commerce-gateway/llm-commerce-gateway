# Gateway Console — architecture and product boundary

`@betterdata/gateway-console` is the self-hosted, single-tenant, login-free operator UI for Commerce Gateway. It ships as part of this OSS distribution at `apps/gateway-console/` and is licensed Apache-2.0.

This document exists so the intent is unambiguous to future contributors: **Gateway Console and Better Data's hosted SCM gateway UI are intentionally separate products.** They are not variants of each other; they are not meant to converge; and they do not share code.

---

## Two UIs, one protocol

Commerce Gateway has two operator-facing consoles. Both speak to the same `@betterdata/commerce-gateway` runtime, but they target fundamentally different deployment models.

| | **Gateway Console** (OSS) | **SCM Gateway UI** (hosted) |
|---|---|---|
| **Repo** | `llm-commerce-gateway/apps/gateway-console/` | `bd-forge-main/apps/scm/app/(authenticated)/(gateway)/` |
| **License** | Apache-2.0 | Proprietary |
| **Where it runs** | Operator's machine or private infrastructure | Better Data cloud |
| **Auth** | None (localhost-bound) | Clerk + org membership |
| **Tenancy** | Single-tenant | Multi-tenant |
| **Persistence** | `gateway.config.json` on local disk | Prisma-backed, multi-tenant database |
| **Feature scope** | Configure + monitor one gateway | Tenant provisioning, federation network, trust/verification, billing integration, rate limits, health-warning notifications |
| **Users** | OSS operators, developers, air-gapped deployments | Better Data platform customers |

The two UIs are **not substitutable.** An OSS operator cannot use SCM; a multi-tenant customer would not be satisfied with Gateway Console.

---

## Why the separation exists

1. **License contagion.** Gateway Console is Apache-2.0. SCM contains proprietary code (`@repo/*`), proprietary dependencies (Prisma, Clerk, Better Data billing), and hosted multi-tenant logic that cannot ship under Apache-2.0. Keeping them in separate trees prevents any accidental cross-pollination.

2. **Dependency footprint.** Gateway Console has four runtime dependencies: `next`, `react`, `react-dom`, and the sibling `@betterdata/commerce-gateway*` packages. SCM has hundreds, including a database client, auth provider, email templates, background workers, and a telemetry pipeline. An OSS user should not need any of that to operate their own gateway.

3. **Operational model.** Gateway Console assumes you are the only user, you trust your own network, and your config lives in a file. SCM assumes multi-tenant isolation, RBAC, audit, and managed infrastructure. These are incompatible posture choices, not two points on a slider.

4. **Product positioning.** The hosted SCM UI is where Better Data's commercial platform lives. The OSS console is the "you can run this yourself" proof. Splitting the UIs makes the commercial/OSS line honest and defensible.

---

## Runtime architecture

```
┌─────────────────────────────────────────────────────┐
│  Gateway Console (this package)                     │
│  Next.js 15 app, port 3012                          │
│                                                     │
│  Routes:                                            │
│    / /status /providers /connectors /keys           │
│    /registry /federation /telemetry                 │
│                                                     │
│  API routes:                                        │
│    /api/gateway-config  (read sanitized config)    │
│    /api/providers       (CRUD LLM providers)       │
│    /api/connectors      (CRUD connectors)          │
│    /api/keys            (generate/revoke keys)     │
│    /api/status          (health snapshot)          │
│    /api/telemetry/preview (opt-in payload preview) │
└────────────────┬────────────────────────────────────┘
                 │  read/write
                 ▼
┌─────────────────────────────────────────────────────┐
│  gateway.config.json on local disk                  │
│    - providers[]                                    │
│    - connectors[]                                   │
│    - console.keys[] (hashed metadata only)          │
│    - registryUrl, claimToken, registryGatewayId     │
│    - telemetry.enabled                              │
└────────────────┬────────────────────────────────────┘
                 │  same file on disk
                 ▼
┌─────────────────────────────────────────────────────┐
│  Your Commerce Gateway process                      │
│  (uses @betterdata/commerce-gateway to serve MCP    │
│   and protocol endpoints against the config above)  │
└─────────────────────────────────────────────────────┘
```

The console is not the gateway. It is a **configuration surface + health inspector** for a gateway process you run separately. They communicate through the shared config file on disk.

For remote monitoring of a gateway over HTTP, the registry URL and well-known endpoint (`{REGISTRY_URL}/.well-known/commerce-gateway.json`) are reached directly over fetch — no proprietary transport, no tenant routing.

---

## OSS boundary enforced by this app

Gateway Console must never depend on or import from:

- `@repo/*` (proprietary workspace packages in `bd-forge-main`)
- `@prisma/*`, any ORM, or any database client
- `@clerk/*`, `next-auth`, or any auth provider
- `apps/*` from another application's source tree
- `@betterdata/hosted-gateway` or `@betterdata/hosted-gateway-mcp`

These are enforced by `scripts/check-oss-boundary.mjs --package apps/gateway-console` in CI (`oss-split-verify` workflow).

Gateway Console may depend on:

- `@betterdata/commerce-gateway`
- `@betterdata/commerce-gateway-mcp`
- `@betterdata/registry-mcp`
- Standard Next.js / React / Node.js APIs
- Node built-in modules (`node:fs`, `node:path`, `node:crypto`)

---

## What does NOT belong in Gateway Console

If a feature request requires any of the following, it should go in the hosted SCM UI, not here:

- Multi-tenant organization/tenant management
- Billing, plan limits, quota enforcement
- Team membership, role management, RBAC
- Database-backed analytics history (trends across weeks/months)
- Email or in-app notifications
- Per-tenant federation trust graphs
- Admin impersonation, audit log export, SuperAdmin writes

If a feature request is about one operator managing their own gateway on one machine, it belongs here.

---

## History

- 2026-04: Promoted from `bd-forge-main/apps/gateway-console/` into this repository. The bd-forge-main copy was removed to prevent drift. Future changes happen in this repo directly.
- v0.1 scope: Providers, Connectors, Keys, Status, Registry, Telemetry (functional). Federation page is a v0.2 placeholder.

---

## Related

- [README](../../apps/gateway-console/README.md) — install, run, configuration
- [PROMOTION_RUNBOOK.md](../../PROMOTION_RUNBOOK.md) — "Gateway Console promotion" section
- [BOUNDARY-MANAGEMENT.md](../../BOUNDARY-MANAGEMENT.md) — overall OSS / proprietary split
