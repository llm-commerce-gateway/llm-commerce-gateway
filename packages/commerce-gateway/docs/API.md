# API Documentation

Complete API reference for the Better Data LLM Gateway.

## Table of Contents

- [Core Classes](#core-classes)
- [Backend Interfaces](#backend-interfaces)
- [Tool System](#tool-system)
- [Session Management](#session-management)
- [Adapters](#adapters)
- [Federation](#federation)

---

## Core Classes

### LLMGateway

Main gateway class that orchestrates all functionality.

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';

const gateway = new LLMGateway({
  backends: {
    products: ProductBackend,
    cart: CartBackend,
    orders: OrderBackend,
  },
  llmProviders?: ['anthropic', 'openai', 'grok'],
  session?: {
    redis?: { url: string },
    ttl?: number,
  },
  tools?: CustomTool[],
});

await gateway.start(port: number);
```

#### Methods

- `start(port: number)`: Start the gateway server
- `stop()`: Stop the gateway server
- `getToolRegistry()`: Get the tool registry
- `getSessionManager()`: Get the session manager

---

## Backend Interfaces

### ProductBackend

Interface for product catalog operations.

```typescript
interface ProductBackend {
  searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult>;

  getProductDetails(productId: string): Promise<Product | null>;

  checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]>;

  getRecommendations?(
    context: RecommendationContext,
    limit?: number
  ): Promise<Recommendation[]>;
}
```

### CartBackend

Interface for shopping cart operations.

```typescript
interface CartBackend {
  createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  getOrCreateCart(sessionId: string): Promise<Cart>;
  addToCart(cartId: string, item: CartItemInput, options?: CartOptions): Promise<Cart>;
  updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart>;
  removeFromCart(cartId: string, itemId: string): Promise<Cart>;
  clearCart(cartId: string): Promise<Cart>;
}
```

### OrderBackend

Interface for order management.

```typescript
interface OrderBackend {
  createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo,
    options?: OrderOptions
  ): Promise<Order>;

  getOrder(orderId: string): Promise<Order | null>;
  getOrderByNumber?(orderNumber: string): Promise<Order | null>;
  calculateTotals?(cart: Cart, shippingAddress?: Address): Promise<OrderTotals>;
}
```

---

## Tool System

### Registering Tools

```typescript
import { ToolRegistry } from '@betterdata/commerce-gateway';

ToolRegistry.register({
  name: 'my_tool',
  description: 'My custom tool',
  schema: z.object({
    input: z.string(),
  }),
  handler: async (input) => {
    return { result: 'success' };
  },
});
```

### Built-in Tools

- `search_products`: Search product catalog
- `get_product_details`: Get product information
- `check_availability`: Check inventory
- `add_to_cart`: Add item to cart
- `get_cart`: Get current cart
- `create_order`: Create order from cart
- `@shop`: Commerce namespace tool (brand/GTIN resolution)

---

## Session Management

### SessionManager

Manages user sessions across LLM platforms.

```typescript
import { SessionManager } from '@betterdata/commerce-gateway';

const sessionManager = new SessionManager({
  redis: { url: process.env.REDIS_URL },
  ttl: 3600, // 1 hour
});

// Create session
const session = await sessionManager.createSession({
  userId: 'user_123',
  platform: 'claude',
});

// Get session
const session = await sessionManager.getSession(sessionId);

// Update session
await sessionManager.updateSession(sessionId, {
  cartId: 'cart_123',
});
```

---

## Adapters

### MCP Adapter

For Claude integration.

```typescript
import { createMCPAdapter } from '@betterdata/commerce-gateway/mcp';

const mcpServer = createMCPAdapter(gateway);
```

### OpenAI Adapter

For ChatGPT integration.

```typescript
import { createOpenAIAdapter } from '@betterdata/commerce-gateway/openai';

const adapter = createOpenAIAdapter(gateway);
```

### Grok Adapter

For Grok integration.

```typescript
import { createGrokAdapter } from '@betterdata/commerce-gateway/grok';

const adapter = createGrokAdapter(gateway);
```

---

## Federation

### FederationHub

Multi-vendor marketplace hub.

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: {
    type: 'memory', // or 'betterdata'
  },
  discovery: {
    type: 'tag-based',
  },
});

// Register gateway
await hub.registerGateway({
  id: 'gateway_1',
  name: 'Store 1',
  endpoint: 'https://store1.com',
  tags: ['footwear'],
});

// Search across all gateways
const results = await hub.searchProducts({
  query: 'running shoes',
  scope: { type: 'global' },
});
```

---

## Type Definitions

### Product

```typescript
interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
    compareAtPrice?: number;
  };
  images?: Array<{
    url: string;
    alt?: string;
  }>;
  category?: string;
  tags?: string[];
  variants?: ProductVariant[];
  availability?: {
    inStock: boolean;
    quantity?: number;
  };
}
```

### Cart

```typescript
interface Cart {
  id: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  itemCount: number;
  checkoutUrl?: string;
}
```

### Order

```typescript
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  createdAt: Date;
}
```

---

## Error Handling

All errors extend `GatewayError`:

```typescript
import {
  GatewayError,
  ProductNotFoundError,
  ValidationError,
  AuthenticationError,
} from '@betterdata/commerce-gateway/errors';

try {
  // Your code
} catch (error) {
  if (error instanceof ProductNotFoundError) {
    // Handle product not found
  } else if (error instanceof ValidationError) {
    // Handle validation error
  }
}
```

---

## Next Steps

- [Integration Tutorials](./INTEGRATION_TUTORIALS.md)
- [Protocol Specification](./PROTOCOL.md)
- [Deployment Guides](./DEPLOYMENT.md)

