# Examples: LLM Commerce Recipes

This document explains the architectural shape of the recipes under
`examples/` and why they are deliberately narrow.

## The pattern

Every recipe is a concrete instance of the same four-layer flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                               User                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ natural language
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              examples/commerce-chat-ui  (Next.js, :3002)             │
│                                                                     │
│   Chat state  ←→  POST /api/chat  ←→  Provider (Anthropic/OpenAI/   │
│                                                xAI via OpenAI SDK)  │
│                                                                     │
│   Provider is chosen by LLM_PROVIDER env var. No in-app toggle.     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ tool call:
                               │   shop / search_products /
                               │   check_availability / price_check
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│            Commerce Gateway HTTP contract  (constant)                │
│                                                                     │
│   POST $GATEWAY_BASE_URL/api/gateway/query                           │
│   Authorization: Bearer $GATEWAY_API_TOKEN                           │
│   Body:     { query: string }                                        │
│   Response: { response: { products: [...] },                         │
│               products_found, active_products,                       │
│               connector, provider, ... }                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│               examples/demo-gateway  (Next.js, :3003)                │
│                                                                     │
│    POST /api/gateway/query  ─→  getDataSource()  ─→  search(query)  │
│                                                                     │
│    Data source is chosen by DATA_SOURCE env var:                     │
│      demo    → static JSON at examples/demo-data/…                   │
│      custom  → HTTP adapter → your backend                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
          JSON file, HTTP service, database — whatever.
```

## Recipes vs modes

Historically the demo apps exposed three transport toggles (staging / gateway /
remote-mcp) and two workflow toggles (standard / governed). Those toggles are
gone. In their place: **recipes**.

A recipe is not a set of runtime toggles. It's a named configuration of:
- the **data source** behind the gateway, and
- (optionally) the **LLM provider** in the chat UI.

A developer picks a recipe, sets env vars, runs it. If they want different
behavior, they switch recipes — they don't poke around a UI to assemble
behavior at runtime.

| Old axis | Replacement |
|---|---|
| Transport toggle (staging / direct / remote MCP) | Single `/api/chat` route; no alternate paths |
| Provider toggle (Claude / Grok) | `LLM_PROVIDER` env (+ optional read-only badge) |
| Workflow toggle (standard / governed) | Governance belongs in its own future recipe |
| MCP remote transport | Future `chat-remote-mcp` recipe if demand appears |

## Invariants

These are non-negotiable for code that lives under `examples/`. CI enforces
the deps; the architecture is enforced by code review.

1. **LLM is always present.** There is no "direct-to-gateway" chat mode. If
   the user types text, an LLM sees it. If you want to hit the gateway without
   an LLM, call `curl` — that is already in the recipe READMEs.
2. **LLM provider is env-driven.** `LLM_PROVIDER` picks; the UI never does.
   New providers are added by implementing `LlmProvider` in
   `commerce-chat-ui/lib/providers/`, not by adding a button.
3. **The Commerce Gateway contract is constant.** All recipes target the same
   `POST /api/gateway/query` shape. Developers who want to swap the data layer
   do it behind that contract, not in front of it.
4. **The data source is the primary variable.** `DATA_SOURCE` in
   `demo-gateway` is the main knob. Recipes differ primarily in what they set
   this to.
5. **No control-plane UX.** No dashboards, no toggles, no multi-tenant
   assumptions. Examples ship single-process, single-user, single-terminal.
6. **No proprietary imports.** `@repo/*`, `@prisma/*`, `@clerk/*`, `next-auth`
   are all banned from `examples/**` by `scripts/check-oss-boundary.mjs`.

## Where things do NOT live

| Concern | Not here | Where instead |
|---|---|---|
| Hosted multi-tenant Gateway UI | `examples/commerce-chat-ui` | `apps/scm` (bd-forge-main, proprietary) |
| Self-hosted single-tenant operator UI | `examples/commerce-chat-ui` | `apps/gateway-console` (this repo) |
| Production Commerce Gateway runtime | `examples/demo-gateway` | `packages/commerce-gateway` (this repo) |
| Governance / approval workflows | `examples/commerce-chat-ui` | Future `loop-engine` OSS examples |
| Authentication, billing, tenants | anywhere under `examples/` | Proprietary apps only |

## Adding a new recipe

To add e.g. `chat-shopify`:

1. Make a new folder `examples/recipes/chat-shopify/`.
2. Write its `README.md` explaining: goal, data source, env vars, steps to
   run, expected behavior.
3. Write a `.env.example` that configures `demo-gateway` and/or
   `commerce-chat-ui` for that data source.
4. If a new `DataSource` implementation is needed, add it under
   `examples/demo-gateway/lib/data-source/<name>.ts` and register it in
   `lib/data-source/index.ts`. The chat UI should not change.
5. Link the recipe from `examples/README.md`.

If your new recipe requires forking the chat UI itself, stop and ask: can it
live behind a gateway instead? If yes, do that.
