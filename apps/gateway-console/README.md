# @betterdata/gateway-console

**Self-hosted, single-tenant operator UI for the open-source Commerce Gateway.**

Gateway Console is a local-first, login-free Next.js app that lets operators configure LLM providers and commerce connectors, inspect gateway health, manage local API keys, and connect to the public Commerce Registry — without signing in to Better Data, without a database, and without a multi-tenant backend.

Part of the [Commerce Gateway](https://github.com/llm-commerce-gateway/llm-commerce-gateway) open-source distribution. Apache-2.0.

---

## What this is (and isn't)

| | Gateway Console (this app) | Better Data platform / SCM (hosted) |
|---|---|---|
| **Where it runs** | Your machine or your own infrastructure | Better Data cloud |
| **Login** | None. Local config only. | Org account required |
| **Tenancy** | Single-tenant | Multi-tenant |
| **Persistence** | `gateway.config.json` on disk | Database-backed (proprietary) |
| **Best for** | OSS operators, local dev, air-gapped deployments | Teams wanting managed runtime, SLAs, and org-wide controls |

This app is **not** a Better Data product control plane. It is the open-source operator console that ships with Commerce Gateway itself.

---

## Prerequisites

- Node.js 18, 20, or 22
- pnpm 9+ (the workspace uses pnpm)

## Install and run

From the repository root:

```bash
pnpm install
pnpm --filter @betterdata/gateway-console dev
```

Then open `http://localhost:3012`.

### Scripts

| Command | Description |
|---|---|
| `pnpm --filter @betterdata/gateway-console dev` | Next.js dev server on port 3012 |
| `pnpm --filter @betterdata/gateway-console build` | Production build |
| `pnpm --filter @betterdata/gateway-console start` | Serve production build |
| `pnpm --filter @betterdata/gateway-console typecheck` | TypeScript check |
| `pnpm --filter @betterdata/gateway-console test` | Unit tests (node --test) |

## Configuration model

Gateway Console is **local-first**: it reads and writes a single JSON file, `gateway.config.json`, in the directory you run it from. No database, no cloud backend.

### Option A: Local config file (default)

Create `gateway.config.json` alongside wherever you run the console (by default, the console's working directory). The file is created on first write if it doesn't exist.

```json
{
  "registryUrl": "https://registry.betterdata.co",
  "claimToken": "bd-claim-<one-time-token>",
  "registryGatewayId": "<gateway-id>",
  "providers": [],
  "connectors": [],
  "console": { "keys": [] },
  "telemetry": { "enabled": false }
}
```

All provider, connector, and key mutations performed through the UI are persisted to this file.

### Option B: Remote gateway endpoint (optional)

Set `REGISTRY_URL` to point at a registry other than the default:

```bash
REGISTRY_URL=https://registry.example.com pnpm --filter @betterdata/gateway-console dev
```

Resolution order for the registry URL: `REGISTRY_URL` env → `gateway.config.json` `registryUrl` → `https://registry.betterdata.co` (default).

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `REGISTRY_URL` | Commerce Gateway registry base URL. Health check fetches `{REGISTRY_URL}/.well-known/commerce-gateway.json`. | `https://registry.betterdata.co` |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL for client-side status fetches (only needed behind a path or reverse proxy) | `http://localhost:3012` |
| `TELEMETRY_ENABLED` | Set to `1` to enable opt-in telemetry (off by default) | off |

See `.env.example` for the full list.

---

## UI / routes overview

| Route | Purpose |
|---|---|
| `/` | Overview — links to Status, Providers, Connectors, Keys, Registry, Federation, Telemetry |
| `/status` | Gateway health — version, uptime, p95 latency, error rate, registry/federation state |
| `/providers` | Configure LLM providers (Anthropic, OpenAI, Gemini, custom) — add, test, remove |
| `/connectors` | Manage commerce connectors (Shopify, WooCommerce, CSV, manual) — add, test, sync, remove |
| `/keys` | Generate/revoke self-hosted gateway keys (one-time reveal) |
| `/registry` | Register this gateway with a public registry and inspect registration status |
| `/federation` | Federation status (peer gateway discovery; expanded in a later release) |
| `/telemetry` | Preview the opt-in telemetry payload (no data is transmitted unless you enable it) |

---

## First-session flow

1. **Providers** — add Anthropic, OpenAI, or another supported LLM provider and run **Test connection**.
2. **Connectors** — add Shopify, WooCommerce, or another connector and run **Sync now**.
3. **Keys** — generate a **Live** gateway key and copy it from the one-time reveal panel.
4. **Status** — confirm version, latency, and registry signals look healthy.
5. **Registry** (optional) — link your gateway to the public registry at [registry.betterdata.co/register](https://registry.betterdata.co/register), paste the claim token and gateway ID into your config.

---

## Telemetry

**Telemetry is off by default.** Nothing is sent unless you explicitly enable it. Preview the payload locally at `/telemetry` or `GET /api/telemetry/preview` — no data is transmitted.

### What may be collected (if enabled)

- Gateway Console version, Node.js runtime version
- Deployment mode (`self-hosted`)
- Uptime in seconds
- Enabled features (registry, federation, streaming)
- Aggregate usage counts
- Aggregate health signals (p95 latency, error rate)

### What is never collected

- Prompts or LLM inputs
- Tool input / output payloads
- API keys or secrets
- Tenant, org, or customer identifiers
- Headers, bodies, or anything that identifies end users

### Enable

Set `TELEMETRY_ENABLED=1` when starting the server, or add to `gateway.config.json`:

```json
{ "telemetry": { "enabled": true } }
```

### Telemetry schema (v1.1)

```json
{
  "schema_version": "1.1",
  "timestamp": "ISO8601",
  "gateway": {
    "version": "string",
    "runtime": "node",
    "runtime_version": "string",
    "deployment": "self-hosted",
    "uptime_seconds": "number"
  },
  "features": {
    "registry_enabled": "boolean",
    "federation_enabled": "boolean",
    "streaming_enabled": "boolean"
  },
  "usage": {
    "request_count_session": "number",
    "tool_invocations_session": "number",
    "providers_used": ["string"],
    "tool_count": "number"
  },
  "health": {
    "error_rate_pct": "number",
    "p95_latency_ms": "number"
  }
}
```

---

## OSS boundary

Gateway Console ships in the Commerce Gateway OSS distribution and has no hidden dependencies on Better Data's hosted platform. It does **not** require:

- Prisma, PlanetScale, or any database
- Better Data auth (Clerk, RBAC)
- `@repo/*` proprietary packages
- Multi-tenant backend services
- Any Better Data account or API key

The app's only runtime dependencies are `next`, `react`, `react-dom`, and the sibling OSS packages `@betterdata/commerce-gateway`, `@betterdata/commerce-gateway-mcp`, and `@betterdata/registry-mcp`.

---

## Deployment

The app is a standard Next.js 15 app and runs anywhere Node.js runs — locally, in a container, on any serverless platform (Vercel, Fly.io, Railway, etc.).

No Vercel-specific configuration ships with this package; users deploy however they prefer. For production self-hosted setups, mount `gateway.config.json` through your platform's persistent volume or pre-seed it from environment.

---

## License

Apache-2.0. See [LICENSE](../../LICENSE) at the repository root.

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the repository root.
