/**
 * @betterdata/llm-gateway-shopify - Shopify Connector
 * 
 * Official Shopify connector for the Better Data LLM Gateway.
 * Implements the GatewayBackends interface using Shopify Storefront API.
 * 
 * @example
 * ```typescript
 * import { ShopifyConnector } from '@betterdata/llm-gateway-shopify';
 * 
 * const connector = new ShopifyConnector({
 *   domain: 'your-store.myshopify.com',
 *   accessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
 *   apiVersion: '2024-01',
 * });
 * 
 * const gateway = new LLMGateway({
 *   backends: connector.getBackends(),
 * });
 * ```
 * 
 * @license Apache-2.0
 */

import { BaseConnector, type BaseConnectorConfig } from '../base/connector';
import type {
  GatewayBackends,
  ProductBackend,
  CartBackend,
  OrderBackend,
  Product,
  ProductFilters,
  ProductSearchResult,
  InventoryStatus,
  Recommendation,
  Cart,
  CartItem,
  Order,
  Address,
  PaymentInfo,
} from '@betterdata/commerce-gateway/backends';

// ============================================================================
// Configuration
// ============================================================================

export interface ShopifyConnectorConfig extends BaseConnectorConfig {
  /** Shopify store domain (e.g., 'your-store.myshopify.com') */
  domain: string;
  /** Storefront API access token */
  accessToken: string;
  /** API version (default: '2024-01') */
  apiVersion?: string;
  /** Optional: Only include specific collections */
  collections?: string[];
  /** Optional: Map custom metafields to product attributes */
  metafieldMap?: Record<string, string>;
}

// ============================================================================
// Shopify Product Backend
// ============================================================================

// ============================================================================
// Shopify GraphQL Types
// ============================================================================

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
  availableForSale?: boolean;
}

interface ShopifyVariant {
  id: string;
  title: string;
  sku?: string;
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

// ============================================================================
// Shopify Product Backend
// ============================================================================

class ShopifyProductBackend implements ProductBackend {
  constructor(private config: ShopifyConnectorConfig) {}

  private async storefrontQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const apiUrl = `https://${this.config.domain}/api/${this.config.apiVersion}/graphql.json`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
    
    if (json.errors?.length) {
      throw new Error(`Shopify API error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
      throw new Error('Shopify API returned no data');
    }

    return json.data;
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const limit = Math.min(options?.limit ?? 20, 250); // Shopify max is 250
    const _offset = options?.offset ?? 0;
    
    // Build search query string
    let searchQuery = query;
    if (filters?.category) {
      searchQuery += ` product_type:${filters.category}`;
    }
    if (filters?.tags && filters.tags.length > 0) {
      searchQuery += ` tag:${filters.tags.join(' OR tag:')}`;
    }
    if (filters?.priceMax) {
      searchQuery += ` price:<${filters.priceMax}`;
    }
    if (filters?.priceMin) {
      searchQuery += ` price:>=${filters.priceMin}`;
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
                    quantityAvailable
                  }
                }
              }
              tags
              productType
              availableForSale
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `;

    const result = await this.storefrontQuery<{
      products: ShopifyConnection<ShopifyProduct>;
    }>(gqlQuery, {
      query: searchQuery,
      first: limit,
    });

    const products = result.products.edges.map(e => this.mapProduct(e.node));
    
    // Apply price filtering (Shopify query doesn't support exact price ranges)
    const filteredProducts = products.filter(p => {
      if (filters?.priceMin && p.price.amount < filters.priceMin) return false;
      if (filters?.priceMax && p.price.amount > filters.priceMax) return false;
      return true;
    });

    // Build facets
    const categoryCounts = new Map<string, number>();
    filteredProducts.forEach(p => {
      if (p.category) {
        categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
      }
    });

    return {
      products: filteredProducts,
      total: filteredProducts.length, // Shopify doesn't provide exact total
      hasMore: result.products.pageInfo.hasNextPage,
      facets: {
        categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count })),
      },
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    // Handle both GID format and handle
    const isGID = productId.startsWith('gid://');
    const gqlQuery = isGID
      ? `
        query GetProduct($id: ID!) {
          product(id: $id) {
            id title description handle
            priceRange { minVariantPrice { amount currencyCode } }
            images(first: 10) { edges { node { url altText } } }
            variants(first: 100) {
              edges {
                node {
                  id title sku
                  price { amount currencyCode }
                  availableForSale
                  quantityAvailable
                }
              }
            }
            tags productType availableForSale
          }
        }
      `
      : `
        query GetProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            id title description handle
            priceRange { minVariantPrice { amount currencyCode } }
            images(first: 10) { edges { node { url altText } } }
            variants(first: 100) {
              edges {
                node {
                  id title sku
                  price { amount currencyCode }
                  availableForSale
                  quantityAvailable
                }
              }
            }
            tags productType availableForSale
          }
        }
      `;

