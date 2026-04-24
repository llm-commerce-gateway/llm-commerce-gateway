# Recipe: Chat with Demo Catalog

**Goal:** wire an LLM to a static product catalog via Commerce Gateway, end to
end, in three minutes, with no external backend.

```
You
 │
 ▼
commerce-chat-ui (:3002)        ← Next.js chat UI
 │  POST /api/chat
 ▼
  LLM (Claude/OpenAI/Grok)      ← picks LLM_PROVIDER from env
 │  tool call: shop / search_products / …
 ▼
  Commerce Gateway runtime
 │  POST /api/gateway/query
 ▼
demo-gateway (:3003)            ← reference gateway
 │  DATA_SOURCE=demo
 ▼
demo-data/luxe-bond/products.json
```

This is the zero-to-something recipe. Once it runs, graduate to
[`chat-custom-api`](../chat-custom-api) to swap in your own backend.

## Prereqs

- Node 20+ and [pnpm](https://pnpm.io/installation).
- An API key for one LLM provider. Anthropic is the default:
  [console.anthropic.com](https://console.anthropic.com).

## Run it

### 1. Install

From the repo root:

```bash
pnpm install
```

### 2. Start the gateway

```bash
cd examples/demo-gateway
cp .env.example .env.local
pnpm dev       # serves :3003
```

Leave that running. Quick smoke test in another terminal:

```bash
curl -X POST http://localhost:3003/api/gateway/query \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"query":"vitamin c"}'
```

You should see a JSON body with at least one product.

### 3. Start the chat UI

```bash
cd ../commerce-chat-ui
cp .env.example .env.local
# Edit .env.local: set ANTHROPIC_API_KEY=sk-ant-...
pnpm dev       # serves :3002
```

Open `http://localhost:3002`.

## Expected behavior

Try each:

| Prompt | What should happen |
|---|---|
| `@shop vitamin c serum` | LLM calls `shop`; gateway returns vitamin C serum products |
| `retinol under $100 in stock` | LLM calls `search_products`; price+stock filters applied |
| `what skincare bundles do you have?` | LLM calls `search_products`; bundles returned |
| `tell me about the Gold Peptide Night Mask` | LLM replies in prose, may call a tool for details |

Expand the "N gateway calls" toggle under each assistant reply to see which
tools the LLM invoked and the query string it sent.

## .env for this recipe

### `examples/demo-gateway/.env.local`

```env
DEMO_GATEWAY_TOKEN=dev-token
DATA_SOURCE=demo
```

### `examples/commerce-chat-ui/.env.local`

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
GATEWAY_BASE_URL=http://localhost:3003
GATEWAY_API_TOKEN=dev-token
```

## Switching the LLM

Same recipe, different provider — edit one env var:

```bash
# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# xAI / Grok
LLM_PROVIDER=xai
XAI_API_KEY=xai-...
```

Restart the chat UI. Nothing else changes.

## What's next

- **Your own dataset:** copy `examples/demo-data/luxe-bond/products.json` to
  `examples/demo-data/<your-brand>/products.json`, then set
  `DEMO_DATA_PATH=../demo-data/<your-brand>/products.json` in
  `demo-gateway/.env.local`. Same shape, your products.
- **Your own backend:** see [`chat-custom-api`](../chat-custom-api).
