# demo-gateway

A reference [Commerce Gateway](../../packages/commerce-gateway) implementation.
Serves a product catalog over a single authenticated endpoint:

```
POST /api/gateway/query   { query: string }  →  { products, ... }
GET  /api/health
```

**Works out of the box.** No database, no external API, no cloud account
required. Bring your own data later via `DATA_SOURCE=custom`.

This is one half of the [commerce recipes](../README.md) — pair it with
[`commerce-chat-ui`](../commerce-chat-ui) to get an LLM chat → gateway → data
loop in ~3 minutes.

## Quick start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Gateway comes up at `http://localhost:3003`. Test it:

```bash
curl -X POST http://localhost:3003/api/gateway/query \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"query":"vitamin c serum"}'
```

## Configuration

All config is env-driven. See [`.env.example`](./.env.example) for the full list.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DEMO_GATEWAY_TOKEN` | yes | — | Bearer token checked on every query |
| `DATA_SOURCE` | no | `demo` | `demo` \| `custom` |
| `DEMO_DATA_PATH` | no | `../demo-data/luxe-bond/products.json` | Only read when `DATA_SOURCE=demo` |
| `CUSTOM_DATA_SOURCE_URL` | yes, if custom | — | Your backend base URL |
| `CUSTOM_DATA_SOURCE_TOKEN` | no | — | Optional Bearer for your backend |

## Data sources

```
DATA_SOURCE=demo    → reads examples/demo-data/luxe-bond/products.json
DATA_SOURCE=custom  → proxies to CUSTOM_DATA_SOURCE_URL
```

Each data source is a tiny `DataSource` implementation in
[`lib/data-source/`](./lib/data-source). The interface is two methods:
`search(query)` and `count()`. Everything else — ranking, the HTTP contract,
the chat UI on the other end — stays constant.

To add your own:

1. Copy `lib/data-source/custom.ts` → `lib/data-source/my-backend.ts`.
2. Fill in the HTTP calls.
3. Wire it up in `lib/data-source/index.ts`.

## What this is / isn't

**Is:** a reference Commerce Gateway you can read, fork, or deploy as-is.
**Isn't:** a control plane, a multi-tenant server, or a production Gateway
runtime. For production, use
[`@betterdata/gateway-console`](../../apps/gateway-console) over the real
[`@betterdata/commerce-gateway`](../../packages/commerce-gateway) runtime.

## License

Apache-2.0 — see the repo root `LICENSE`.