    try {
      const result = await this.storefrontQuery<{
        product?: ShopifyProduct;
        productByHandle?: ShopifyProduct;
      }>(gqlQuery, isGID ? { id: productId } : { handle: productId });

      const product = result.product || result.productByHandle;
      return product ? this.mapProduct(product) : null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async checkInventory(
    productIds: string[],
    _options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    // Fetch products to get variant inventory
    const products = await Promise.all(
      productIds.map(id => this.getProductDetails(id))
    );

    return products
      .filter((p): p is Product => p !== null)
      .map(product => {
        const variants = product.variants || [];
        const totalQuantity = variants.reduce((sum, v) => {
          const qty = v.availability?.quantity ?? 0;
          return sum + qty;
        }, 0);
        const inStock = variants.some(v => v.availability?.inStock ?? false);

        return {
          productId: product.id,
          inStock,
          quantity: totalQuantity,
        };
      });
  }

  async getRecommendations(
    context: {
      productIds?: string[];
      sessionId?: string;
      strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
      userPreferences?: Record<string, unknown>;
    },
    limit: number = 10
  ): Promise<Recommendation[]> {
    const { productIds, strategy = 'trending' } = context;
    
    // Get source products to find similar/complementary
    let sourceProducts: Product[] = [];
    if (productIds && productIds.length > 0) {
      sourceProducts = (await Promise.all(
        productIds.map(id => this.getProductDetails(id))
      )).filter((p): p is Product => p !== null);
    }

    let searchQuery = '';
    if (strategy === 'similar' && sourceProducts.length > 0) {
      const categories = sourceProducts.map(p => p.category).filter(Boolean);
      if (categories.length > 0) {
        searchQuery = `product_type:${categories[0]}`;
      }
    } else if (strategy === 'complementary' && sourceProducts.length > 0) {
      const categories = sourceProducts.map(p => p.category).filter(Boolean);
      // Get products NOT in the same category
      searchQuery = `-product_type:${categories[0]}`;
    } else {
      // Trending - just get available products
      searchQuery = 'available_for_sale:true';
    }

    const result = await this.searchProducts(searchQuery, undefined, { limit });
    
    return result.products
      .filter(p => !productIds?.includes(p.id))
      .slice(0, limit)
      .map(product => ({
        product,
        reason: strategy === 'similar' 
          ? 'Similar to products you viewed'
          : strategy === 'complementary'
          ? 'Works great with your selected products'
          : 'Recommended for you',
        confidence: 0.85,
        strategy,
      }));
  }

  private mapProduct(p: ShopifyProduct): Product {
    const price = p.priceRange.minVariantPrice;
    const variants = p.variants.edges.map(e => {
      const v = e.node;
      return {
        id: v.id,
        name: v.title,
        sku: v.sku,
        price: {
          amount: parseFloat(v.price.amount),
          currency: v.price.currencyCode,
        },
        attributes: {},
        availability: {
          inStock: v.availableForSale,
          quantity: v.quantityAvailable ?? 0,
        },
      };
    });

    return {
      id: p.id,
      name: p.title,
      slug: p.handle,
      description: p.description || '',
      price: {
        amount: parseFloat(price.amount),
        currency: price.currencyCode,
      },
      images: p.images.edges.map(e => ({
        url: e.node.url,
        alt: e.node.altText,
      })),
      category: p.productType,
      tags: p.tags,
      variants,
      availability: {
        inStock: p.availableForSale ?? variants.some(v => v.availability.inStock),
        quantity: variants.reduce((sum, v) => sum + (v.availability.quantity ?? 0), 0),
      },
    };
  }
}

// ============================================================================
// Shopify Cart Backend
// ============================================================================

class ShopifyCartBackend implements CartBackend {
  private productBackend: ShopifyProductBackend;
  private cartStorage = new Map<string, string>(); // sessionId -> cartId

