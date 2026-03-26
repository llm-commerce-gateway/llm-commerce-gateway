/**
 * @betterdata/llm-gateway-bigcommerce - BigCommerce Connector
 * 
 * Official BigCommerce connector for the Better Data LLM Gateway.
 * Implements the GatewayBackends interface using BigCommerce REST API.
 * 
 * @example
 * ```typescript
 * import { BigCommerceConnector } from '@betterdata/llm-gateway-bigcommerce';
 * 
 * const connector = new BigCommerceConnector({
 *   storeHash: process.env.BIGCOMMERCE_STORE_HASH!,
 *   accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN!,
 *   apiVersion: 'v3',
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
import { HTTPClient } from '../shared/http-client';
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

export interface BigCommerceConnectorConfig extends BaseConnectorConfig {
  /** BigCommerce store hash */
  storeHash: string;
  /** OAuth access token */
  accessToken: string;
  /** API version (default: 'v3') */
  apiVersion?: string;
}

// ============================================================================
// BigCommerce API Types
// ============================================================================

interface BigCommerceProduct {
  id: number;
  name: string;
  description: string;
  sku: string;
  price: string;
  sale_price?: string;
  retail_price?: string;
  map_price?: string;
  weight: string;
  width: string;
  depth: string;
  height: string;
  fixed_cost_shipping_price?: string;
  is_free_shipping: boolean;
  inventory_level: number;
  inventory_warning_level: number;
  inventory_tracking: 'none' | 'product' | 'variant';
  reviews_rating_sum: number;
  reviews_count: number;
  total_sold: number;
  is_visible: boolean;
  is_featured: boolean;
  related_products: number[];
  warranty: string;
  bin_picking_number: string;
  layout_file: string;
  upc?: string;
  mpn?: string;
  gtin?: string;
  search_keywords: string;
  availability: 'available' | 'disabled' | 'preorder';
  availability_description: string;
  gift_wrapping_options_type: 'any' | 'none' | 'list';
  sort_order: number;
  condition: 'New' | 'Used' | 'Refurbished';
  is_condition_shown: boolean;
  order_quantity_minimum: number;
  order_quantity_maximum: number;
  page_title: string;
  meta_keywords: string[];
  meta_description: string;
  date_created: string;
  date_modified: string;
  view_count: number;
  preorder_release_date?: string;
  preorder_message?: string;
  is_preorder_only: boolean;
  is_price_hidden: boolean;
  price_hidden_label: string;
  custom_url: {
    url: string;
    is_customized: boolean;
  };
  base_variant_id?: number;
  open_graph_type: 'product' | 'album' | 'book' | 'drink' | 'food' | 'game' | 'movie' | 'song' | 'tv_show';
  open_graph_title: string;
  open_graph_description: string;
  open_graph_use_meta_description: boolean;
  open_graph_use_product_name: boolean;
  open_graph_use_image: boolean;
  images?: Array<{
    id: number;
    product_id: number;
    image_file: string;
    is_thumbnail: boolean;
    sort_order: number;
    description: string;
    image_url: string;
    url_zoom?: string;
    url_standard?: string;
    url_thumbnail?: string;
    url_tiny?: string;
    date_modified: string;
  }>;
  variants?: BigCommerceVariant[];
  custom_fields?: Array<{
    id: number;
    name: string;
    value: string;
  }>;
  bulk_pricing_rules?: unknown[];
  primary_image?: {
    image_url: string;
  };
}

interface BigCommerceVariant {
  id: number;
  product_id: number;
  sku: string;
  sku_id?: number;
  price: string;
  calculated_price: string;
  sale_price?: string;
  retail_price?: string;
  map_price?: string;
  weight: string;
  width: string;
  depth: string;
  height: string;
  fixed_cost_shipping_price?: string;
  is_free_shipping: boolean;
  inventory_level: number;
  inventory_warning_level: number;
  bin_picking_number: string;
  mpn?: string;
  gtin?: string;
  upc?: string;
  image_url?: string;
  cost_price?: string;
  option_values: Array<{
    id: number;
    label: string;
    option_id: number;
    option_display_name: string;
  }>;
}

