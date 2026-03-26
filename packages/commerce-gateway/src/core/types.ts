/**
 * @betterdata/commerce-gateway - Core Types
 * 
 * Universal types for the LLM Gateway that work across all LLM providers.
 * 
 * @license Apache-2.0
 */

import type { GatewayBackends, Address } from '../backends/interfaces';

// ============================================================================
// LLM Provider Types
// ============================================================================

export type LLMProvider = 'anthropic' | 'openai' | 'grok' | 'google';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionData {
  id: string;
  cartId?: string;
  userId?: string;
  provider?: LLMProvider;
  preferences?: UserPreferences;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface UserPreferences {
  hairType?: string;
  skinType?: string;
  concerns?: string[];
  budget?: 'low' | 'medium' | 'high' | 'luxury';
  style?: string[];
  [key: string]: unknown;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: unknown;
  timestamp: Date;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolContext {
  /** Session ID - optional for stateless tool execution */
  sessionId?: string;
  session?: SessionData;
  cartId?: string;
  userId?: string;
  organizationId?: string;
  /** Commerce backends - optional for MCP and stateless use */
  backends?: GatewayBackends;
  metadata?: Record<string, unknown>;
  /** Unique request identifier for tracing */
  requestId?: string;
  /** Channel the request came from (e.g., 'mcp', 'api', 'web') */
  channel?: string;
  /** User agent string */
  userAgent?: string;
}

/**
 * Structured error for tool execution failures.
 * Used when tools need to return detailed error information.
 */
export interface ToolError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: unknown;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  /** Error can be a simple string or structured error object */
  error?: string | ToolError;
  metadata?: Record<string, unknown>;
}

export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolContext
) => Promise<ToolResult<TOutput>>;

export interface ToolOptions {
  /** Whether authentication is required */
  requiresAuth?: boolean;
  /** Rate limit configuration */
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
  /** Custom validation function */
  validate?: (input: unknown) => boolean | string;
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

export interface SearchProductsInput {
  query: string;
  filters?: {
    category?: string;
    tags?: string[];
    priceRange?: { min?: number; max?: number };
    inStock?: boolean;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popularity' | 'rating';
}

export interface SearchProductsOutput {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    price: { amount: number; currency: string; compareAtPrice?: number };
    images: Array<{ url: string; alt?: string }>;
    category?: string;
    tags: string[];
    rating?: { average: number; count: number };
    availability: { inStock: boolean; quantity?: number; leadTime?: string };
    relevanceScore?: number;
  }>;
  totalCount: number;
  hasMore: boolean;
  facets?: {
    categories: Array<{ name: string; count: number }>;
  };
}

export interface GetProductDetailsInput {
  productId: string;
  includeVariants?: boolean;
  includeRelated?: boolean;
  includeInventory?: boolean;
}

export interface GetProductDetailsOutput {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  description: string;
  shortDescription?: string;
  price: { amount: number; currency: string; compareAtPrice?: number };
  images: Array<{ url: string; alt?: string }>;
  category?: string;
  tags: string[];
  rating?: { average: number; count: number };
  availability: { inStock: boolean; quantity?: number; leadTime?: string };
  variants?: Array<{
    id: string;
    name: string;
    sku?: string;
    price: { amount: number; currency: string };
    attributes: Record<string, string>;
    availability: { inStock: boolean; quantity?: number };
  }>;
  attributes?: Record<string, string | string[]>;
  ingredients?: string[];
  usage?: string;
  benefits?: string[];
  relatedProducts?: string[];
}

export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity?: number; // Defaults to 1 if not provided
  reserveInventory?: boolean;
  reserveDurationMinutes?: number;
}

export interface AddToCartOutput {
  cartId: string;
  item: {
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  };
  cart: {
    itemCount: number;
    subtotal: number;
    currency: string;
    reservedUntil?: string;
  };
  checkoutUrl?: string;
  message: string;
}

export interface CheckInventoryInput {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity?: number; // Defaults to 1 if not provided
}

export interface CheckInventoryOutput {
  productId: string;
  variantId?: string;
  availability: {
    inStock: boolean;
    quantityAvailable: number;
    canFulfill: boolean;
    message: string;
  };
  locations?: Array<{
    locationId: string;
    locationName: string;
    quantityAvailable: number;
    leadTimeDays?: number;
  }>;
  alternatives?: Array<{
    variantId: string;
    variantName: string;
    quantityAvailable: number;
  }>;
}

