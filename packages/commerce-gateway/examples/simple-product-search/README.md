# Simple Product Search

> A "Hello World" for conversational commerce in <50 lines of code.

This minimal example demonstrates how to create a Claude-powered shopping assistant with @betterdata/llm-gateway.

## What's Included

- 10 sample products (outdoor gear)
- Product search by keyword
- Product details lookup
- Inventory checking
- MCP server for Claude Desktop

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Configure Claude Desktop

Add this to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "simple-shop": {
      "command": "node",
      "args": ["/path/to/simple-product-search/dist/server.js"]
    }
  }
}
```

### 4. Try It Out

Open Claude Desktop and ask:
- "What running shoes do you have?"
- "Tell me about the CloudRunner Pro"
- "Is the rain jacket in stock?"
- "What do you recommend for hiking?"

## Code Walkthrough

The entire implementation is in `server.ts` - under 50 lines!

```typescript
// 1. Import the MCP server
import { MCPServer } from '@betterdata/llm-gateway/mcp';

// 2. Create a simple backend (in-memory product array)
const backend = {
  async searchProducts(query) { /* filter products */ },
  async getProductDetails(id) { /* find by id */ },
  async checkInventory(ids) { /* return stock status */ },
};

// 3. Start the MCP server
const server = new MCPServer({
  backends: { products: backend },
  tools: ['search_products', 'get_product_details', 'check_inventory'],
});

server.start();
```

That's it! Claude can now search products, get details, and check inventory.

## Next Steps

- **Add a cart**: See the [ecommerce-stripe](../ecommerce-stripe) example
- **Use a real database**: See the [shopify-integration](../shopify-integration) example
- **Add OpenAI/ChatGPT**: See the dual-adapter examples

## License

MIT