  constructor(
    private config: ShopifyConnectorConfig,
    productBackend: ShopifyProductBackend
  ) {
    this.productBackend = productBackend;
  }

  private async storefrontQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const apiUrl = `https://${this.config.domain}/api/${this.config.apiVersion}/graphql.json`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
    
    if (json.errors?.length) {
      throw new Error(`Shopify API error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
      throw new Error('Shopify API returned no data');
    }

    return json.data;
  }

  async createCart(sessionId: string, _metadata?: Record<string, unknown>): Promise<Cart> {
    const gqlMutation = `
      mutation CartCreate {
        cartCreate {
          cart {
            id
            checkoutUrl
            lines(first: 250) {
              edges {
                node {
                  id
                  quantity
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

    const result = await this.storefrontQuery<{
      cartCreate: { cart: ShopifyCart };
    }>(gqlMutation);

    const cart = this.mapCart(result.cartCreate.cart, sessionId);
    this.cartStorage.set(sessionId, cart.id);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const gqlQuery = `
      query GetCart($id: ID!) {
        cart(id: $id) {
          id
          checkoutUrl
          lines(first: 250) {
            edges {
              node {
                id
                quantity
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

    try {
      const result = await this.storefrontQuery<{
        cart: ShopifyCart | null;
      }>(gqlQuery, { id: cartId });

      return result.cart ? this.mapCart(result.cart) : null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    // Try to get existing cart from storage
    const existingCartId = this.cartStorage.get(sessionId);
    if (existingCartId) {
      const existing = await this.getCart(existingCartId);
      if (existing) return existing;
    }
    return this.createCart(sessionId);
  }

  async addToCart(
    cartId: string,
    item: { productId: string; variantId?: string; quantity: number },
    _options?: { reserveInventory?: boolean; reserveDurationMinutes?: number }
  ): Promise<Cart> {
    // If no variantId, get the first available variant
    let variantId = item.variantId;
    if (!variantId) {
      const product = await this.productBackend.getProductDetails(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      const availableVariant = product.variants?.find(v => v.availability?.inStock);
      if (!availableVariant) {
        throw new Error(`No available variants for product: ${item.productId}`);
      }
      variantId = availableVariant.id;
    }

    const gqlMutation = `
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            lines(first: 250) {
              edges {
                node {
                  id
                  quantity
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
          userErrors {
            field message
          }
        }
      }
    `;

    const result = await this.storefrontQuery<{
      cartLinesAdd: {
        cart: ShopifyCart;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(gqlMutation, {
      cartId,
      lines: [{ merchandiseId: variantId, quantity: item.quantity }],
    });

    if (result.cartLinesAdd.userErrors.length > 0) {
      throw new Error(`Shopify error: ${result.cartLinesAdd.userErrors.map(e => e.message).join(', ')}`);
    }

    return this.mapCart(result.cartLinesAdd.cart);
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    const gqlMutation = `
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            lines(first: 250) {
              edges {
                node {
                  id
                  quantity
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
          userErrors {
            field message
          }
        }
      }
    `;

    const result = await this.storefrontQuery<{
      cartLinesUpdate: {
        cart: ShopifyCart;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(gqlMutation, {
      cartId,
      lines: [{ id: itemId, quantity }],
    });

    if (result.cartLinesUpdate.userErrors.length > 0) {
      throw new Error(`Shopify error: ${result.cartLinesUpdate.userErrors.map(e => e.message).join(', ')}`);
    }

    return this.mapCart(result.cartLinesUpdate.cart);
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const gqlMutation = `
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id
            checkoutUrl
            lines(first: 250) {
              edges {
                node {
                  id
                  quantity
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
          userErrors {
            field message
          }
        }
      }
    `;

    const result = await this.storefrontQuery<{
      cartLinesRemove: {
        cart: ShopifyCart;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(gqlMutation, {
      cartId,
      lineIds: [itemId],
    });

    if (result.cartLinesRemove.userErrors.length > 0) {
      throw new Error(`Shopify error: ${result.cartLinesRemove.userErrors.map(e => e.message).join(', ')}`);
    }

    return this.mapCart(result.cartLinesRemove.cart);
  }

  async clearCart(cartId: string): Promise<Cart> {
    // Get cart to find all line IDs
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    if (cart.items.length === 0) {
      return cart;
    }

    // Remove all items
    const lineIds = cart.items.map(item => item.id!);
    for (const lineId of lineIds) {
      await this.removeFromCart(cartId, lineId);
    }

    // Return updated cart (getCart returns Cart | null; fall back to cart if null)
    const updated = await this.getCart(cartId);
    return updated ?? cart;
  }

  private mapCart(c: ShopifyCart, sessionId?: string): Cart {
    const items: CartItem[] = c.lines.edges.map(e => {
      const node = e.node;
      const merchandise = node.merchandise;
      const unitPrice = parseFloat(merchandise.price.amount);
      
      return {
        id: node.id,
        productId: merchandise.product.id,
        variantId: merchandise.id,
        name: `${merchandise.product.title}${merchandise.title !== 'Default Title' ? ` - ${merchandise.title}` : ''}`,
        sku: undefined, // Not available in cart line
        quantity: node.quantity,
        unitPrice,
        totalPrice: unitPrice * node.quantity,
        imageUrl: merchandise.image?.url,
      };
    });

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

// ============================================================================
// Shopify Order Backend
// ============================================================================

class ShopifyOrderBackend implements OrderBackend {
  constructor(private config: ShopifyConnectorConfig) {}

  private async storefrontQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const apiUrl = `https://${this.config.domain}/api/${this.config.apiVersion}/graphql.json`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
    
    if (json.errors?.length) {
      throw new Error(`Shopify API error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
      throw new Error('Shopify API returned no data');
    }

    return json.data;
  }

  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    _payment?: PaymentInfo,
    options?: { notes?: string; isGift?: boolean; giftMessage?: string }
  ): Promise<Order> {
    // Shopify Storefront API doesn't support direct order creation
    // Instead, we create a checkout which the customer completes
    // For OSS, we'll return the checkout URL as the order confirmation
    
    const lineItems = cart.items.map(item => ({
      variantId: item.variantId || item.productId,
      quantity: item.quantity,
    }));

    const gqlMutation = `
      mutation CheckoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
            order {
              id
              orderNumber
              name
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              subtotalPriceSet {
                shopMoney { amount currencyCode }
              }
              totalTaxSet {
                shopMoney { amount currencyCode }
              }
              totalShippingPriceSet {
                shopMoney { amount currencyCode }
              }
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                      price { amount currencyCode }
                    }
                  }
                }
              }
            }
          }
          checkoutUserErrors {
            field message
          }
        }
      }
    `;

    const result = await this.storefrontQuery<{
      checkoutCreate: {
        checkout: {
          id: string;
          webUrl: string;
          order?: {
            id: string;
            orderNumber: number;
            name: string;
            totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            subtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            totalTaxSet: { shopMoney: { amount: string; currencyCode: string } };
            totalShippingPriceSet: { shopMoney: { amount: string; currencyCode: string } };
            lineItems: ShopifyConnection<{
              id: string;
              title: string;
              quantity: number;
              variant: {
                id: string;
                title: string;
                price: { amount: string; currencyCode: string };
              };
            }>;
          };
        };
        checkoutUserErrors: Array<{ field: string[]; message: string }>;
      };
    }>(gqlMutation, {
      input: {
        lineItems,
        shippingAddress: {
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          province: shippingAddress.state,
          zip: shippingAddress.postalCode,
          country: shippingAddress.country,
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          phone: shippingAddress.phone,
        },
        email: billingAddress?.email || shippingAddress.email,
        note: options?.notes || (options?.isGift ? options.giftMessage : undefined),
      },
    });

    if (result.checkoutCreate.checkoutUserErrors.length > 0) {
      throw new Error(`Shopify error: ${result.checkoutCreate.checkoutUserErrors.map(e => e.message).join(', ')}`);
    }

    const checkout = result.checkoutCreate.checkout;
    
    // If order was created immediately, use it; otherwise use checkout
    if (checkout.order) {
      const order = checkout.order;
      return {
        id: order.id,
        orderNumber: order.name,
        status: 'PENDING',
        items: order.lineItems.edges.map(e => {
          const node = e.node;
          return {
            productId: node.variant.id,
            variantId: node.variant.id,
            name: node.title,
            quantity: node.quantity,
            unitPrice: parseFloat(node.variant.price.amount),
            totalPrice: parseFloat(node.variant.price.amount) * node.quantity,
          };
        }),
        subtotal: parseFloat(order.subtotalPriceSet.shopMoney.amount),
        shipping: parseFloat(order.totalShippingPriceSet.shopMoney.amount),
        tax: parseFloat(order.totalTaxSet.shopMoney.amount),
        total: parseFloat(order.totalPriceSet.shopMoney.amount),
        currency: order.totalPriceSet.shopMoney.currencyCode,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        createdAt: new Date(),
      };
    }

    // Return checkout as pending order
    return {
      id: checkout.id,
      orderNumber: `CHECKOUT-${checkout.id.slice(-8)}`,
      status: 'PENDING',
      items: cart.items,
      subtotal: cart.subtotal,
      shipping: 0, // Will be calculated at checkout
      tax: 0, // Will be calculated at checkout
      total: cart.total,
      currency: cart.currency,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      trackingUrl: checkout.webUrl,
      createdAt: new Date(),
    };
  }

  async getOrder(_orderId: string): Promise<Order | null> {
    // Storefront API doesn't support order retrieval
    // This would require Admin API access
    throw new Error('Order retrieval requires Shopify Admin API access. Not available in Storefront API.');
  }

  async getOrderByNumber(_orderNumber: string): Promise<Order | null> {
    // Storefront API doesn't support order lookup
    throw new Error('Order lookup requires Shopify Admin API access. Not available in Storefront API.');
  }

  async calculateTotals(
    cart: Cart,
    _shippingAddress?: Address
  ): Promise<{ subtotal: number; shipping: number; tax: number; total: number; currency: string }> {
    // Get updated cart with shipping/tax calculations
    const updatedCart = await this.storefrontQuery<{
      cart: {
        cost: {
          subtotalAmount: { amount: string; currencyCode: string };
          totalTaxAmount: { amount: string; currencyCode: string };
          totalAmount: { amount: string; currencyCode: string };
        };
      };
    }>(`
      query GetCartTotals($id: ID!) {
        cart(id: $id) {
          cost {
            subtotalAmount { amount currencyCode }
            totalTaxAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
        }
      }
    `, { id: cart.id });

    const cost = updatedCart.cart.cost;
    
    // Shipping is not directly available in cart cost, would need checkout
    // For now, estimate as 0 or calculate separately
    const shipping = 0; // Would need checkoutCreate to get shipping
    
    return {
      subtotal: parseFloat(cost.subtotalAmount.amount),
      shipping,
      tax: parseFloat(cost.totalTaxAmount.amount),
      total: parseFloat(cost.totalAmount.amount),
      currency: cost.totalAmount.currencyCode,
    };
  }
}

// ============================================================================
// Shopify Connector
// ============================================================================

export class ShopifyConnector extends BaseConnector {
  private productBackend: ShopifyProductBackend;
  private cartBackend: ShopifyCartBackend;
  private orderBackend: ShopifyOrderBackend;

  constructor(config: ShopifyConnectorConfig) {
    super(config);
    this.productBackend = new ShopifyProductBackend(config);
    this.cartBackend = new ShopifyCartBackend(config, this.productBackend);
    this.orderBackend = new ShopifyOrderBackend(config);
  }

  protected validateConfig(): void {
    super.validateConfig();
    const config = this.config as ShopifyConnectorConfig;
    
    if (!config.domain) {
      throw new Error('Shopify domain is required');
    }
    if (!config.accessToken) {
      throw new Error('Shopify access token is required');
    }
    
    // Normalize domain (remove https:// if present)
    if (config.domain.startsWith('http')) {
      config.domain = config.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    
    // Set default API version
    if (!config.apiVersion) {
      config.apiVersion = '2024-01';
    }
  }

  getBackends(): GatewayBackends {
    return {
      products: this.productBackend,
      cart: this.cartBackend,
      orders: this.orderBackend,
    };
  }
}
