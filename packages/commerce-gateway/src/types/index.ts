import type { z } from 'zod';

// ============================================================================
// LLM Provider Types
// ============================================================================

export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'grok';

export interface LLMProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// Tool System Types
// ============================================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  parameters: z.ZodSchema<TInput>;
  handler: (input: TInput, context: ToolContext) => Promise<TOutput>;
  requiresAuth?: boolean;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface ToolContext {
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  cartId?: string;
  locale?: string;
  channel?: string;
  /** Unique request identifier for tracing - optional for stateless use */
  requestId?: string;
  userAgent?: string;
  ip?: string;
  /** Commerce backends - required for tool handlers that interact with products/cart/orders */
  backends?: import('../backends/interfaces').GatewayBackends;
}

/**
 * Structured error for tool execution failures.
 */
export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  /** Error can be a simple string or structured error object */
  error?: string | ToolError;
  metadata?: {
    executionTimeMs: number;
    cached: boolean;
    version: string;
  };
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GatewayRequest {
  provider: LLMProvider;
  tool: string;
  input: unknown;
  context?: Partial<ToolContext>;
}

export interface GatewayResponse<T = unknown> {
  requestId: string;
  tool: string;
  result: ToolResult<T>;
  timestamp: string;
}

// ============================================================================
// Session & Cart Types
// ============================================================================

export interface ConversationSession {
  id: string;
  userId?: string;
  organizationId?: string;
  cartId?: string;
  provider: LLMProvider;
  messages: ConversationMessage[];
  context: SessionContext;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: unknown;
  timestamp: Date;
}

export interface SessionContext {
  preferences: {
    hairType?: string;
    concerns?: string[];
    budget?: string;
  };
  recentProducts: string[];
  lastIntent?: string;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, unknown>;
}

export interface Cart {
  id: string;
  sessionId: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  reservedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Product Types (for tool responses)
// ============================================================================

export interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: {
    amount: number;
    currency: string;
    compareAtPrice?: number;
  };
  images: {
    url: string;
    alt?: string;
  }[];
  category?: string;
  tags?: string[];
  rating?: {
    average: number;
    count: number;
  };
  availability: {
    inStock: boolean;
    quantity?: number;
    leadTime?: string;
  };
  relevanceScore?: number;
}

export interface ProductDetails extends ProductSearchResult {
  sku: string;
  variants?: ProductVariant[];
  attributes: Record<string, string | string[]>;
  ingredients?: string[];
  usage?: string;
  benefits?: string[];
  relatedProducts?: string[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: {
    amount: number;
    currency: string;
  };
  attributes: Record<string, string>;
  availability: {
    inStock: boolean;
    quantity?: number;
  };
}

export interface InventoryInfo {
  productId: string;
  variantId?: string;
  locationId?: string;
  locationName?: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityOnHand: number;
  reorderPoint?: number;
  leadTimeDays?: number;
}

// ============================================================================
// Recommendation Types
// ============================================================================

export interface RecommendationRequest {
  userId?: string;
  productIds?: string[];
  context?: {
    hairType?: string;
    concerns?: string[];
    budget?: 'low' | 'medium' | 'high';
    occasion?: string;
  };
  limit?: number;
  strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
}

export interface Recommendation {
  product: ProductSearchResult;
  reason: string;
  confidence: number;
  strategy: string;
}

// ============================================================================
// Order Types
// ============================================================================

export interface CreateOrderInput {
  cartId: string;
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  notes?: string;
  giftMessage?: string;
  isGift?: boolean;
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
}

export interface OrderConfirmation {
  orderId: string;
  orderNumber: string;
  status: string;
  total: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  estimatedDelivery?: string;
  trackingUrl?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ToolUsageEvent {
  toolName: string;
  provider: LLMProvider;
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  requestId: string;
  success: boolean;
  executionTimeMs: number;
  errorCode?: string;
  timestamp: Date;
}

export interface ConversionEvent {
  sessionId: string;
  provider: LLMProvider;
  orderId?: string;
  cartValue?: number;
  productsViewed: number;
  toolsUsed: string[];
  conversionPath: string[];
  timestamp: Date;
}

