/**
 * @betterdata/commerce-gateway - Backend Interfaces
 * 
 * These interfaces define the contract that ANY commerce platform must implement
 * to work with the LLM Gateway. They are intentionally minimal and generic.
 * 
 * @license Apache-2.0
 */

// ============================================================================
// Core Types
// ============================================================================

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  gtin?: string;
  price: {
    amount: number;
    currency: string;
    compareAtPrice?: number;
    formatted?: string;
    originalAmount?: number;
    sale?: boolean;
    validUntil?: string;
  };
  images?: Array<{
    url: string;
    alt?: string;
  }>;
  category?: string;
  tags?: string[];
  variants?: ProductVariant[];
  attributes?: Record<string, string | string[]>;
  availability?: {
    inStock: boolean;
    quantity?: number;
    leadTime?: string;
  };
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price?: {
    amount: number;
    currency: string;
  };
  attributes?: Record<string, string>;
  availability?: {
    inStock: boolean;
    quantity?: number;
  };
}

export interface ProductFilters {
  category?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  attributes?: Record<string, string | string[]>;
  filters?: object;
  limit?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  hasMore: boolean;
  facets?: {
    categories?: Array<{ name: string; count: number }>;
    priceRanges?: Array<{ min: number; max: number; count: number }>;
    attributes?: Record<string, Array<{ value: string; count: number }>>;
  };
}

/**
 * Lot/expiry information for inventory.
 *
 * 🟡 EXPERIMENTAL: Only populated when ENABLE_LOT_EXPIRY feature flag is enabled.
 * @see docs/contracts/llm-gateway-release-contract.md
 */
export interface LotExpiryInfo {
  /** Lot/batch number */
  lotNumber?: string;
  /** Product expiration date (ISO 8601) */
  expiryDate?: string;
  /** Manufacturing date (ISO 8601) */
  manufacturingDate?: string;
  /** Days until expiry */
  daysUntilExpiry?: number;
}

export interface InventoryStatus {
  productId: string;
  variantId?: string;
  inStock: boolean;
  quantity: number;
  available?: boolean;
  shippingEstimate?: string;
  locations?: Array<{
    locationId: string;
    locationName: string;
    quantity: number;
    leadTimeDays?: number;
    /**
     * 🟡 EXPERIMENTAL: Only populated when ENABLE_LOT_EXPIRY is enabled.
     */
    lotExpiry?: LotExpiryInfo;
  }>;
  /**
   * 🟡 EXPERIMENTAL: Only populated when ENABLE_LOT_EXPIRY feature flag is enabled.
   */
  lotExpiry?: LotExpiryInfo;
}

export interface Cart {
  id: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  itemCount: number;
  reservedUntil?: Date;
  checkoutUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CartItem {
  id?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  estimatedDelivery?: string;
  trackingUrl?: string;
  confirmationUrl?: string;
  createdAt: Date;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface PaymentInfo {
  method: 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'affirm' | 'klarna' | string;
  token?: string;
  metadata?: Record<string, unknown>;
}

export interface ShortLink {
  id: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface Recommendation {
  product: Product;
  reason: string;
  confidence: number;
  strategy: string;
}

// ============================================================================
// Backend Interfaces
// ============================================================================

/**
 * Product Backend Interface
 * 
 * Implement this to connect your product catalog to the LLM Gateway.
 * This could be Shopify, WooCommerce, custom database, or any other source.
 * 
 * @example
 * ```typescript
 * class ShopifyProductBackend implements ProductBackend {
 *   async searchProducts(query, filters) {
 *     // Call Shopify Storefront API
 *     return await shopifyClient.products.search({ query, ...filters });
 *   }
 * }
 * ```
 */
export interface ProductBackend {
  /**
   * Search products using natural language or structured query
   */
  searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult>;

  /**
   * Get detailed information about a specific product
   */
  getProductDetails(productId: string): Promise<Product | null>;

  /**
   * Check inventory status for products
   */
  checkInventory(
    productIds: string[],
    options?: { locationId?: string }
  ): Promise<InventoryStatus[]>;

  /**
   * Get product recommendations based on context
   */
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

/**
 * Cart Backend Interface
 * 
 * Implement this to connect your shopping cart system to the LLM Gateway.
 * 
 * @example
 * ```typescript
 * class StripeCartBackend implements CartBackend {
 *   async createCart(sessionId) {
 *     return await createStripeSession(sessionId);
 *   }
 * }
 * ```
 */
export interface CartBackend {
  /**
   * Create a new shopping cart
   */
  createCart(sessionId: string, metadata?: Record<string, unknown>): Promise<Cart>;

  /**
   * Get an existing cart by ID
   */
  getCart(cartId: string): Promise<Cart | null>;

  /**
   * Get or create cart for a session
   */
  getOrCreateCart(sessionId: string): Promise<Cart>;

  /**
   * Add an item to the cart
   */
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

  /**
   * Update item quantity in cart
   */
  updateCartItem(
    cartId: string,
    itemId: string,
    quantity: number
  ): Promise<Cart>;

  /**
   * Remove item from cart
   */
  removeFromCart(cartId: string, itemId: string): Promise<Cart>;

  /**
   * Clear all items from cart
   */
  clearCart(cartId: string): Promise<Cart>;
}

/**
 * Order Backend Interface
 * 
 * Implement this to connect your order management system to the LLM Gateway.
 */
export interface OrderBackend {
  /**
   * Create an order from a cart
   */
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

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Promise<Order | null>;

  /**
   * Get order by order number
   */
  getOrderByNumber?(orderNumber: string): Promise<Order | null>;

  /**
   * Calculate order totals before checkout
   */
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

/**
 * Link Generator Interface (Optional)
 * 
 * Implement this to generate short links for products and carts.
 * Compatible with Dub.co, Bit.ly, or custom short link services.
 */
export interface LinkGenerator {
  /**
   * Create a short link for a product
   */
  createProductLink(
    product: Product,
    context?: {
      sessionId?: string;
      campaign?: string;
      source?: string;
    }
  ): Promise<ShortLink>;

  /**
   * Create a short link for a cart/checkout
   */
  createCartLink(
    cart: Cart,
    expiryHours?: number
  ): Promise<ShortLink>;

  /**
   * Create a generic short link
   */
  createLink?(
    url: string,
    metadata?: Record<string, unknown>
  ): Promise<ShortLink>;

  /**
   * Track a conversion event
   */
  trackConversion?(
    linkId: string,
    event: {
      type: string;
      value?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void>;
}

// ============================================================================
// Composite Backend Configuration
// ============================================================================

/**
 * All backends that can be provided to the LLM Gateway
 */
export interface GatewayBackends {
  /** Product catalog backend (required) */
  products: ProductBackend;
  
  /** Shopping cart backend (required) */
  cart: CartBackend;
  
  /** Order management backend (required) */
  orders: OrderBackend;
  
  /** Short link generator (optional) */
  links?: LinkGenerator;
}