interface BigCommerceCart {
  id: string;
  customer_id: number;
  channel_id: number;
  email: string;
  currency: {
    code: string;
  };
  tax_included: boolean;
  base_amount: string;
  discount_amount: string;
  cart_amount: string;
  coupons: unknown[];
  line_items: {
    physical_items: Array<{
      id: string;
      parent_id?: string;
      variant_id: number;
      product_id: number;
      sku: string;
      name: string;
      url: string;
      quantity: number;
      taxable: boolean;
      image_url?: string;
      discounts: unknown[];
      discount_amount: string;
      coupon_amount: string;
      list_price: string;
      sale_price: string;
      extended_list_price: string;
      extended_sale_price: string;
      is_require_shipping: boolean;
      gift_wrapping?: unknown;
    }>;
    digital_items: unknown[];
    custom_items: unknown[];
    gift_certificates: unknown[];
  };
  created_time: string;
  updated_time: string;
}

// ============================================================================
// BigCommerce Product Backend
// ============================================================================

class BigCommerceProductBackend implements ProductBackend {
  private client: HTTPClient;

  constructor(private config: BigCommerceConnectorConfig) {
    const baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/${config.apiVersion}`;
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'X-Auth-Token': config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const limit = Math.min(options?.limit ?? 20, 250); // BigCommerce max is 250
    const offset = options?.offset ?? 0;

    // Build query parameters
    const params: Record<string, string | number> = {
      limit,
      page: Math.floor(offset / limit) + 1,
      'is_visible': 'true',
    };

    // Add search query
    if (query) {
      params['name:like'] = `%${query}%`;
    }

    // Add filters
    if (filters?.category) {
      params['categories:in'] = filters.category;
    }
    if (filters?.inStock) {
      params['inventory_level:gt'] = 0;
    }

    try {
      const products = await this.client.get<BigCommerceProduct[]>('/catalog/products', params);

      // Apply price filtering (BigCommerce doesn't support exact price ranges in query)
      let filteredProducts = products;
      if (filters?.priceMin || filters?.priceMax) {
        filteredProducts = products.filter(p => {
          const price = parseFloat(p.price);
          if (filters.priceMin && price < filters.priceMin) return false;
          if (filters.priceMax && price > filters.priceMax) return false;
          return true;
        });
      }

      // Map to our Product format
      const mappedProducts = await Promise.all(
        filteredProducts.map(p => this.mapProduct(p))
      );

      // Build facets
      const categoryCounts = new Map<string, number>();
      mappedProducts.forEach(p => {
        if (p.category) {
          categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
        }
      });

      return {
        products: mappedProducts,
        total: mappedProducts.length, // BigCommerce doesn't provide exact total in search
        hasMore: products.length === limit,
        facets: {
          categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count })),
        },
      };
    } catch (error) {
      throw new Error(`BigCommerce product search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    try {
      const product = await this.client.get<BigCommerceProduct>(`/catalog/products/${productId}`, {
        include: 'variants,images,custom_fields',
      });

      return this.mapProduct(product);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new Error(`BigCommerce product details failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    const results = await Promise.all(
      productIds.map(async (productId) => {
        try {
          const product = await this.client.get<BigCommerceProduct>(`/catalog/products/${productId}`, {
            include: 'variants',
          });

          // Get variants for inventory
          const variants = product.variants || [];
          const totalQuantity = variants.reduce((sum, v) => sum + v.inventory_level, 0);
          const inStock = variants.some(v => v.inventory_level > 0);

          return {
            productId,
            inStock,
            quantity: totalQuantity,
          };
        } catch (error) {
          // If product not found, return out of stock
          return {
            productId,
            inStock: false,
            quantity: 0,
          };
        }
      })
    );

    return results;
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

    let searchQuery = '';
    if (strategy === 'trending') {
      // Get featured products
      searchQuery = 'is_featured:true';
    } else if (productIds && productIds.length > 0) {
      // Get related products
      try {
        const sourceProduct = await this.getProductDetails(productIds[0]!);
        if (sourceProduct) {
          // Use related products from BigCommerce if available
          // Otherwise, search by category
          searchQuery = sourceProduct.category ? `categories:in:${sourceProduct.category}` : '';
        }
      } catch (error) {
        // Fallback to trending
        searchQuery = 'is_featured:true';
      }
    } else {
      searchQuery = 'is_featured:true';
    }

    const result = await this.searchProducts(searchQuery, undefined, { limit: limit * 2 });
    
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

  private async mapProduct(p: BigCommerceProduct): Promise<Product> {
    // Fetch variants if not included
    let variants = p.variants;
    if (!variants || variants.length === 0) {
      try {
        const variantData = await this.client.get<{ data: BigCommerceVariant[] }>(`/catalog/products/${p.id}/variants`);
        variants = variantData.data || [];
      } catch (error) {
        variants = [];
      }
    }

    const basePrice = parseFloat(p.sale_price || p.price);
    const compareAtPrice = p.retail_price ? parseFloat(p.retail_price) : undefined;

    return {
      id: String(p.id),
      name: p.name,
      slug: p.custom_url?.url || p.name.toLowerCase().replace(/\s+/g, '-'),
      description: p.description || '',
      price: {
        amount: basePrice,
        currency: 'USD', // BigCommerce doesn't return currency in product, assume USD
        compareAtPrice,
      },
      images: p.images?.map(img => ({
        url: img.image_url,
        alt: img.description || p.name,
      })) || (p.primary_image ? [{ url: p.primary_image.image_url, alt: p.name }] : []),
      category: undefined, // Would need to fetch categories separately
      tags: p.search_keywords ? p.search_keywords.split(',') : [],
      variants: variants.map(v => ({
        id: String(v.id),
        name: v.option_values.map(ov => ov.label).join(' / ') || 'Default',
        sku: v.sku,
        price: {
          amount: parseFloat(v.sale_price || v.price),
          currency: 'USD',
        },
        attributes: v.option_values.reduce((acc, ov) => {
          acc[ov.option_display_name] = ov.label;
          return acc;
        }, {} as Record<string, string>),
        availability: {
          inStock: v.inventory_level > 0,
          quantity: v.inventory_level,
        },
      })),
      availability: {
        inStock: p.inventory_level > 0 || (variants.length > 0 && variants.some(v => v.inventory_level > 0)),
        quantity: p.inventory_level || variants.reduce((sum, v) => sum + v.inventory_level, 0),
      },
      attributes: p.custom_fields?.reduce((acc, cf) => {
        acc[cf.name] = cf.value;
        return acc;
      }, {} as Record<string, string>) || {},
    };
  }
}

// ============================================================================
// BigCommerce Cart Backend
// ============================================================================

class BigCommerceCartBackend implements CartBackend {
  private client: HTTPClient;
  private cartStorage = new Map<string, string>(); // sessionId -> cartId

  constructor(private config: BigCommerceConnectorConfig) {
    const baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/${config.apiVersion}`;
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'X-Auth-Token': config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart> {
    const cartData = {
      customer_id: 0, // Guest cart
      line_items: [],
      ...metadata,
    };

    const cart = await this.client.post<{ data: BigCommerceCart }>('/carts', { data: cartData });
    const mappedCart = this.mapCart(cart.data, sessionId);
    this.cartStorage.set(sessionId, mappedCart.id);
    return mappedCart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    try {
      const cart = await this.client.get<{ data: BigCommerceCart }>(`/carts/${cartId}`);
      return this.mapCart(cart.data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
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
    options?: { reserveInventory?: boolean; reserveDurationMinutes?: number }
  ): Promise<Cart> {
    const lineItem: {
      product_id: number;
      variant_id?: number;
      quantity: number;
    } = {
      product_id: parseInt(item.productId, 10),
      quantity: item.quantity,
    };

    if (item.variantId) {
      lineItem.variant_id = parseInt(item.variantId, 10);
    }

    await this.client.post(`/carts/${cartId}/items`, {
      data: lineItem,
    });

    const updatedCart = await this.getCart(cartId);
    if (!updatedCart) {
      throw new Error('Failed to retrieve cart after adding item');
    }
    return updatedCart;
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    await this.client.put(`/carts/${cartId}/items/${itemId}`, {
      data: { quantity },
    });

    const updatedCart = await this.getCart(cartId);
    if (!updatedCart) {
      throw new Error('Failed to retrieve cart after updating item');
    }
    return updatedCart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    await this.client.delete(`/carts/${cartId}/items/${itemId}`);

    const updatedCart = await this.getCart(cartId);
    if (!updatedCart) {
      throw new Error('Failed to retrieve cart after removing item');
    }
    return updatedCart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    // Remove all items
    for (const item of cart.items) {
      if (item.id) {
        await this.removeFromCart(cartId, item.id);
      }
    }

    const clearedCart = await this.getCart(cartId);
    return clearedCart || cart;
  }

  private mapCart(c: BigCommerceCart, sessionId?: string): Cart {
    const items: CartItem[] = c.line_items.physical_items.map(item => ({
      id: item.id,
      productId: String(item.product_id),
      variantId: String(item.variant_id),
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: parseFloat(item.sale_price || item.list_price),
      totalPrice: parseFloat(item.extended_sale_price || item.extended_list_price),
      imageUrl: item.image_url,
    }));

    return {
      id: c.id,
      sessionId,
      items,
      subtotal: parseFloat(c.base_amount),
      total: parseFloat(c.cart_amount),
      currency: c.currency.code,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }
}

// ============================================================================
// BigCommerce Order Backend
// ============================================================================

interface BigCommerceOrder {
  id: number;
  customer_id: number;
  date_created: string;
  date_modified: string;
  date_shipped?: string;
  status_id: number;
  status: string;
  subtotal_ex_tax: string;
  subtotal_inc_tax: string;
  subtotal_tax: string;
  base_shipping_cost: string;
  shipping_cost_ex_tax: string;
  shipping_cost_inc_tax: string;
  shipping_cost_tax: string;
  shipping_cost_tax_class_id: number;
  base_handling_cost: string;
  handling_cost_ex_tax: string;
  handling_cost_inc_tax: string;
  handling_cost_tax: string;
  handling_cost_tax_class_id: number;
  base_wrapping_cost: string;
  wrapping_cost_ex_tax: string;
  wrapping_cost_inc_tax: string;
  wrapping_cost_tax: string;
  wrapping_cost_tax_class_id: number;
  total_ex_tax: string;
  total_inc_tax: string;
  total_tax: string;
  items_total: number;
  items_shipped: number;
  payment_method: string;
  payment_provider_id?: string;
  payment_status: string;
  refunded_amount: string;
  order_is_digital: boolean;
  store_credit_amount: string;
  gift_certificate_amount: string;
  currency_code: string;
  currency_exchange_rate: string;
  default_currency_code: string;
  coupon_discount: string;
  shipping_address_count: number;
  is_deleted: boolean;
  ebay_order_id?: string;
  cart_id?: string;
  billing_address: {
    first_name: string;
    last_name: string;
    company: string;
    street_1: string;
    street_2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_iso2: string;
    phone: string;
    email: string;
  };
  shipping_addresses: Array<{
    first_name: string;
    last_name: string;
    company: string;
    street_1: string;
    street_2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_iso2: string;
    phone: string;
    email: string;
  }>;
  products: Array<{
    id: number;
    order_product_id: number;
    product_id: number;
    order_address_id: number;
    name: string;
    name_customer: string;
    name_merchant: string;
    sku: string;
    upc?: string;
    type: string;
    base_price: string;
    price_ex_tax: string;
    price_inc_tax: string;
    price_tax: string;
    base_total: string;
    total_ex_tax: string;
    total_inc_tax: string;
    total_tax: string;
    quantity: number;
    base_cost_price: string;
    cost_price_inc_tax: string;
    cost_price_ex_tax: string;
    weight: string;
    width: string;
    depth: string;
    height: string;
    fixed_cost_shipping_price: string;
    is_free_shipping: boolean;
    inventory_level: number;
    image_url?: string;
  }>;
}

class BigCommerceOrderBackend implements OrderBackend {
  private client: HTTPClient;

  constructor(private config: BigCommerceConnectorConfig) {
    const baseUrl = `https://api.bigcommerce.com/stores/${config.storeHash}/${config.apiVersion}`;
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'X-Auth-Token': config.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async createOrder(
    cart: Cart,
    shippingAddress: Address,
    billingAddress?: Address,
    payment?: PaymentInfo,
    options?: { notes?: string; isGift?: boolean; giftMessage?: string }
  ): Promise<Order> {
    // First, estimate shipping/tax
    const estimate = await this.calculateTotals(cart, shippingAddress);

    const orderData = {
      customer_id: 0, // Guest order
      status_id: 1, // Pending
      billing_address: {
        first_name: billingAddress?.firstName || shippingAddress.firstName,
        last_name: billingAddress?.lastName || shippingAddress.lastName,
        company: billingAddress?.company || '',
        street_1: billingAddress?.address1 || shippingAddress.address1,
        street_2: billingAddress?.address2 || shippingAddress.address2 || '',
        city: billingAddress?.city || shippingAddress.city,
        state: billingAddress?.state || shippingAddress.state,
        zip: billingAddress?.postalCode || shippingAddress.postalCode,
        country: billingAddress?.country || shippingAddress.country,
        phone: billingAddress?.phone || shippingAddress.phone || '',
        email: billingAddress?.email || shippingAddress.email || '',
      },
      shipping_addresses: [{
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        company: shippingAddress.company || '',
        street_1: shippingAddress.address1,
        street_2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.postalCode,
        country: shippingAddress.country,
        phone: shippingAddress.phone || '',
        email: shippingAddress.email || '',
      }],
      products: cart.items.map(item => ({
        product_id: parseInt(item.productId, 10),
        variant_id: item.variantId ? parseInt(item.variantId, 10) : undefined,
        quantity: item.quantity,
        price_inc_tax: item.unitPrice,
      })),
      subtotal_inc_tax: estimate.subtotal.toString(),
      shipping_cost_inc_tax: estimate.shipping.toString(),
      total_inc_tax: estimate.total.toString(),
      customer_message: options?.notes || '',
      staff_notes: options?.isGift ? options.giftMessage : undefined,
    };

    const order = await this.client.post<{ data: BigCommerceOrder }>('/orders', { data: orderData });

    return {
      id: String(order.data.id),
      orderNumber: String(order.data.id),
      status: order.data.status,
      items: cart.items,
      subtotal: estimate.subtotal,
      shipping: estimate.shipping,
      tax: estimate.tax,
      total: estimate.total,
      currency: order.data.currency_code,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      createdAt: new Date(order.data.date_created),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const order = await this.client.get<{ data: BigCommerceOrder }>(`/orders/${orderId}`);
      return this.mapOrder(order.data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const orders = await this.client.get<{ data: BigCommerceOrder[] }>('/orders', {
        'id:in': orderNumber,
      });
      
      if (orders.data.length === 0) {
        return null;
      }
      
      return this.mapOrder(orders.data[0]!);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async calculateTotals(
    cart: Cart,
    shippingAddress?: Address
  ): Promise<{ subtotal: number; shipping: number; tax: number; total: number; currency: string }> {
    if (!shippingAddress) {
      // Return cart totals without shipping/tax
      return {
        subtotal: cart.subtotal,
        shipping: 0,
        tax: 0,
        total: cart.subtotal,
        currency: cart.currency,
      };
    }

    try {
      // Use cart estimate endpoint
      const estimate = await this.client.post<{
        data: {
          shipping_cost: {
            amount: string;
            currency: string;
          };
          tax_total: {
            amount: string;
            currency: string;
          };
        };
      }>(`/carts/${cart.id}/estimate`, {
        data: {
          shipping_address: {
            first_name: shippingAddress.firstName,
            last_name: shippingAddress.lastName,
            street_1: shippingAddress.address1,
            street_2: shippingAddress.address2 || '',
            city: shippingAddress.city,
            state: shippingAddress.state,
            zip: shippingAddress.postalCode,
            country: shippingAddress.country,
          },
        },
      });

      const shipping = parseFloat(estimate.data.shipping_cost.amount);
      const tax = parseFloat(estimate.data.tax_total.amount);
      const subtotal = cart.subtotal;
      const total = subtotal + shipping + tax;

      return {
        subtotal,
        shipping,
        tax,
        total,
        currency: estimate.data.shipping_cost.currency || cart.currency,
      };
    } catch (error) {
      // If estimation fails, return cart totals
      return {
        subtotal: cart.subtotal,
        shipping: 0,
        tax: 0,
        total: cart.subtotal,
        currency: cart.currency,
      };
    }
  }

  private mapOrder(o: BigCommerceOrder): Order {
    const shippingAddress = o.shipping_addresses[0];
    
    return {
      id: String(o.id),
      orderNumber: String(o.id),
      status: o.status,
      items: o.products.map(p => ({
        productId: String(p.product_id),
        variantId: undefined,
        name: p.name,
        quantity: p.quantity,
        unitPrice: parseFloat(p.price_inc_tax),
        totalPrice: parseFloat(p.total_inc_tax),
      })),
      subtotal: parseFloat(o.subtotal_inc_tax),
      shipping: parseFloat(o.shipping_cost_inc_tax),
      tax: parseFloat(o.total_tax),
      total: parseFloat(o.total_inc_tax),
      currency: o.currency_code,
      shippingAddress: shippingAddress ? {
        firstName: shippingAddress.first_name,
        lastName: shippingAddress.last_name,
        company: shippingAddress.company,
        address1: shippingAddress.street_1,
        address2: shippingAddress.street_2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.zip,
        country: shippingAddress.country,
        phone: shippingAddress.phone,
        email: shippingAddress.email,
      } : undefined,
      billingAddress: {
        firstName: o.billing_address.first_name,
        lastName: o.billing_address.last_name,
        company: o.billing_address.company,
        address1: o.billing_address.street_1,
        address2: o.billing_address.street_2,
        city: o.billing_address.city,
        state: o.billing_address.state,
        postalCode: o.billing_address.zip,
        country: o.billing_address.country,
        phone: o.billing_address.phone,
        email: o.billing_address.email,
      },
      createdAt: new Date(o.date_created),
    };
  }
}

// ============================================================================
// BigCommerce Connector
// ============================================================================

export class BigCommerceConnector extends BaseConnector {
  private productBackend: BigCommerceProductBackend;
  private cartBackend: BigCommerceCartBackend;
  private orderBackend: BigCommerceOrderBackend;

  constructor(config: BigCommerceConnectorConfig) {
    super(config);
    this.productBackend = new BigCommerceProductBackend(config);
    this.cartBackend = new BigCommerceCartBackend(config);
    this.orderBackend = new BigCommerceOrderBackend(config);
  }

  protected validateConfig(): void {
    super.validateConfig();
    const config = this.config as BigCommerceConnectorConfig;
    
    if (!config.storeHash) {
      throw new Error('BigCommerce store hash is required');
    }
    if (!config.accessToken) {
      throw new Error('BigCommerce access token is required');
    }
    
    // Set default API version
    if (!config.apiVersion) {
      config.apiVersion = 'v3';
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
