# Changelog

All notable changes to Commerce Gateway will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

## [0.1.0] — 2026-02-12

### Added

- Initial public release of the monorepo packages: `@betterdata/commerce-gateway`, `@betterdata/commerce-gateway-mcp`, `@betterdata/commerce-gateway-connectors`, `@betterdata/registry-mcp`, and `commerce-registry-protocol` (registry protocol spec; MIT)
- `@betterdata/commerce-gateway` — core gateway: pluggable commerce backends (product, cart, order), session handling, federation hub and registry discovery, built-in Zod tool schemas, and optional React peer usage
- LLM adapters: Anthropic (Claude), OpenAI (chat completions and Assistants), Grok (xAI), Google Gemini, plus Perplexity and OpenAI-compatible Llama (e.g. Groq, Together, local) via `LlamaAdapter`
- Built-in tools for conversational commerce: product search and details, cart (`add_to_cart`), availability and inventory checks, recommendations, and order creation from cart (`create_order`), with Anthropic MCP, OpenAI function, and Grok tool definitions
- `@betterdata/commerce-gateway-mcp` — merchant-hosted MCP server (`gateway-mcp` CLI) for single-tenant deployments
- `@betterdata/commerce-gateway-connectors` — Shopify, BigCommerce, and WooCommerce connector entrypoints
- `@betterdata/registry-mcp` — Commerce Gateway Registry MCP server for registry-backed flows (e.g. Claude Desktop)
- Self-hosted deployment on Node.js 18+, with documented Docker and platform guides in package docs
- Apache-2.0 license for gateway, MCP, and connector packages (see per-package `LICENSE` where applicable)

[0.1.0]: https://github.com/llm-commerce-gateway/llm-commerce-gateway/releases/tag/v0.1.0
