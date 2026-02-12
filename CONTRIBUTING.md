# Contributing to LLM Commerce Gateway

We welcome contributions! Here's how to get started.

## Development Setup
```bash
git clone https://github.com/betterdataco/llm-commerce-gateway.git
cd llm-commerce-gateway
pnpm install
pnpm build
pnpm test
```

## Prerequisites

- Node.js 18.0+
- pnpm 8.0+

## Code Style

- TypeScript strict mode — no `any` types
- Biome for formatting and linting: `pnpm lint`
- Explicit return types on all exported functions

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Ensure `pnpm build && pnpm test && pnpm typecheck && pnpm lint` all pass
4. Submit a PR against `main`
5. One approving review required

## Package Structure

| Package | Description |
|---------|-------------|
| `@betterdata/commerce-gateway` | Core gateway runtime |
| `@betterdata/commerce-gateway-connectors` | Shopify, BigCommerce, WooCommerce connectors |
| `@betterdata/commerce-gateway-mcp` | MCP server for gateway operations |
| `@betterdata/registry-mcp` | MCP server for registry operations |
| `commerce-registry-protocol` | Open protocol specification |

## Issues

- **Bug reports:** Use the bug report template
- **Feature requests:** Use the feature request template
- **Security issues:** See SECURITY.md (do NOT open public issues)
