# Recipe: Chat with Your API

**Goal:** point an LLM at your real product backend through Commerce Gateway,
with no UI or chat-code changes.

```
You
 │
 ▼
commerce-chat-ui (:3002)                    ← unchanged
 │
 ▼
  LLM (Claude/OpenAI/Grok)                  ← unchanged
 │
 ▼
demo-gateway (:3003)                        ← DATA_SOURCE=custom
 │
 ▼
Your backend (https://your-api.example.com) ← the only thing you add
```

Everything from [`chat-demo-catalog`](../chat-demo-catalog) stays the same.
The only swap is the gateway's `DATA_SOURCE` env var.

## Your backend contract

Your service must accept:

```
POST $CUSTOM_DATA_SOURCE_URL$CUSTOM_DATA_SOURCE_QUERY_PATH  (default /search)
Authorization: Bearer $CUSTOM_DATA_SOURCE_TOKEN             (optional)
Content-Type: application/json

Body:
  { "query": "natural language search string" }

Response:
  {
    "products": [
      {
        "id": "string",
        "sku": "string",
        "name": "string",
        "brand": "string",
        "price": 0.0,
        "currency": "USD",
        "description": "string",
        "inStock": true
      }
    ],
    "query_interpreted": "optional echo of how you parsed the query"
  }
```

Optional `GET $CUSTOM_DATA_SOURCE_URL$CUSTOM_DATA_SOURCE_COUNT_PATH`
(default `/count`) returning `{ "count": N }` for `/api/health`.

That's the entire integration surface. No SDKs to install, no schemas to
publish.

## Run it

### 1. Start your backend

Make sure `POST https://your-api.example.com/search` is reachable and returns
the shape above.

### 2. Configure demo-gateway

`examples/demo-gateway/.env.local`:

```env
DEMO_GATEWAY_TOKEN=dev-token
DATA_SOURCE=custom

CUSTOM_DATA_SOURCE_URL=https://your-api.example.com
CUSTOM_DATA_SOURCE_TOKEN=your-backend-token
# Optional overrides if your paths differ:
# CUSTOM_DATA_SOURCE_QUERY_PATH=/v1/search
# CUSTOM_DATA_SOURCE_COUNT_PATH=/v1/count
```

Then:

```bash
cd examples/demo-gateway && pnpm dev
```

### 3. Point the chat UI at it

No changes from `chat-demo-catalog`; the chat UI doesn't care which data source
the gateway uses:

```bash
cd examples/commerce-chat-ui && pnpm dev
```

### 4. Smoke test

```bash
curl -X POST http://localhost:3003/api/gateway/query \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"query":"something in your catalog"}'
```

If that returns your products, the chat UI will too.

## Going beyond HTTP

`DATA_SOURCE=custom` uses a generic HTTP adapter. If your data lives in a
database, search engine, or headless commerce platform instead, implement your
own `DataSource` in `examples/demo-gateway/lib/data-source/`:

```ts
// examples/demo-gateway/lib/data-source/my-backend.ts
import type { DataSource } from './types';

export const myBackendDataSource: DataSource = {
  id: 'my-backend',
  async search(query) { /* your query logic */ return { products: [...], queryInterpreted: query }; },
  async count() { /* catalog size */ return 0; },
};
```

Wire it into `lib/data-source/index.ts` and add your own `DATA_SOURCE=` value
to the dispatcher. That's it — the chat UI, API route, and search semantics
stay identical.

## .env for this recipe

### `examples/demo-gateway/.env.local`

```env
DEMO_GATEWAY_TOKEN=dev-token
DATA_SOURCE=custom
CUSTOM_DATA_SOURCE_URL=https://your-api.example.com
CUSTOM_DATA_SOURCE_TOKEN=your-backend-token
```

### `examples/commerce-chat-ui/.env.local`

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
GATEWAY_BASE_URL=http://localhost:3003
GATEWAY_API_TOKEN=dev-token
```
