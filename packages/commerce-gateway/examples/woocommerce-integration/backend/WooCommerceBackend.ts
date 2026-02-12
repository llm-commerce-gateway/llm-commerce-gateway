/**
 * WooCommerce Integration - Backend Implementation
 * 
 * Uses WooCommerce REST API for product and order management.
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

// WooCommerce API Types
interface WooProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  images: Array<{ id: number; src: string; alt: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  tags: Array<{ id: number; name: string; slug: string }>;
  attributes: Array<{ id: number; name: string; options: string[] }>;
  variations: number[];
  average_rating: string;
  rating_count: number;
}

interface WooVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  stock_status: string;
  stock_quantity: number | null;
  attributes: Array<{ id: number; name: string; option: string }>;
}

interface WooOrder {
  id: number;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  shipping_total: string;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    subtotal: string;
    total: string;
  }>;
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  date_created: string;
}

export interface WooCommerceConfig {
  /** WordPress site URL (e.g., 'https://myshop.com') */
  siteUrl: string;
  /** WooCommerce Consumer Key */
  consumerKey: string;
  /** WooCommerce Consumer Secret */
  consumerSecret: string;
  /** API version (default: wc/v3) */
  apiVersion?: string;
}

export class WooCommerceBackend implements ProductBackend, CartBackend, OrderBackend {
  private siteUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private apiVersion: string;

  // In-memory cart storage (WooCommerce doesn't have a cart API)
  private carts: Map<string, Cart> = new Map();

  constructor(config: WooCommerceConfig) {
    this.siteUrl = config.siteUrl.replace(/\/$/, '');
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.apiVersion = config.apiVersion ?? 'wc/v3';
  }

  // ============================================================================
  // Product Backend
  // ============================================================================

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    const params = new URLSearchParams();
    
    if (query) params.set('search', query);
    params.set('per_page', String(options?.limit ?? 10));
    params.set('page', String(Math.floor((options?.offset ?? 0) / (options?.limit ?? 10)) + 1));
    
    if (filters?.category) params.set('category', filters.category);
    if (filters?.priceMin !== undefined) params.set('min_price', String(filters.priceMin));
    if (filters?.priceMax !== undefined) params.set('max_price', String(filters.priceMax));
    if (filters?.inStock) params.set('stock_status', 'instock');

    const products = await this.apiRequest<WooProduct[]>(`products?${params}`);
    
    return {
      products: products.map(p => this.mapProduct(p)),
      total: products.length,
      hasMore: products.length === (options?.limit ?? 10),
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    try {
      const product = await this.apiRequest<WooProduct>(`products/${productId}`);
      
      // Fetch variations if product has them
      let variations: WooVariation[] = [];
      if (product.variations.length > 0) {
        variations = await this.apiRequest<WooVariation[]>(`products/${productId}/variations`);
      }

      return this.mapProduct(product, variations);
    } catch {
      return null;
    }
  }

  async checkInventory(productIds: string[]): Promise<InventoryStatus[]> {
    const results: InventoryStatus[] = [];

    for (const productId of productIds) {
      const product = await this.getProductDetails(productId);
      if (!product) {
        results.push({ productId, available: false, quantity: 0 });
        continue;
      }

      results.push({
        productId,
        available: product.inStock ?? false,
        quantity: product.inStock ? 10 : 0, // WooCommerce may not expose exact qty
      });
    }

    return results;
  }

  async getRecommendations(context: {
    productIds?: string[];
    strategy?: string;
  }): Promise<Recommendation[]> {
    // Get related products or featured products
    let products: WooProduct[];

    if (context.productIds?.length) {
      // Get related products
      const productId = context.productIds[0];
      const product = await this.apiRequest<WooProduct>(`products/${productId}`);
      const categoryId = product.categories[0]?.id;
      
      if (categoryId) {
        products = await this.apiRequest<WooProduct[]>(
          `products?category=${categoryId}&per_page=5&exclude=${productId}`
        );
      } else {
        products = await this.apiRequest<WooProduct[]>('products?per_page=5&featured=true');
      }
    } else {
      // Get featured products
      products = await this.apiRequest<WooProduct[]>('products?per_page=5&featured=true');
    }

    return products.map((product, i) => ({
      product: this.mapProduct(product),
      score: 1 - i * 0.1,
      reason: context.productIds?.length ? 'Related product' : 'Featured product',
      strategy: (context.strategy as any) ?? 'similar',
    }));
  }

  // ============================================================================
  // Cart Backend (In-Memory - WooCommerce doesn't have REST cart API)
  // ============================================================================

  async createCart(sessionId: string): Promise<Cart> {
    const cart: Cart = {
      id: `woo_cart_${Date.now()}`,
      sessionId,
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      itemCount: 0,
    };

    this.carts.set(cart.id, cart);
    return cart;
  }

  async getCart(cartId: string): Promise<Cart | null> {
    return this.carts.get(cartId) ?? null;
  }

  async addToCart(cartId: string, input: AddToCartInput): Promise<{ cart: Cart; addedItem: CartItem }> {
    let cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    const product = await this.getProductDetails(input.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const variant = input.variantId
      ? product.variants?.find(v => v.id === input.variantId)
      : product.variants?.[0];

    const price = variant?.price?.amount ?? product.price.amount;
    const quantity = input.quantity ?? 1;

    // Check if item already in cart
    const existingIndex = cart.items.findIndex(
      i => i.productId === input.productId && i.variantId === input.variantId
    );

    let addedItem: CartItem;

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].totalPrice = cart.items[existingIndex].unitPrice * cart.items[existingIndex].quantity;
      addedItem = cart.items[existingIndex];
    } else {
      addedItem = {
        id: `item_${Date.now()}`,
        productId: input.productId,
        variantId: input.variantId,
        name: product.name + (variant ? ` - ${variant.name}` : ''),
        sku: variant?.sku ?? input.productId,
        quantity,
        unitPrice: price,
        totalPrice: price * quantity,
        imageUrl: product.imageUrl,
      };
      cart.items.push(addedItem);
    }