export interface CheckAvailabilityInput {
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface CheckAvailabilityOutput {
  productId: string;
  variantId?: string;
  availability: {
    available: boolean;
    message: string;
    confidence: number;
  };
  delivery?: {
    estimate?: string;
    minDays?: number;
    maxDays?: number;
  };
}

export interface GetRecommendationsInput {
  productIds?: string[];
  context?: {
    hairType?: string;
    skinType?: string;
    concerns?: string[];
    budget?: 'low' | 'medium' | 'high' | 'luxury';
  };
  strategy?: 'similar' | 'complementary' | 'trending' | 'bundle' | 'personalized';
  limit?: number;
}

export interface GetRecommendationsOutput {
  recommendations: Array<{
    product: {
      id: string;
      name: string;
      slug: string;
      description: string;
      price: { amount: number; currency: string };
      images: Array<{ url: string; alt?: string }>;
      availability: { inStock: boolean; quantity?: number };
    };
    reason: string;
    confidence: number;
    strategy: string;
  }>;
  totalAvailable: number;
}

export interface CreateOrderInput {
  cartId: string;
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: string;
  notes?: string;
  giftMessage?: string;
  isGift?: boolean;
}

export interface CreateOrderOutput {
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
  confirmationUrl?: string;
}

// ============================================================================
// Gateway Configuration Types
// ============================================================================

export interface RedisConfig {
  url: string;
  token?: string;
  /** Key prefix for namespacing */
  prefix?: string;
  /** TTL for sessions in seconds */
  sessionTTL?: number;
}

export interface PostgresConfig {
  connectionString: string;
  /** Whether to auto-migrate schema */
  autoMigrate?: boolean;
}

export interface SessionConfig {
  /** Redis configuration (required) */
  redis: RedisConfig;
  /** Optional Postgres for persistent storage */
  postgres?: PostgresConfig;
  /** Session TTL in seconds (default: 7 days) */
  ttl?: number;
}

export interface OAuthConfig {
  providers: Array<{
    name: string;
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  }>;
}

export interface AuthConfig {
  /** API keys for authentication */
  apiKeys?: string[];
  /** OAuth configuration */
  oauth?: OAuthConfig;
  /** JWT secret for token signing */
  jwtSecret?: string;
  /** Whether to allow anonymous access */
  allowAnonymous?: boolean;
}

export interface RateLimitConfig {
  /** Requests per window */
  requests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Whether to skip rate limiting for authenticated users */
  skipAuth?: boolean;
  /** Custom key generator */
  keyGenerator?: (req: unknown) => string;
}

export interface TelemetryConfig {
  /** Enable optional anonymous telemetry (default: false) */
  enabled?: boolean;
  /** Telemetry endpoint for hosted deployments */
  endpoint?: string;
  /** Deployment mode for reporting */
  deployment?: 'self-hosted' | 'hosted';
  /** Feature flags included in telemetry payload */
  features?: {
    registry_enabled?: boolean;
    federation_enabled?: boolean;
    streaming_enabled?: boolean;
  };
}

export interface GatewayConfig {
  /** Backend implementations */
  backends: GatewayBackends;
  /** Session configuration */
  session: SessionConfig;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Rate limiting configuration */
  rateLimits?: RateLimitConfig;
  /** LLM providers to enable */
  llmProviders?: LLMProvider[];
  /** Server port (default: 3000) */
  port?: number;
  /** Server host (default: '0.0.0.0') */
  host?: string;
  /** Base path for API routes (default: '/api') */
  basePath?: string;
  /** Enable CORS */
  cors?: boolean | {
    origins: string[];
    methods?: string[];
  };
  /** Custom logger */
  logger?: Logger;
  /** Optional, opt-in telemetry configuration */
  telemetry?: TelemetryConfig;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    duration?: number;
  };
}

export interface ToolCallRequest {
  sessionId?: string;
  toolName: string;
  input: unknown;
  provider?: LLMProvider;
}

export interface ToolCallResponse {
  sessionId: string;
  toolName: string;
  result: ToolResult;
  formattedResponse?: {
    anthropic?: unknown;
    openai?: unknown;
    grok?: unknown;
  };
}

