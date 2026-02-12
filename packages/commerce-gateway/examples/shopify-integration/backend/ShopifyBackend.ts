/**
 * Shopify Integration - Backend Implementation
 * 
 * Uses Shopify Storefront GraphQL API for product data
 * and Admin API for inventory/order management.
 */

import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  Product,
  ProductFilters,
  ProductSearchResult,
  Cart,
  CartItem,
  AddToCartInput,
  Order,
  ShippingAddress,
  InventoryStatus,
  Recommendation,
} from '@betterdata/llm-gateway/backends';

// Shopify GraphQL Types
interface ShopifyConnection<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: ShopifyConnection<{ url: string; altText?: string }>;
  variants: ShopifyConnection<ShopifyVariant>;
  tags: string[];
  productType: string;
}

interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  quantityAvailable?: number;
}

interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  lines: ShopifyConnection<{
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      product: { id: string; title: string };
      title: string;
      price: { amount: string; currencyCode: string };
      image?: { url: string };
    };
  }>;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
}

export interface ShopifyConfig {
  /** Shopify store domain (e.g., 'my-store.myshopify.com') */
  storeDomain: string;
  /** Storefront API access token */
  storefrontAccessToken: string;
  /** Admin API access token (for inventory/orders) */
  adminAccessToken?: string;
  /** API version (default: 2024-01) */
  apiVersion?: string;
}

export class ShopifyBackend implements ProductBackend, CartBackend, OrderBackend {
  private storeDomain: string;
  private storefrontToken: string;
  private adminToken?: string;
  private apiVersion: string;

  constructor(config: ShopifyConfig) {
    this.storeDomain = config.storeDomain;
    this.storefrontToken = config.storefrontAccessToken;
    this.adminToken = config.adminAccessToken;
    this.apiVersion = config.apiVersion ?? '2024-01';
  }

  // ============================================================================
  // Product Backend
  // ============================================================================

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const limit = options?.limit ?? 10;
    
    // Build search query
    let searchQuery = query;
    if (filters?.category) {
      searchQuery += ` product_type:${filters.category}`;
    }
    if (filters?.priceMax) {
      searchQuery += ` price:<${filters.priceMax}`;
    }
    if (filters?.inStock) {
      searchQuery += ` available_for_sale:true`;
    }

    const gqlQuery = `
      query SearchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              description
              handle
              priceRange {
                minVariantPrice { amount currencyCode }
              }
              images(first: 5) {
                edges { node { url altText } }
              }
              variants(first: 10) {
                edges {
                  node {
                    id title sku
                    price { amount currencyCode }
                    availableForSale
                  }
                }
              }
              tags
              productType
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `;

    const data = await this.storefrontQuery<{
      products: ShopifyConnection<ShopifyProduct>;
    }>(gqlQuery, { query: searchQuery, first: limit });

    return {
      products: data.products.edges.map(e => this.mapProduct(e.node)),
      total: data.products.edges.length,
      hasMore: data.products.pageInfo.hasNextPage,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    // Handle both GID and handle formats
    const isGid = productId.startsWith('gid://');
    
    const gqlQuery = isGid
      ? `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id title description handle
            priceRange { minVariantPrice { amount currencyCode } }
            images(first: 10) { edges { node { url altText } } }
            variants(first: 20) {
              edges { node { id title sku price { amount currencyCode } availableForSale } }
            }
            tags productType
          }
        }
      `
      : `
        query GetProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            id title description handle
            priceRange { minVariantPrice { amount currencyCode } }
            images(first: 10) { edges { node { url altText } } }
            variants(first: 20) {
              edges { node { id title sku price { amount currencyCode } availableForSale } }
            }
            tags productType
          }
        }
      `;

    const data = await this.storefrontQuery<{
      product?: ShopifyProduct;
      productByHandle?: ShopifyProduct;
    }>(gqlQuery, isGid ? { id: productId } : { handle: productId });

    const product = data.product ?? data.productByHandle;
    return product ? this.mapProduct(product) : null;
  }