    // Recalculate
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return { cart, addedItem };
  }

  async updateCartItem(cartId: string, itemId: string, updates: { quantity?: number }): Promise<Cart> {
    const cart = this.carts.get(cartId);
    if (!cart) throw new Error('Cart not found');

    const itemIndex = cart.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) throw new Error('Item not found');

    if (updates.quantity !== undefined) {
      if (updates.quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = updates.quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].unitPrice * updates.quantity;
      }
    }

    cart.subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    cart.total = cart.subtotal;
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    this.carts.set(cartId, cart);
    return cart;
  }

  async removeFromCart(cartId: string, itemId: string): Promise<Cart> {
    return this.updateCartItem(cartId, itemId, { quantity: 0 });
  }

  async clearCart(cartId: string): Promise<void> {
    this.carts.delete(cartId);
  }

  // ============================================================================
  // Order Backend
  // ============================================================================

  async createOrder(cart: Cart, shippingAddress: ShippingAddress): Promise<Order> {
    const lineItems = cart.items.map(item => ({
      product_id: parseInt(item.productId),
      variation_id: item.variantId ? parseInt(item.variantId) : undefined,
      quantity: item.quantity,
    }));

    const orderData = {
      payment_method: 'pending',
      payment_method_title: 'Pay Later',
      set_paid: false,
      billing: {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        address_1: shippingAddress.address1,
        address_2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postcode: shippingAddress.postalCode,
        country: shippingAddress.country,
        email: shippingAddress.email,
        phone: shippingAddress.phone,
      },
      shipping: {
        first_name: shippingAddress.firstName,
        last_name: shippingAddress.lastName,
        address_1: shippingAddress.address1,
        address_2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postcode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      line_items: lineItems,
    };

    const wooOrder = await this.apiRequest<WooOrder>('orders', 'POST', orderData);

    return this.mapOrder(wooOrder);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const wooOrder = await this.apiRequest<WooOrder>(`orders/${orderId}`);
      return this.mapOrder(wooOrder);
    } catch {
      return null;
    }
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    const wooOrder = await this.apiRequest<WooOrder>(`orders/${orderId}`, 'PUT', { status });
    return this.mapOrder(wooOrder);
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  private async apiRequest<T>(
    endpoint: string,
    method: string = 'GET',
    data?: unknown
  ): Promise<T> {
    const url = `${this.siteUrl}/wp-json/${this.apiVersion}/${endpoint}`;
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WooCommerce API error: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private mapProduct(p: WooProduct, variations?: WooVariation[]): Product {
    return {
      id: String(p.id),
      name: p.name,
      description: p.short_description || p.description,
      slug: p.slug,
      price: {
        amount: parseFloat(p.price || p.regular_price),
        currency: 'USD',
        compareAtPrice: p.on_sale ? parseFloat(p.regular_price) : undefined,
      },
      imageUrl: p.images[0]?.src,
      images: p.images.map(i => i.src),
      category: p.categories[0]?.name,
      tags: p.tags.map(t => t.name),
      variants: variations?.map(v => ({
        id: String(v.id),
        name: v.attributes.map(a => a.option).join(' / '),
        sku: v.sku,
        price: {
          amount: parseFloat(v.price || v.regular_price),
          currency: 'USD',
        },
        available: v.stock_status === 'instock',
        attributes: Object.fromEntries(v.attributes.map(a => [a.name, a.option])),
      })),
      attributes: Object.fromEntries(p.attributes.map(a => [a.name, a.options.join(', ')])),
      inStock: p.stock_status === 'instock',
      rating: parseFloat(p.average_rating),
      reviewCount: p.rating_count,
    };
  }

  private mapOrder(o: WooOrder): Order {
    return {
      id: String(o.id),
      status: this.mapOrderStatus(o.status),
      items: o.line_items.map(item => ({
        productId: String(item.product_id),
        variantId: item.variation_id ? String(item.variation_id) : undefined,
        name: item.name,
        sku: '',
        quantity: item.quantity,
        unitPrice: parseFloat(item.subtotal) / item.quantity,
        totalPrice: parseFloat(item.total),
      })),
      subtotal: parseFloat(o.subtotal),
      tax: parseFloat(o.total_tax),
      shipping: parseFloat(o.shipping_total),
      total: parseFloat(o.total),
      currency: o.currency,
      shippingAddress: {
        firstName: o.shipping.first_name,
        lastName: o.shipping.last_name,
        address1: o.shipping.address_1,
        address2: o.shipping.address_2,
        city: o.shipping.city,
        state: o.shipping.state,
        postalCode: o.shipping.postcode,
        country: o.shipping.country,
      },
      paymentStatus: 'pending',
      createdAt: new Date(o.date_created),
    };
  }

  private mapOrderStatus(status: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      pending: 'pending',
      processing: 'confirmed',
      'on-hold': 'pending',
      completed: 'delivered',
      cancelled: 'cancelled',
      refunded: 'cancelled',
      failed: 'cancelled',
    };
    return statusMap[status] ?? 'pending';
  }
}

