# Custom Connector Interface

This document describes how to build custom connectors for the Better Data LLM Gateway.

## Overview

A connector is an implementation of the `GatewayBackends` interface that connects the LLM Gateway to your commerce platform. The gateway supports three types of backends:

1. **ProductBackend** - Product catalog and search
2. **CartBackend** - Shopping cart management
3. **OrderBackend** - Order creation and management

## Interface Requirements

### ProductBackend

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
    context: {
      productIds?: string[];
      sessionId?: string;
      strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
      userPreferences?: Record<string, unknown>;
    },
    limit?: number
  ): Promise<Recommendation[]>;
}
```

### CartBackend

```typescript
interface CartBackend {
  createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  getOrCreateCart(sessionId: string): Promise<Cart>;
  addToCart(
    cartId: string,
    item: {
      productId: string;
      variantId?: string;
      quantity: number;
    },
    options?: {
      reserveInventory?: boolean;
      reserveDurationMinutes?: number;
    }
  ): Promise<Cart>;
  updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart>;
  removeFromCart(cartId: string, itemId: string): Promise<Cart>;
  clearCart(cartId: string): Promise<Cart>;
}
```

### OrderBackend

```typescript
interface OrderBackend {
  createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo,
    options?: {
      notes?: string;
      isGift?: boolean;
      giftMessage?: string;
    }
  ): Promise<Order>;

  getOrder(orderId: string): Promise<Order | null>;
  getOrderByNumber?(orderNumber: string): Promise<Order | null>;
  calculateTotals?(
    cart: Cart,
    shippingAddress?: Address
  ): Promise<{
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  }>;
}
```

## Implementation Example

Here's a minimal example of a custom connector:

```typescript
import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  Product,
  ProductSearchResult,
  Cart,
  Order,
} from '@betterdata/commerce-gateway';

export class CustomProductBackend implements ProductBackend {
  constructor(private config: { apiUrl: string; apiKey: string }) {}

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    // Call your API
    const response = await fetch(
      `${this.config.apiUrl}/products/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    );
    const data = await response.json();
    
    // Transform to gateway format
    return {
      products: data.items.map(this.transformProduct),
      total: data.total,
      hasMore: data.hasMore,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    const response = await fetch(
      `${this.config.apiUrl}/products/${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return this.transformProduct(data);
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    // Implementation
    return [];
  }

  private transformProduct(item: any): Product {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      price: {
        amount: item.price,
        currency: item.currency || 'USD',
      },
      images: item.images?.map((img: any) => ({
        url: img.url,
        alt: img.alt,
      })),
      category: item.category,
      tags: item.tags,
    };
  }
}

export class CustomCartBackend implements CartBackend {
  // Implementation...
}

export class CustomOrderBackend implements OrderBackend {
  // Implementation...
}
```

## Using Your Connector

```typescript
import { LLMGateway } from '@betterdata/commerce-gateway';
import { CustomProductBackend, CustomCartBackend, CustomOrderBackend } from './connector';

const gateway = new LLMGateway({
  backends: {
    products: new CustomProductBackend({
      apiUrl: process.env.API_URL!,
      apiKey: process.env.API_KEY!,
    }),
    cart: new CustomCartBackend({ /* config */ }),
    orders: new CustomOrderBackend({ /* config */ }),
  },
});

gateway.start(3000);
```

## Best Practices

1. **Error Handling**: Always handle API errors gracefully and return appropriate error messages
2. **Rate Limiting**: Implement rate limiting for external API calls
3. **Caching**: Consider caching product data for frequently accessed items
4. **Type Safety**: Use TypeScript for type safety
5. **Testing**: Write unit tests for your connector
6. **Documentation**: Document any platform-specific requirements or limitations

## Available Connectors

- **Shopify** - `@betterdata/commerce-gateway-shopify`
- **BigCommerce** - `@betterdata/commerce-gateway-bigcommerce`
- **WooCommerce** - `@betterdata/commerce-gateway-woocommerce`

See the individual connector packages for platform-specific documentation.

