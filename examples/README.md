# LLM Commerce Recipes

End-to-end examples of an **LLM querying commerce data through
[Commerce Gateway](../packages/commerce-gateway)**. These are not demos of a
product — they are runnable recipes for one pattern:

```
LLM → Commerce Gateway → Data source
```

Every recipe uses the same two building blocks:

| | What it is | Port |
|---|---|---|
| [`commerce-chat-ui/`](./commerce-chat-ui) | Next.js chat UI. One `POST /api/chat` route. LLM is always on; provider chosen by `LLM_PROVIDER`. No in-app toggles. | 3002 |
| [`demo-gateway/`](./demo-gateway) | Reference Commerce Gateway. Serves `POST /api/gateway/query` over a swappable `DataSource`. Works out of the box. | 3003 |

The knob that changes between recipes is the **data source**, not the
transport, provider, or workflow.

## Start here

| Recipe | Goal | Data source | Takes |
|---|---|---|---|
| [`recipes/chat-demo-catalog/`](./recipes/chat-demo-catalog) | Chat with a static LUXE BOND catalog, no external services | `DATA_SOURCE=demo` (bundled JSON) | ~3 min |
| [`recipes/chat-custom-api/`](./recipes/chat-custom-api) | Chat with your real backend via an HTTP adapter | `DATA_SOURCE=custom` → your URL | ~10 min |

Future recipes (not yet shipped): `chat-shopify`, `chat-scm`, `chat-governed`.

## The three-step mental model

1. **Start with the demo catalog.** Get the whole flow running with zero
   external dependencies.
2. **Understand the flow.** Expand the "N gateway calls" toggle under any
   assistant reply to see exactly which tools the LLM invoked and what it
   sent to the gateway.
3. **Swap your data source.** Either point `demo-gateway` at your HTTP
   backend (`DATA_SOURCE=custom`) or add a new `DataSource` in
   `demo-gateway/lib/data-source/`.

You should not have to touch the chat UI to change data sources.

## What you will NOT find in these recipes

These are intentional non-features — if you want one of them, it belongs in
its own recipe or in the hosted `apps/gateway-console`, not here:

- Transport toggles (staging vs direct vs remote MCP)
- Provider toggles (Claude vs Grok vs GPT in the UI)
- Workflow toggles (standard vs governed)
- Multi-tenant login / auth / team management
- Control-plane dashboards

A developer following a recipe should:

1. Pick a recipe.
2. Set env vars.
3. Run it.
4. Modify the data source.

That's the shape; everything else is noise.

## Shared assets

- [`demo-data/luxe-bond/products.json`](./demo-data) — the bundled 15-product
  catalog every recipe defaults to. Duplicate and edit to try your own static
  dataset without writing code.

## License

Every example is Apache-2.0 licensed. See the repo root `LICENSE`.