  async checkInventory(productIds: string[]): Promise<InventoryStatus[]> {
    // For each product, check variant availability
    const results: InventoryStatus[] = [];

    for (const productId of productIds) {
      const product = await this.getProductDetails(productId);
      if (!product) {
        results.push({ productId, available: false, quantity: 0 });
        continue;
      }

      const available = product.variants?.some(v => v.available) ?? false;
      results.push({
        productId,
        available,
        quantity: available ? 1 : 0, // Shopify Storefront API doesn't expose exact qty
      });
    }

    return results;
  }

  async getRecommendations(context: {
    productIds?: string[];
    userId?: string;
    strategy?: string;
  }): Promise<Recommendation[]> {
    if (!context.productIds?.length) {
      // Return featured products
      const { products } = await this.searchProducts('', undefined, { limit: 5 });
      return products.map((product, i) => ({
        product,
        score: 1 - i * 0.1,
        reason: 'Featured product',
        strategy: 'trending' as const,
      }));
    }

    // Get product recommendations from Shopify
    const productId = context.productIds[0];
    const gqlQuery = `
      query GetRecommendations($productId: ID!) {
        productRecommendations(productId: $productId) {
          id title description handle
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 1) { edges { node { url } } }
          variants(first: 1) {
            edges { node { id title sku price { amount currencyCode } availableForSale } }
          }
          tags productType
        }
      }
    `;

    const data = await this.storefrontQuery<{
      productRecommendations: ShopifyProduct[];
    }>(gqlQuery, { productId });

    return data.productRecommendations.slice(0, 5).map((product, i) => ({
      product: this.mapProduct(product),
      score: 1 - i * 0.1,
      reason: 'Recommended for you',
      strategy: (context.strategy as any) ?? 'similar',
    }));
  }

  // ============================================================================
  // Cart Backend
  // ============================================================================

  async createCart(sessionId: string): Promise<Cart> {
    const gqlQuery = `
      mutation CreateCart {
        cartCreate {
          cart {
            id
            checkoutUrl
            lines(first: 50) {
              edges {
                node {
                  id quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      product { id title }
                      title
                      price { amount currencyCode }
                      image { url }
                    }
                  }
                }
              }
            }
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
            }
          }
        }
      }
    `;

    const data = await this.storefrontQuery<{
      cartCreate: { cart: ShopifyCart };
    }>(gqlQuery);

    return this.mapCart(data.cartCreate.cart, sessionId);
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const gqlQuery = `
      query GetCart($id: ID!) {
        cart(id: $id) {
          id checkoutUrl
          lines(first: 50) {
            edges {
              node {
                id quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    product { id title }
                    title
                    price { amount currencyCode }
                    image { url }
                  }
                }
              }
            }
          }
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
        }
      }
    `;

    const data = await this.storefrontQuery<{ cart: ShopifyCart | null }>(gqlQuery, { id: cartId });
    return data.cart ? this.mapCart(data.cart) : null;
  }

  async addToCart(cartId: string, input: AddToCartInput): Promise<{ cart: Cart; addedItem: CartItem }> {
    const gqlQuery = `
      mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id checkoutUrl
            lines(first: 50) {
              edges {
                node {
                  id quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      product { id title }
                      title
                      price { amount currencyCode }
                      image { url }
                    }
                  }
                }
              }
            }
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
            }
          }
        }
      }
    `;

    const variantId = input.variantId ?? input.productId;
    const data = await this.storefrontQuery<{
      cartLinesAdd: { cart: ShopifyCart };
    }>(gqlQuery, {
      cartId,
      lines: [{ merchandiseId: variantId, quantity: input.quantity ?? 1 }],
    });

    const cart = this.mapCart(data.cartLinesAdd.cart);
    const addedItem = cart.items.find(i => i.variantId === variantId) ?? cart.items[cart.items.length - 1];

    return { cart, addedItem };
  }

