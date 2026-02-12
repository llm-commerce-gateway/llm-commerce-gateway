# @betterdata/registry-mcp

> **Commerce Registry MCP Server** — MCP server for direct LLM integration with the Commerce Gateway Registry. Exposes `@shop` resolution and gateway interaction tools to Claude Desktop.

Works with any registry that implements the [Commerce Registry Protocol](https://github.com/betterdata/commerce-registry-protocol). No Better Data account required for self-hosted registries.

## Package Exports

- `@betterdata/registry-mcp`

Avoid deep imports from `src/*`; use the export above.

## Installation

```bash
npm install @betterdata/registry-mcp
```

## Usage

### As a Standalone Server

```bash
npx @betterdata/registry-mcp
```

Or configure in Claude Desktop (`~/.config/claude/claude_desktop_config.json`):

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

## Available Tools

### `shop`

Resolve `@shop` queries to find and interact with brand commerce gateways.

**Triggers:**
- `@shop Nike` → Browse Nike's catalog
- `@shop LUXE BOND lipstick` → Search for lipstick in LUXE BOND
- `@shop 012345678901` → Look up product by UPC/GTIN

**Parameters:**
- `query` (required): The @shop query (brand name, brand + product, or GTIN)
- `intent` (optional): Intent of the query (`browse`, `search`, `lookup`, `price`, `availability`)

### `price_check`

Check current pricing for a product from a specific brand.

**Parameters:**
- `brand` (required): Brand name
- `product` (optional): Product name
- `gtin` (optional): Product GTIN/UPC

### `check_availability`

Check if a product is in stock.

**Parameters:**
- `brand` (required): Brand name
- `product` (required): Product name
- `location` (optional): Location to check availability

## Configuration

Set the `REGISTRY_URL` environment variable to point to your registry instance:

```bash
# Self-hosted: use your own registry URL
export REGISTRY_URL=https://your-registry.example.com

# Or use the Better Data hosted registry (optional)
# export REGISTRY_URL=https://registry.betterdata.co
```

### Feature Flags

All flags are server-side and can be toggled via env without redeploy.

```bash
# Discovery filtering
export OSS_REGISTRY_DISCOVERY=true

# Registry metadata validation
export OSS_REGISTRY_METADATA=true
```

Defaults: both flags are **ON**.

Owners:
- `oss_registry_discovery`: platform-oss
- `oss_registry_metadata`: platform-oss

## Non-goals

This package intentionally does **not**:

- Require a Better Data account — works with any Commerce Registry Protocol–compliant registry
- Execute commerce operations (search, cart, checkout) — discovery and resolution only
- Provide admin/tenant management tools — OSS is single-tenant, discovery-only

## License

MIT

