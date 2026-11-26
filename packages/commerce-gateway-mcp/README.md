# @commercegateway/commerce-gateway-mcp

[![npm](https://img.shields.io/npm/v/@commercegateway/commerce-gateway-mcp)](https://www.npmjs.com/package/@commercegateway/commerce-gateway-mcp)

MCP server wrapper for the Better Data gateway. Use it to expose commerce tools to Claude Desktop, Cursor, and other MCP-compatible clients.

## Install / Run

```bash
npx @commercegateway/commerce-gateway-mcp
```

With no `gateway.config.json`, this starts stdio MCP against **built-in demo backends** so a first install can be tested immediately. Copy `gateway.config.example.json` to `gateway.config.json` (or pass `--config` / `GATEWAY_CONFIG`) to name the server.

## `gateway.config.json`

```json
{
  "slug": "my-store",
  "brandName": "My Store",
  "endpoint": "https://my-store.example.com/mcp",
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

## Claude Desktop Config Example

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commerce-gateway": {
      "command": "npx",
      "args": ["@commercegateway/commerce-gateway-mcp"],
      "env": {
        "GATEWAY_CONFIG": "/absolute/path/to/gateway.config.json"
      }
    }
  }
}
```

## Cursor Config Example

Add an MCP server entry that starts the same command:

```json
{
  "mcpServers": {
    "commerce-gateway": {
      "command": "npx",
      "args": ["@commercegateway/commerce-gateway-mcp"],
      "env": {
        "GATEWAY_CONFIG": "/absolute/path/to/gateway.config.json"
      }
    }
  }
}
```

## Available Tools

This package uses `createGatewayMCPServer()` from `@commercegateway/commerce-gateway/mcp`.  
Tools are enabled by gateway capabilities:

- `search_products`
- `get_product_details`
- `check_availability`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GATEWAY_CONFIG` | no | Path to config file (default: `gateway.config.json`) |

## Notes

- `transport.type` can be `stdio` (default) or `http` (health check endpoint only)
- if `transport.type` is `http`, `/health` is exposed on `transport.port` (default `8080`)
- this package starts with demo backends by default (`backends.type: "demo"`)

## License

Apache-2.0 — see [LICENSE](./LICENSE).
