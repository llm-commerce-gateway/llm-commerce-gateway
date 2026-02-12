# E-Commerce with Stripe

> Production-ready conversational commerce with JSON catalog, Redis carts, and Stripe checkout.

This example demonstrates a complete e-commerce integration pattern that works with both Claude (MCP) and ChatGPT (OpenAI Functions).

## Features

- ✅ 8-product tech gadgets catalog
- ✅ Redis cart persistence (with in-memory fallback)
- ✅ Stripe Checkout integration
- ✅ Claude MCP server
- ✅ OpenAI/ChatGPT HTTP server
- ✅ Product search and recommendations
- ✅ Inventory tracking

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file:

```env
# Stripe (required for checkout)
STRIPE_SECRET_KEY=sk_test_...
SUCCESS_URL=http://localhost:3000/success
CANCEL_URL=http://localhost:3000/cancel

# Redis (optional - uses in-memory if not set)
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=

# OpenAI (for ChatGPT server)
OPENAI_API_KEY=sk-...

# Server
PORT=3001
```

### 3. Start Redis (Optional)

```bash
# Using Docker
docker run -d -p 6379:6379 redis

# Or use docker-compose (included)
docker-compose up -d
```

### 4. Start the Servers

**For Claude (MCP):**
```bash
npm run mcp
```

**For ChatGPT (OpenAI):**
```bash
npm run openai
```

## Usage

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ecommerce": {
      "command": "node",
      "args": ["/path/to/ecommerce-stripe/dist/mcp-server.js"],
      "env": {
        "STRIPE_SECRET_KEY": "sk_test_...",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

### ChatGPT / OpenAI

Send POST requests to the OpenAI server:

```typescript
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Show me wireless headphones' }
    ],
    sessionId: 'user-123',
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

## Example Conversations

**Product Search:**
> User: "What monitors do you have?"
> Assistant: "I found our Ultra-Wide Monitor 34" - a curved ultrawide with 144Hz refresh rate, currently on sale for $599.99 (was $699.99). Would you like more details?"

**Add to Cart:**
> User: "Add the wireless headphones in black to my cart"
> Assistant: "I've added the Premium Wireless Headphones (Black) to your cart. Your total is $299.99. Would you like to continue shopping or proceed to checkout?"

**Checkout:**
> User: "I'm ready to checkout"
> Assistant: "I've created your order. Here's your secure checkout link: [Stripe Checkout URL]. You'll be redirected to complete payment."

## Project Structure

```
ecommerce-stripe/
├── backend/
│   ├── ProductBackend.ts    # JSON catalog
│   ├── CartBackend.ts       # Redis storage
│   └── OrderBackend.ts      # Stripe checkout
├── data/
│   └── products.json        # Product catalog
├── mcp-server.ts           # Claude MCP server
├── openai-server.ts        # ChatGPT HTTP server
├── docker-compose.yml      # Redis setup
├── package.json
└── README.md
```

## Customization

### Adding Products

Edit `data/products.json` to add or modify products:

```json
{
  "id": "prod_new",
  "name": "New Product",
  "description": "Product description",
  "price": 99.99,
  "category": "Electronics",
  "tags": ["new", "featured"],
  "variants": [
    { "id": "var_1", "name": "Default", "sku": "NEW-001", "inventory": 50 }
  ]
}
```

### Custom Shipping/Tax

Modify `OrderBackend.ts` to add shipping and tax calculations:

```typescript
const order: Order = {
  subtotal: cart.subtotal,
  tax: calculateTax(cart, shippingAddress),
  shipping: calculateShipping(cart, shippingAddress),
  total: cart.subtotal + tax + shipping,
  // ...
};
```

## Next Steps

- [Shopify Integration](../shopify-integration) - Connect to Shopify's API
- [WooCommerce Integration](../woocommerce-integration) - WordPress e-commerce
- [LUXE BOND Demo](../luxe-bond-demo) - Full-featured demo with analytics

## License

MIT

