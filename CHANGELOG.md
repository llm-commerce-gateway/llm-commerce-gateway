# Changelog

All notable changes to Commerce Gateway will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

## Unreleased

### Documentation

- Track A: install and MCP examples use published `@commercegateway/*@1.0.0-rc.2`. `@commerce-gateway/sdk` was never published.
- Shopify connector is Storefront API, not UCP / Shop MCP.

## [0.1.0](https://github.com/llm-commerce-gateway/llm-commerce-gateway/releases/tag/v0.1.0) — 2026-03-28

### Added

- Early docs used placeholder `@commerce-gateway/sdk` names. Current npm org is `@commercegateway`.
- Unified tool schema covering the full commerce lifecycle:
  - Product discovery: `product.search`, `product.detail`, `product.availability`, `product.recommendations`
  - Cart and checkout: `cart.create`, `cart.add`, `cart.remove`, `cart.checkout`
  - Orders and returns: `order.status`, `order.history`, `order.cancel`, `returns.initiate`
- Adapter support for all major LLM platforms:
  - `adapter-claude` — Anthropic tool_use format, streaming supported
  - `adapter-openai` — function_calling + parallel tool calls, JSON mode
  - `adapter-grok` — xAI OpenAI-compatible API, function calling
  - `adapter-gemini` — function_declarations format, Gemini 1.5+ Pro/Flash
- Automatic tool schema translation per LLM adapter
- Self-hosted deployment model (Docker image, Node.js)
- Apache-2.0 license
