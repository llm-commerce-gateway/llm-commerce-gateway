/**
 * @betterdata/commerce-gateway - Test Fixtures
 * 
 * Reusable test data and factory functions.
 * 
 * @license Apache-2.0
 */

import type {
  Product,
  Cart,
  CartItem,
  Order,
  InventoryStatus,
  Recommendation,
  ShortLink,
} from '../../src/backends/interfaces';

// ============================================================================
// ID Generators
// ============================================================================

let idCounter = 0;

export function generateId(prefix: string = 'test'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// Product Fixtures
// ============================================================================

export interface ProductFixtureOptions {
  id?: string;
  name?: string;
  slug?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  quantity?: number;
  category?: string;
  tags?: string[];
}

export function createProduct(options: ProductFixtureOptions = {}): Product {
  const id = options.id ?? generateId('prod');
  const name = options.name ?? `Test Product ${id}`;
  const slug = options.slug ?? name.toLowerCase().replace(/\s+/g, '-');
  
  return {
    id,
    name,
    slug,
    description: `Description for ${name}`,
    price: {
      amount: options.price ?? 50,
      currency: options.currency ?? 'USD',
    },
    images: [
      {
        url: `https://example.com/images/${id}.jpg`,
        alt: name,
      },
    ],
    category: options.category ?? 'test-category',
    tags: options.tags ?? [],
    attributes: {},
    availability: {
      inStock: options.inStock ?? true,
      quantity: options.quantity ?? 100,
    },
  };
}

export function createProductBatch(count: number, baseOptions: ProductFixtureOptions = {}): Product[] {
  return Array.from({ length: count }, (_, i) =>
    createProduct({
      ...baseOptions,
      id: `${baseOptions.id ?? 'prod'}-${i + 1}`,
      name: `${baseOptions.name ?? 'Test Product'} ${i + 1}`,
      price: (baseOptions.price ?? 50) + i * 10,
    })
  );
}

// ============================================================================
// Cart Fixtures
// ============================================================================

export interface CartFixtureOptions {
  id?: string;
  sessionId?: string;
  items?: CartItem[];
  currency?: string;
}

export function createCart(options: CartFixtureOptions = {}): Cart {
  const items = options.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  return {
    id: options.id ?? generateId('cart'),
    sessionId: options.sessionId ?? generateId('session'),
    items,
    subtotal,
    total: subtotal,
    currency: options.currency ?? 'USD',
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export interface CartItemFixtureOptions {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
}

export function createCartItem(options: CartItemFixtureOptions = {}): CartItem {
  const quantity = options.quantity ?? 1;
  const unitPrice = options.unitPrice ?? 50;
  
  return {
    id: options.id ?? generateId('item'),
    productId: options.productId ?? generateId('prod'),
    name: options.name ?? 'Test Item',
    quantity,
    unitPrice,
    totalPrice: quantity * unitPrice,
  };
}

export function createCartWithItems(itemCount: number = 2): Cart {
  const items = Array.from({ length: itemCount }, (_, i) =>
    createCartItem({
      name: `Item ${i + 1}`,
      quantity: i + 1,
      unitPrice: 25 + i * 10,
    })
  );
  
  return createCart({ items });
}

// ============================================================================
// Order Fixtures
// ============================================================================

export interface OrderFixtureOptions {
  id?: string;
  orderNumber?: string;
  status?: Order['status'];
  items?: Order['items'];
  subtotal?: number;
  currency?: string;
}

export function createOrder(options: OrderFixtureOptions = {}): Order {
  const items = options.items ?? [
    {
      productId: generateId('prod'),
      name: 'Test Item',
      quantity: 1,
      unitPrice: 50,
      totalPrice: 50,
    },
  ];
  
  const subtotal = options.subtotal ?? items.reduce((sum, i) => sum + i.totalPrice, 0);
  const tax = subtotal * 0.08;
  
  return {
    id: options.id ?? generateId('order'),
    orderNumber: options.orderNumber ?? `ORD-${Date.now()}`,
    status: options.status ?? 'pending',
    items,
    subtotal,
    tax,
    shipping: 0,
    total: subtotal + tax,
    currency: options.currency ?? 'USD',
    createdAt: new Date(),
  };
}

// ============================================================================
// Inventory Fixtures
// ============================================================================

export interface InventoryFixtureOptions {
  productId?: string;
  inStock?: boolean;
  quantity?: number;
  locationId?: string;
  locationName?: string;
  leadTimeDays?: number;
}

export function createInventoryStatus(options: InventoryFixtureOptions = {}): InventoryStatus {
  const quantity = options.quantity ?? 100;
  
  return {
    productId: options.productId ?? generateId('prod'),
    inStock: options.inStock ?? quantity > 0,
    quantity,
    locations: [
      {
        locationId: options.locationId ?? generateId('loc'),
        locationName: options.locationName ?? 'Test Warehouse',
        quantity,
        leadTimeDays: options.leadTimeDays,
      },
    ],
  };
}

// ============================================================================
// Recommendation Fixtures
// ============================================================================

export interface RecommendationFixtureOptions {
  product?: Product;
  confidence?: number;
  strategy?: Recommendation['strategy'];
  reason?: string;
}

export function createRecommendation(options: RecommendationFixtureOptions = {}): Recommendation {
  return {
    product: options.product ?? createProduct(),
    confidence: options.confidence ?? 0.85,
    strategy: options.strategy ?? 'similar',
    reason: options.reason ?? 'Based on similar products',
  };
}

export function createRecommendationBatch(count: number): Recommendation[] {
  return Array.from({ length: count }, (_, i) =>
    createRecommendation({
      product: createProduct({ name: `Recommended ${i + 1}` }),
      confidence: 0.9 - i * 0.1,
    })
  );
}

// ============================================================================
// Link Fixtures
// ============================================================================

export interface ShortLinkFixtureOptions {
  id?: string;
  shortUrl?: string;
  originalUrl?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export function createShortLink(options: ShortLinkFixtureOptions = {}): ShortLink {
  const id = options.id ?? generateId('link');
  
  return {
    id,
    shortUrl: options.shortUrl ?? `https://test.link/${id}`,
    originalUrl: options.originalUrl ?? `https://shop.example.com/products/${id}`,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: options.metadata,
  };
}

// ============================================================================
// Request Fixtures
// ============================================================================

export function createToolCallRequest(overrides: Record<string, unknown> = {}) {
  return {
    tool: 'search_products',
    arguments: { query: 'test' },
    sessionId: generateId('session'),
    llmProvider: 'claude' as const,
    ...overrides,
  };
}

export function createSessionRequest(overrides: Record<string, unknown> = {}) {
  return {
    llmProvider: 'claude' as const,
    anonymous: true,
    ...overrides,
  };
}

// ============================================================================
// Response Fixtures
// ============================================================================

export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

export function createErrorResponse(code: string, message: string) {
  return {
    error: {
      code,
      message,
      statusCode: 400,
    },
  };
}
