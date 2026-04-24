# commerce-chat-ui

An LLM chat UI that queries a Commerce Gateway through tool calls.

```
You → Chat UI → LLM (tool call) → POST /api/gateway/query → Data source → Products
```

One API route (`POST /api/chat`). One LLM at a time, chosen by
`LLM_PROVIDER`. One gateway, chosen by `GATEWAY_BASE_URL`. The developer
knobs are environment variables, not in-app toggles.

This is one half of the [commerce recipes](../README.md). Pair with
[`demo-gateway`](../demo-gateway) to get an end-to-end chat loop over a local
static catalog in under 3 minutes.

## Quick start

```bash
# In one terminal: run the gateway
cd ../demo-gateway && cp .env.example .env.local && pnpm install && pnpm dev

# In another: run the chat UI
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY (or switch LLM_PROVIDER + matching key)
pnpm install
pnpm dev
```

Open `http://localhost:3002` and try:

> @shop vitamin c serum

> retinol under $100 in stock

> tell me about the Gold Peptide Night Mask

Expand the trailing "N gateway calls" toggle under the assistant reply to see
exactly which tools the LLM invoked and what it sent to the gateway.

## Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LLM_PROVIDER` | no | `anthropic` | `anthropic` \| `openai` \| `xai` |
| `LLM_MODEL` | no | per-provider sensible default | e.g. `claude-sonnet-4-20250514` |
| `ANTHROPIC_API_KEY` | if `anthropic` | — | from [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | if `openai` | — | from [platform.openai.com](https://platform.openai.com) |
| `XAI_API_KEY` | if `xai` | — | from [x.ai](https://x.ai) |
| `GATEWAY_BASE_URL` | yes | `http://localhost:3003` | Any Commerce Gateway endpoint |
| `GATEWAY_API_TOKEN` | yes | `dev-token` | Bearer token accepted by the gateway |

## Architecture

```
app/
  api/chat/route.ts        ← single API surface for the browser
  page.tsx                 ← minimal chat UI (no toggles)
lib/
  providers/
    anthropic.ts           ← Claude via Anthropic SDK
    openai-compatible.ts   ← OpenAI + xAI (same wire format)
    index.ts               ← LLM_PROVIDER → provider factory
  tools.ts                 ← commerce tool definitions for all providers
  gateway.ts               ← POST /api/gateway/query
  format-gateway-query.ts  ← gateway payload → assistant text + products
  parse-tool-results.ts    ← best-effort product extraction
components/
  ChatMessage.tsx
  ProductCard.tsx
```

### What you will NOT find here

- A transport selector (staging / direct / remote MCP) — one path only.
- A provider selector (Claude / Grok / GPT) — env var only.
- A workflow selector (standard / governed) — recipes are outcome-oriented.
- A custom data source editor — swap that in the gateway (`DATA_SOURCE=custom`).

If you need one of those, that's a different recipe; don't bake it into this
one.

## Swapping in your own gateway

Any service that accepts the following contract works as a drop-in:

```
POST /api/gateway/query
Authorization: Bearer $GATEWAY_API_TOKEN
Content-Type: application/json

Body:     { "query": "…" }
Response: { "response": { "products": [...] }, "products_found": N, "connector": "…" }
```

Set `GATEWAY_BASE_URL` to that service's origin. No code changes required.

## License

Apache-2.0 — see the repo root `LICENSE`.
