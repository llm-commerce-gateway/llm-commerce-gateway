/**
 * @betterdata/llm-gateway-woocommerce - WooCommerce Connector
 * 
 * Official WooCommerce connector for the Better Data LLM Gateway.
 * Implements the GatewayBackends interface using WooCommerce REST API.
 * 
 * @example
 * ```typescript
 * import { WooCommerceConnector } from '@betterdata/llm-gateway-woocommerce';
 * 
 * const connector = new WooCommerceConnector({
 *   url: 'https://your-store.com',
 *   consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
 *   consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
 *   version: 'wc/v3',
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

export interface WooCommerceConnectorConfig extends BaseConnectorConfig {
  /** WordPress site URL */
  url: string;
  /** WooCommerce REST API consumer key */
  consumerKey: string;
  /** WooCommerce REST API consumer secret */
  consumerSecret: string;
  /** API version (default: 'wc/v3') */
  version?: string;
}

// ============================================================================
// WooCommerce API Types
// ============================================================================

interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: 'simple' | 'grouped' | 'external' | 'variable';
  status: 'draft' | 'pending' | 'private' | 'publish';
  featured: boolean;
  catalog_visibility: 'visible' | 'catalog' | 'search' | 'hidden';
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from?: string;
  date_on_sale_to?: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: unknown[];
  download_limit: number;
  download_expiry: number;
  external_url?: string;
  button_text?: string;
  tax_status: 'taxable' | 'shipping' | 'none';
  tax_class: string;
  manage_stock: boolean;
  stock_quantity?: number;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  backorders: 'no' | 'notify' | 'yes';
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class?: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: Array<{
    id: number;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: Array<{
    id: number;
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }>;
  default_attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: unknown;
  }>;
}

interface WooCommerceVariation {
  id: number;
  date_created: string;
  date_modified: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  status: 'publish' | 'private' | 'draft';
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  downloads: unknown[];
  download_limit: number;
  download_expiry: number;
  tax_status: 'taxable' | 'shipping' | 'none';
  tax_class: string;
  manage_stock: boolean;
  stock_quantity?: number;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  backorders: 'no' | 'notify' | 'yes';
  backorders_allowed: boolean;
  backordered: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_class?: string;
  image?: {
    id: number;
    src: string;
    name: string;
    alt: string;
  };
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: unknown;
  }>;
}

// ============================================================================
// WooCommerce Product Backend
// ============================================================================

class WooCommerceProductBackend implements ProductBackend {
  private client: HTTPClient;