  async updateCartItem(cartId: string, itemId: string, updates: { quantity?: number }): Promise<Cart> {
    if (updates.quantity === 0) {
      return this.removeFromCart(cartId, itemId);
    }

    const gqlQuery = `
      mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id checkoutUrl
            lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id product { id title } title price { amount currencyCode } image { url } } } } } }
            cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
          }
        }
      }
    `;

    const data = await this.storefrontQuery<{
      cartLinesUpdate: { cart: ShopifyCart };
    }>(gqlQuery, {
      cartId,
      lines: [{ id: itemId, quantity: updates.quantity }],
    });

    return this.mapCart(data.cartLinesUpdate.cart);
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const gqlQuery = `
      mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id checkoutUrl
            lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id product { id title } title price { amount currencyCode } image { url } } } } } }
            cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
          }
        }
      }
    `;

    const data = await this.storefrontQuery<{
      cartLinesRemove: { cart: ShopifyCart };
    }>(gqlQuery, { cartId, lineIds: [itemId] });

    return this.mapCart(data.cartLinesRemove.cart);
  }

  async clearCart(cartId: string): Promise<void> {
    const cart = await this.getCart(cartId);
    if (!cart) return;

    const lineIds = cart.items.map(i => i.id).filter(Boolean) as string[];
    if (lineIds.length === 0) return;

    const gqlQuery = `
      mutation ClearCart($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { id }
        }
      }
    `;

    await this.storefrontQuery(gqlQuery, { cartId, lineIds });
  }

  // ============================================================================
  // Order Backend (requires Admin API)
  // ============================================================================

  async createOrder(cart: Cart, shippingAddress: ShippingAddress): Promise<Order> {
    // In Shopify, orders are created through checkout
    // Return checkout URL for the user
    return {
      id: `pending_${cart.id}`,
      status: 'pending',
      items: cart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: cart.subtotal,
      tax: 0,
      shipping: 0,
      total: cart.total,
      currency: cart.currency,
      shippingAddress,
      paymentStatus: 'pending',
      checkoutUrl: cart.checkoutUrl,
      createdAt: new Date(),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    if (!this.adminToken) {
      throw new Error('Admin API token required for order lookup');
    }
    // Implement Admin API call for order details
    return null;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    throw new Error('Order status updates require Admin API implementation');
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  private async storefrontQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(
      `https://${this.storeDomain}/api/${this.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.storefrontToken,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
    
    if (json.errors?.length) {
      throw new Error(`Shopify API error: ${json.errors[0].message}`);
    }

    return json.data!;
  }

  private mapProduct(p: ShopifyProduct): Product {
    const price = p.priceRange.minVariantPrice;
    return {
      id: p.id,
      name: p.title,
      description: p.description,
      slug: p.handle,
      price: {
        amount: parseFloat(price.amount),
        currency: price.currencyCode,
      },
      imageUrl: p.images.edges[0]?.node.url,
      images: p.images.edges.map(e => e.node.url),
      category: p.productType,
      tags: p.tags,
      variants: p.variants.edges.map(e => ({
        id: e.node.id,
        name: e.node.title,
        sku: e.node.sku,
        price: {
          amount: parseFloat(e.node.price.amount),
          currency: e.node.price.currencyCode,
        },
        available: e.node.availableForSale,
        attributes: {},
      })),
      inStock: p.variants.edges.some(e => e.node.availableForSale),
    };
  }

  private mapCart(c: ShopifyCart, sessionId?: string): Cart {
    const items = c.lines.edges.map(e => ({
      id: e.node.id,
      productId: e.node.merchandise.product.id,
      variantId: e.node.merchandise.id,
      name: `${e.node.merchandise.product.title} - ${e.node.merchandise.title}`,
      quantity: e.node.quantity,
      unitPrice: parseFloat(e.node.merchandise.price.amount),
      totalPrice: parseFloat(e.node.merchandise.price.amount) * e.node.quantity,
      imageUrl: e.node.merchandise.image?.url,
    }));

    return {
      id: c.id,
      sessionId,
      items,
      subtotal: parseFloat(c.cost.subtotalAmount.amount),
      total: parseFloat(c.cost.totalAmount.amount),
      currency: c.cost.totalAmount.currencyCode,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      checkoutUrl: c.checkoutUrl,
    };
  }
}

