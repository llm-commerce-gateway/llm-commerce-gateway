# @betterdata/gateway-mcp

> **Gateway MCP Server (OSS)** — Single-tenant MCP runtime that merchants can deploy to expose their catalog and commerce tools to LLM clients (e.g. Claude Desktop).

## Package Exports

- `@betterdata/gateway-mcp`

Avoid deep imports from `src/*`; use the export above.

## Install

```bash
npm install @betterdata/gateway-mcp
```

## Configuration

Create `gateway.config.json` in your working directory:

```json
{
  "slug": "nike",
  "brandName": "Nike",
  "endpoint": "https://nike.example.com/mcp",
  "protocol": "mcp",
  "capabilities": {
    "catalog_search": true,
    "inventory": "real_time"
  },
  "transport": {
    "type": "stdio"
  },
  "backends": {
    "type": "demo"
  }
}
```

Notes:
- `transport.type` can be `stdio` (default) or `http` (health only).
- If `transport.type` is `http`, the server will expose `/health` on the configured port.
- `backends.type: "demo"` uses the in-memory demo backend for quick starts.

## Quickstart

```bash
npm install @betterdata/gateway-mcp
# Create gateway.config.json (see Configuration above)
npx @betterdata/gateway-mcp
```

## Run

```bash
npx @betterdata/gateway-mcp
```

## Health

If `transport.type` is `http`, the health endpoint is available:

```bash
curl http://localhost:8080/health
```

## Non-goals

This package intentionally does **not**:

- Require a Better Data account or hosted registry
- Support multi-tenant deployment (single-tenant only)
- Provide production backends (use `@betterdata/llm-gateway` with your own backends for production)

## License

MIT
