# LLM Gateway OSS: MCP + Adapter Integration Status

This document summarizes the OSS MCP integration and existing provider adapters, then outlines the adapter scaffolding needed for Anthropic/Claude (non-MCP API), Gemini, Perplexity, and Meta/Llama.

Last Updated: 2026-01-20

---

## 1) What is implemented in OSS today

### MCP (Claude Desktop)
- **MCP server**: `MCPServer` with stdio transport, tool/resource/prompt handlers.  
  Location: `packages/llm-gateway/src/mcp/MCPServer.ts`
- **MCP exports**: `@betterdata/commerce-gateway/mcp` includes server, tools, resources, prompts, formatters.  
  Location: `packages/llm-gateway/src/mcp/index.ts`
- **Gateway MCP server factory**: `createGatewayMCPServer()` to expose gateway capabilities over MCP.  
  Location: `packages/llm-gateway/src/mcp/gateway-server.ts`
- **Registry MCP server**: separate OSS package `@betterdata/registry-mcp` for `@shop` resolution.  
  Location: `packages/registry-mcp/src/index.ts`

### Provider adapters
- **OpenAI**: `OpenAIAdapter` with Chat Completions + function/tool calling support.  
  Location: `packages/llm-gateway/src/adapters/openai/OpenAIAdapter.ts`
- **Grok (xAI)**: `GrokAdapter` with OpenAI-compatible tool calling.  
  Location: `packages/llm-gateway/src/adapters/grok/GrokAdapter.ts`

### Provider formatters (tool schemas)
- **Anthropic tool formatters** (Claude tool format + MCP tool format):  
  `packages/llm-gateway/src/formatters/anthropic.ts`
- **Google/Gemini tool formatters** (Vertex AI function calling):  
  `packages/llm-gateway/src/formatters/google.ts`

---

## 2) Gaps (not implemented as adapters)

- **Anthropic API adapter**: no adapter class for direct Anthropic API usage (non-MCP).
- **Gemini adapter**: no adapter class; only tool formatter exists.
- **Perplexity adapter**: not implemented.
- **Meta/Llama adapter**: not implemented.

---

## 3) Adapter scaffolding plan (recommended)

### 3.1 Shared adapter pattern

All provider adapters follow a shared `BaseAdapter` pattern:
- Build request messages
- Convert tools to provider format
- Call provider API
- Execute tool calls (if any)
- Return standardized `LLMResponse`

**Recommended module layout:**
```
packages/llm-gateway/src/adapters/
  anthropic/AnthropicAdapter.ts
  anthropic/index.ts
  google/GeminiAdapter.ts
  google/index.ts
  perplexity/PerplexityAdapter.ts
  perplexity/index.ts
  llama/LlamaAdapter.ts
  llama/index.ts
```

### 3.2 Anthropic (Claude API, non-MCP)

**Goal:** Direct Anthropic API adapter using Claude tool-use format.

**Suggested config:**
```
AnthropicAdapterConfig:
  apiKey: string
  baseUrl?: string (default: https://api.anthropic.com)
  model?: string (default: claude-3-5-sonnet-latest)
  anthropicVersion?: string (default: 2023-06-01)
```

**Core steps:**
1. Convert tools using `formatToolsForAnthropic`.
2. Send `messages` with tool definitions to `/v1/messages`.
3. Parse tool calls from `content` blocks (`tool_use`).
4. Execute tools, then return `tool_result` blocks.

**Files to add:**
- `src/adapters/anthropic/AnthropicAdapter.ts`
- `src/adapters/anthropic/index.ts`
- Export in `src/adapters/index.ts` and `src/index.ts`.

### 3.3 Gemini (Vertex AI / Google API)

**Goal:** Gemini adapter using Vertex AI function calling format.

**Suggested config:**
```
GeminiAdapterConfig:
  apiKey: string
  baseUrl?: string (default: https://generativelanguage.googleapis.com/v1beta)
  model?: string (default: gemini-1.5-pro)
```

**Core steps:**
1. Convert tools using `formatToolsForGoogle` (Vertex functionDeclarations).
2. Call `models/{model}:generateContent` with `tools` and `toolConfig`.
3. Parse function calls from `functionCall`.
4. Return function responses using `formatResultsForGoogle`.

**Files to add:**
- `src/adapters/google/GeminiAdapter.ts`
- `src/adapters/google/index.ts`
- Export in `src/adapters/index.ts` and `src/index.ts`.

### 3.4 Perplexity

**Goal:** Adapter that uses OpenAI-compatible Chat Completions (if targeting `api.perplexity.ai`).

**Suggested config:**
```
PerplexityAdapterConfig:
  apiKey: string
  baseUrl?: string (default: https://api.perplexity.ai)
  model?: string (default: sonar-pro)
```

**Core steps:**
1. Reuse OpenAI tool schema format.
2. Call `/chat/completions`.
3. Parse tool calls if supported by Perplexity tool calling.

**Files to add:**
- `src/adapters/perplexity/PerplexityAdapter.ts`
- `src/adapters/perplexity/index.ts`
- Export in `src/adapters/index.ts` and `src/index.ts`.

### 3.5 Meta / Llama

**Goal:** Adapter for OpenAI-compatible Llama endpoints (e.g., via Meta, Together, Groq, or custom OpenAI-compatible server).

**Suggested config:**
```
LlamaAdapterConfig:
  apiKey: string
  baseUrl?: string (default: provider specific)
  model?: string (default: llama-3.1-70b)
```

**Core steps:**
1. Use OpenAI-compatible Chat Completions request.
2. Tool calling maps to OpenAI format if supported.
3. Stream handling optional (follow OpenAI/Grok adapter pattern).

**Files to add:**
- `src/adapters/llama/LlamaAdapter.ts`
- `src/adapters/llama/index.ts`
- Export in `src/adapters/index.ts` and `src/index.ts`.

---

## 4) Recommended exports and docs updates

### Exports
- `src/adapters/index.ts` should export new adapters.
- `src/index.ts` should re-export provider adapters for OSS consumers.

### Docs
- Add usage examples to `packages/llm-gateway/docs/API.md` under Adapters.
- Add provider-specific guides under `docs/integrations/`.

---

## 5) Minimal adapter skeleton (structure)

Each adapter should include:
- Provider config interface
- `handleRequest()` method (mirrors `OpenAIAdapter` pattern)
- Tool conversion functions
- Tool execution loop (max iterations)
- Optional streaming support

This keeps behavior consistent across providers while using provider-native tool formats.