  constructor(private config: WooCommerceConnectorConfig) {
    const baseUrl = `${config.url}wp-json/${config.version}`;
    
    // WooCommerce uses Basic Auth with consumer key/secret
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const limit = Math.min(options?.limit ?? 20, 100); // WooCommerce max is 100
    const offset = options?.offset ?? 0;

    const params: Record<string, string | number> = {
      per_page: limit,
      page: Math.floor(offset / limit) + 1,
      status: 'publish',
    };

    if (query) {
      params.search = query;
    }

    if (filters?.category) {
      params.category = filters.category;
    }

    if (filters?.inStock) {
      params.stock_status = 'instock';
    }

    try {
      const products = await this.client.get<WooCommerceProduct[]>('/products', params);

      // Apply price filtering
      let filteredProducts = products;
      if (filters?.priceMin || filters?.priceMax) {
        filteredProducts = products.filter(p => {
          const price = parseFloat(p.price || p.regular_price || '0');
          if (filters.priceMin && price < filters.priceMin) return false;
          if (filters.priceMax && price > filters.priceMax) return false;
          return true;
        });
      }

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
        total: mappedProducts.length,
        hasMore: products.length === limit,
        facets: {
          categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({ name, count })),
        },
      };
    } catch (error) {
      throw new Error(`WooCommerce product search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    try {
      const product = await this.client.get<WooCommerceProduct>(`/products/${productId}`);

      // If it's a variable product, fetch variations
      if (product.type === 'variable' && product.variations.length > 0) {
        const variations = await Promise.all(
          product.variations.slice(0, 50).map(id =>
            this.client.get<WooCommerceVariation>(`/products/${productId}/variations/${id}`).catch(() => null)
          )
        );

        return this.mapProduct(product, variations.filter((v): v is WooCommerceVariation => v !== null));
      }

      return this.mapProduct(product);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new Error(`WooCommerce product details failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]> {
    const results = await Promise.all(
      productIds.map(async (productId) => {
        try {
          const product = await this.client.get<WooCommerceProduct>(`/products/${productId}`);

          const inStock = product.stock_status === 'instock';
          const quantity = product.manage_stock && product.stock_quantity !== undefined
            ? product.stock_quantity
            : (inStock ? 999 : 0); // If not managing stock, assume available if in stock

          return {
            productId,
            inStock,
            quantity,
          };
        } catch (error) {
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

    let params: Record<string, string | number> = {
      per_page: limit * 2,
      status: 'publish',
    };

    if (strategy === 'trending') {
      params.orderby = 'popularity';
      params.order = 'desc';
    } else if (productIds && productIds.length > 0) {
      // Get related products
      try {
        const sourceProduct = await this.getProductDetails(productIds[0]!);
        if (sourceProduct && sourceProduct.category) {
          params.category = sourceProduct.category;
        }
      } catch (error) {
        // Fallback to featured
        params.featured = 'true';
      }
    } else {
      params.featured = 'true';
    }

    const products = await this.client.get<WooCommerceProduct[]>('/products', params);
    const mappedProducts = await Promise.all(
      products.map(p => this.mapProduct(p))
    );

    return mappedProducts
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

  private async mapProduct(
    p: WooCommerceProduct,
    variations?: WooCommerceVariation[]
  ): Promise<Product> {
    const price = parseFloat(p.sale_price || p.price || p.regular_price || '0');
    const compareAtPrice = p.sale_price && p.regular_price ? parseFloat(p.regular_price) : undefined;

    // Map variations if available
    const mappedVariations = variations?.map(v => ({
      id: String(v.id),
      name: v.attributes.map(a => `${a.name}: ${a.option}`).join(', ') || 'Default',
      sku: v.sku,
      price: {
        amount: parseFloat(v.sale_price || v.price || v.regular_price || '0'),
        currency: 'USD', // WooCommerce doesn't return currency, assume USD
      },
      attributes: v.attributes.reduce((acc, a) => {
        acc[a.name] = a.option;
        return acc;
      }, {} as Record<string, string>),
      availability: {
        inStock: v.stock_status === 'instock',
        quantity: v.manage_stock && v.stock_quantity !== undefined ? v.stock_quantity : (v.stock_status === 'instock' ? 999 : 0),
      },
    }));

    return {
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      description: p.description || p.short_description || '',
      price: {
        amount: price,
        currency: 'USD',
        compareAtPrice,
      },
      images: p.images.map(img => ({
        url: img.src,
        alt: img.alt || p.name,
      })),
      category: p.categories[0]?.name,
      tags: p.tags.map(t => t.name),
      variants: mappedVariations,
      availability: {
        inStock: p.stock_status === 'instock',
        quantity: p.manage_stock && p.stock_quantity !== undefined
          ? p.stock_quantity
          : (p.stock_status === 'instock' ? 999 : 0),
      },
      attributes: p.meta_data.reduce((acc, meta) => {
        if (typeof meta.value === 'string' || typeof meta.value === 'number') {
          acc[meta.key] = String(meta.value);
        }
        return acc;
      }, {} as Record<string, string>),
    };
  }
}

// ============================================================================
// WooCommerce Cart Backend
// ============================================================================

// WooCommerce doesn't have a native cart API, so we use in-memory session storage
// In production, this should be replaced with Redis or database storage

class WooCommerceCartBackend implements CartBackend {
  private client: HTTPClient;
  private productBackend: WooCommerceProductBackend;
  private carts = new Map<string, Cart>(); // cartId -> Cart
  private sessionToCart = new Map<string, string>(); // sessionId -> cartId

  constructor(
    private config: WooCommerceConnectorConfig,
    productBackend: WooCommerceProductBackend
  ) {
    const baseUrl = `${config.url}wp-json/${config.version}`;
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    this.productBackend = productBackend;
  }

  async createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart> {
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const cart: Cart = {
      id: cartId,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
      metadata,
    };

    this.carts.set(cartId, cart);
    this.sessionToCart.set(sessionId, cartId);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    return this.carts.get(cartId) || null;
  }

  async getOrCreateCart(sessionId: string): Promise<Cart> {
    const existingCartId = this.sessionToCart.get(sessionId);
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
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    // Get product details
    const product = await this.productBackend.getProductDetails(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    // Determine variant
    let variant = product.variants?.find(v => v.id === item.variantId);
    if (!variant && item.variantId) {
      throw new Error(`Variant not found: ${item.variantId}`);
    }

    const unitPrice = variant?.price?.amount ?? product.price.amount;
    const itemName = variant ? `${product.name} - ${variant.name}` : product.name;

    // Check if item already exists
    const existingIndex = cart.items.findIndex(
      i => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingIndex >= 0) {
      const existing = cart.items[existingIndex]!;
      existing.quantity += item.quantity;
      existing.totalPrice = existing.unitPrice * existing.quantity;
    } else {
      const cartItem: CartItem = {
        id: `item_${Date.now()}`,
        productId: item.productId,
        variantId: item.variantId,
        name: itemName,
        sku: variant?.sku ?? (product as { sku?: string }).sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        imageUrl: product.images?.[0]?.url,
      };
      cart.items.push(cartItem);
    }

    // Update totals
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async updateCartItem(cartId: string, itemId: string, quantity: number): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    const item = cart.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    item.quantity = quantity;
    item.totalPrice = item.unitPrice * quantity;

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    cart.items = cart.items.filter(i => i.id !== itemId);
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async clearCart(cartId: string): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    cart.items = [];
    cart.subtotal = 0;
    cart.total = 0;
    cart.itemCount = 0;

    this.carts.set(cartId, cart);
    return cart;
  }
}

// ============================================================================
// WooCommerce Order Backend
// ============================================================================

interface WooCommerceOrder {
  id: number;
  parent_id: number;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  order_key: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_ip_address: string;
  customer_user_agent: string;
  created_via: string;
  customer_note: string;
  date_completed?: string;
  date_paid?: string;
  cart_hash: string;
  number: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: unknown;
  }>;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    taxes: unknown[];
    meta_data: Array<{
      id: number;
      key: string;
      value: unknown;
    }>;
    sku: string;
    price: number;
  }>;
  tax_lines: unknown[];
  shipping_lines: Array<{
    id: number;
    method_title: string;
    method_id: string;
    total: string;
    total_tax: string;
    taxes: unknown[];
  }>;
  fee_lines: unknown[];
  coupon_lines: unknown[];
  refunds: unknown[];
}

class WooCommerceOrderBackend implements OrderBackend {
  private client: HTTPClient;

  constructor(private config: WooCommerceConnectorConfig) {
    const baseUrl = `${config.url}wp-json/${config.version}`;
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    this.client = new HTTPClient({
      baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
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
    const orderData = {
      payment_method: payment?.method || 'bacs', // Bank transfer default
      payment_method_title: payment?.method || 'Direct bank transfer',
      set_paid: false,
      billing: {
        first_name: billingAddress?.firstName || shippingAddress.firstName,
        last_name: billingAddress?.lastName || shippingAddress.lastName,
        company: billingAddress?.company || '',
        address_1: billingAddress?.address1 || shippingAddress.address1,
        address_2: billingAddress?.address2 || shippingAddress.address2 || '',
        city: billingAddress?.city || shippingAddress.city,
        state: billingAddress?.state || shippingAddress.state,
        postcode: billingAddress?.postalCode || shippingAddress.postalCode,
        country: billingAddress?.country || shippingAddress.country,
        email: billingAddress?.email || shippingAddress.email || '',
        phone: billingAddress?.phone || shippingAddress.phone || '',
      },
      shipping: {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        company: shippingAddress.company || '',
        address_1: shippingAddress.address1,
        address_2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        postcode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      line_items: cart.items.map(item => ({
        product_id: parseInt(item.productId, 10),
        variation_id: item.variantId ? parseInt(item.variantId, 10) : 0,
        quantity: item.quantity,
      })),
      customer_note: options?.notes || (options?.isGift ? options.giftMessage : ''),
      meta_data: options?.isGift ? [{
        key: '_is_gift',
        value: 'yes',
      }] : [],
    };

    const order = await this.client.post<WooCommerceOrder>('/orders', orderData);

    return {
      id: String(order.id),
      orderNumber: order.number || String(order.id),
      status: order.status,
      items: cart.items,
      subtotal: parseFloat(order.total) - parseFloat(order.shipping_total) - parseFloat(order.total_tax),
      shipping: parseFloat(order.shipping_total),
      tax: parseFloat(order.total_tax),
      total: parseFloat(order.total),
      currency: order.currency,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      createdAt: new Date(order.date_created),
    };
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const order = await this.client.get<WooCommerceOrder>(`/orders/${orderId}`);
      return this.mapOrder(order);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const orders = await this.client.get<WooCommerceOrder[]>('/orders', {
        number: orderNumber,
      });

      if (orders.length === 0) {
        return null;
      }

      return this.mapOrder(orders[0]!);
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
    // WooCommerce doesn't have a calculate endpoint, so we estimate
    // In production, you might want to use WooCommerce's shipping calculator
    const subtotal = cart.subtotal;
    
    // Estimate shipping (simplified - in production, use WooCommerce shipping calculator)
    const shipping = subtotal >= 75 ? 0 : 9.99;
    
    // Estimate tax (simplified - in production, use WooCommerce tax calculator)
    const taxRate = 0.0825; // 8.25% example
    const tax = (subtotal + shipping) * taxRate;
    const total = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      total,
      currency: cart.currency,
    };
  }

  private mapOrder(o: WooCommerceOrder): Order {
    return {
      id: String(o.id),
      orderNumber: o.number || String(o.id),
      status: o.status,
      items: o.line_items.map(item => ({
        productId: String(item.product_id),
        variantId: item.variation_id > 0 ? String(item.variation_id) : undefined,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: parseFloat(item.total),
      })),
      subtotal: parseFloat(o.total) - parseFloat(o.shipping_total) - parseFloat(o.total_tax),
      shipping: parseFloat(o.shipping_total),
      tax: parseFloat(o.total_tax),
      total: parseFloat(o.total),
      currency: o.currency,
      shippingAddress: {
        firstName: o.shipping.first_name,
        lastName: o.shipping.last_name,
        company: o.shipping.company,
        address1: o.shipping.address_1,
        address2: o.shipping.address_2,
        city: o.shipping.city,
        state: o.shipping.state,
        postalCode: o.shipping.postcode,
        country: o.shipping.country,
      },
      billingAddress: {
        firstName: o.billing.first_name,
        lastName: o.billing.last_name,
        company: o.billing.company,
        address1: o.billing.address_1,
        address2: o.billing.address_2,
        city: o.billing.city,
        state: o.billing.state,
        postalCode: o.billing.postcode,
        country: o.billing.country,
        email: o.billing.email,
        phone: o.billing.phone,
      },
      createdAt: new Date(o.date_created),
    };
  }
}

// ============================================================================
// WooCommerce Connector
// ============================================================================

export class WooCommerceConnector extends BaseConnector {
  private productBackend: WooCommerceProductBackend;
  private cartBackend: WooCommerceCartBackend;
  private orderBackend: WooCommerceOrderBackend;

  constructor(config: WooCommerceConnectorConfig) {
    super(config);
    this.productBackend = new WooCommerceProductBackend(config);
    this.cartBackend = new WooCommerceCartBackend(config, this.productBackend);
    this.orderBackend = new WooCommerceOrderBackend(config);
  }

  protected validateConfig(): void {
    super.validateConfig();
    const config = this.config as WooCommerceConnectorConfig;
    
    if (!config.url) {
      throw new Error('WooCommerce URL is required');
    }
    if (!config.consumerKey) {
      throw new Error('WooCommerce consumer key is required');
    }
    if (!config.consumerSecret) {
      throw new Error('WooCommerce consumer secret is required');
    }
    
    // Normalize URL (ensure it ends with /)
    if (!config.url.endsWith('/')) {
      config.url = config.url + '/';
    }
    
    // Set default API version
    if (!config.version) {
      config.version = 'wc/v3';
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
