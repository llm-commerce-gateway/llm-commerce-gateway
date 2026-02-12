# WooCommerce Integration

> Connect your WordPress/WooCommerce store to Claude and ChatGPT.

This example shows how to integrate a WooCommerce store with the LLM Gateway using the WooCommerce REST API.

## Features

- ✅ Product search and filtering
- ✅ Variable product support
- ✅ In-memory cart (WooCommerce REST API doesn't have cart endpoints)
- ✅ Order creation via REST API
- ✅ Both Claude (MCP) and ChatGPT (HTTP) modes

## Prerequisites

1. WordPress site with WooCommerce installed
2. WooCommerce REST API credentials

### Getting API Credentials

1. Go to WooCommerce → Settings → Advanced → REST API
2. Click "Add key"
3. Description: "LLM Gateway"
4. User: Select an admin user
5. Permissions: Read/Write
6. Click "Generate API key"
7. Copy Consumer Key and Consumer Secret

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file:

```env
# WooCommerce (required)
WOOCOMMERCE_SITE_URL=https://your-site.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...

# Optional
WOOCOMMERCE_API_VERSION=wc/v3

# OpenAI (for HTTP server)
OPENAI_API_KEY=sk-...

# Server
PORT=3001
```

### 3. Start the Server

**For Claude (MCP):**
```bash
npm run mcp
```

**For ChatGPT (HTTP):**
```bash
npm start
```

## Usage

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "woocommerce": {
      "command": "node",
      "args": ["/path/to/woocommerce-integration/dist/server.js", "mcp"],
      "env": {
        "WOOCOMMERCE_SITE_URL": "https://your-site.com",
        "WOOCOMMERCE_CONSUMER_KEY": "ck_...",
        "WOOCOMMERCE_CONSUMER_SECRET": "cs_..."
      }
    }
  }
}
```

### ChatGPT / OpenAI

```typescript
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'What products do you have?' }
    ],
    sessionId: 'user-123',
  }),
});
```

## WooCommerce API Notes

### Cart Handling

WooCommerce REST API doesn't have cart endpoints. This integration uses in-memory cart storage. For production:

- Store carts in Redis/database
- Use the Store API (Block-based cart) for headless
- Implement WooCommerce session handling

### Variable Products

Products with variations are fully supported. The backend fetches all variations and maps them to the standard variant format.

### Authentication

This integration uses HTTP Basic Auth with Consumer Key/Secret. For production, consider:

- Using HTTPS only
- Rate limiting
- IP whitelisting

## Project Structure

```
woocommerce-integration/
├── backend/
│   └── WooCommerceBackend.ts    # WooCommerce API implementation
├── server.ts                    # Dual MCP/HTTP server
├── package.json
└── README.md
```

## Troubleshooting

### "401 Unauthorized"

Check your Consumer Key and Consumer Secret. Make sure the API key has Read/Write permissions.

### "Products not showing"

Ensure products are:
- Published (not draft)
- Visible in catalog
- In stock (if filtering by stock)

### CORS Errors

If accessing from a browser, add this to your WordPress theme's `functions.php`:

```php
add_filter('woocommerce_rest_check_permissions', '__return_true');
```

⚠️ Only for development - implement proper auth for production.

## License

MIT

