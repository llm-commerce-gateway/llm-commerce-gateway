# @betterdata/registry-mcp

[![npm](https://img.shields.io/npm/v/@betterdata/registry-mcp)](https://www.npmjs.com/package/@betterdata/registry-mcp)

MCP server for registry discovery workflows. It resolves brands/GTINs and exposes discovery tools to MCP clients.

## Setup

```bash
npx @betterdata/registry-mcp
```

## Available Tools

- `shop`: resolve `@shop` queries
- `price_check`: check pricing by brand/product/GTIN
- `check_availability`: check inventory availability by brand/product

The server also exposes additional registry tools registered internally via `ALL_TOOLS`.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REGISTRY_URL` | no | `https://registry.betterdata.co` | Registry endpoint |
| `NEXTAUTH_SECRET` | no | unset | Used when verifying session tokens |
| `REGISTRY_ORG_ID` | no | `default` | Fallback org id for OSS tenant context |
| `REGISTRY_USER_ID` | no | `self-hosted-user` | Fallback user id |
| `OSS_REGISTRY_DISCOVERY` | no | `true` | Enable discovery tool behavior |
| `OSS_REGISTRY_METADATA` | no | `true` | Enable metadata validation checks |

## Claude Desktop Example

```json
{
  "mcpServers": {
    "commerce-registry": {
      "command": "npx",
      "args": ["@betterdata/registry-mcp"],
      "env": {
        "REGISTRY_URL": "https://your-registry.example.com"
      }
    }
  }
}
```

## License

MIT

