# Shopify Integration

> Connect your Shopify store to Claude and ChatGPT.

This example shows how to integrate a real Shopify store with the LLM Gateway, enabling AI-powered shopping conversations.

## Features

- ✅ Real-time product search via Shopify Storefront API
- ✅ Shopify Cart integration
- ✅ Native Shopify Checkout
- ✅ Product recommendations
- ✅ Multi-variant product support
- ✅ Both Claude (MCP) and ChatGPT (HTTP) modes

## Prerequisites

1. A Shopify store with Storefront API access
2. A Storefront Access Token (public or private)

### Getting Your Storefront Token

1. Go to your Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Configure Storefront API scopes:
   - `unauthenticated_read_product_listings`
   - `unauthenticated_read_product_tags`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_checkouts`
4. Install the app and copy the Storefront access token

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file:

```env
# Shopify (required)
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=your-storefront-token

# Optional: Admin API for order management
SHOPIFY_ADMIN_TOKEN=shpat_...

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
    "shopify": {
      "command": "node",
      "args": ["/path/to/shopify-integration/dist/server.js", "mcp"],
      "env": {
        "SHOPIFY_STORE_DOMAIN": "your-store.myshopify.com",
        "SHOPIFY_STOREFRONT_TOKEN": "your-token"
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

## Shopify API Coverage

| Feature | Storefront API | Admin API |
|---------|---------------|-----------|
| Product search | ✅ | - |
| Product details | ✅ | - |
| Cart management | ✅ | - |
| Checkout | ✅ (redirect) | - |
| Inventory levels | Basic | ✅ |
| Order details | - | ✅ |
| Order status | - | ✅ |

## Example Conversations

**Product Search:**
> User: "Show me running shoes under $100"
> Assistant: "I found 3 running shoes under $100: [displays products with prices and images]"

**Add to Cart:**
> User: "Add the blue Nike Air in size 10 to my cart"
> Assistant: "I've added Nike Air (Blue, Size 10) to your cart. Your total is $89.99. Here's your cart: [cart summary]"

**Checkout:**
> User: "I'm ready to checkout"
> Assistant: "Here's your secure Shopify checkout link: [Shopify Checkout URL]. Click to complete your purchase."

## Project Structure

```
shopify-integration/
├── backend/
│   └── ShopifyBackend.ts    # Shopify API implementation
├── server.ts                # Dual MCP/HTTP server
├── package.json
└── README.md
```

## Advanced Configuration

### Custom GraphQL Queries

Extend `ShopifyBackend.ts` to add custom queries:

```typescript
async getCollections() {
  const query = `
    query GetCollections {
      collections(first: 10) {
        edges { node { id title handle } }
      }
    }
  `;
  return this.storefrontQuery(query);
}
```

### Metafields

Access product metafields in your queries:

```graphql
products(first: 10) {
  edges {
    node {
      metafields(first: 5) {
        edges { node { key value } }
      }
    }
  }
}
```

## Troubleshooting

### "Shopify API error: Access denied"

Check your Storefront API scopes. You need at minimum:
- `unauthenticated_read_product_listings`
- `unauthenticated_write_checkouts`

### "Product not found"

Products must be available on the "Online Store" sales channel to appear in Storefront API queries.

### Cart not persisting

Shopify carts are stored server-side. Make sure you're using the same cart ID across requests.

## License

MIT

