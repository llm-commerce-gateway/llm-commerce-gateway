/**
 * @betterdata/llm-gateway - Input Validation
 * 
 * Zod schemas for request validation with type-safe parsing
 * and detailed error messages.
 * 
 * @license MIT
 */

import { z } from 'zod';
import { ValidationError } from './errors';

// ============================================================================
// LLM Provider Schema
// ============================================================================

/**
 * Supported LLM providers
 */
export const LLMProviderSchema = z.enum(['claude', 'openai', 'grok', 'custom']);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

// ============================================================================
// Tool Request Schemas
// ============================================================================

/**
 * Tool execution request
 */
export const ToolCallRequestSchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  arguments: z.record(z.unknown()).default({}),
  sessionId: z.string().optional(),
  llmProvider: LLMProviderSchema.optional(),
  context: z.record(z.unknown()).optional(),
});
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

/**
 * Tool arguments for search_products
 */
export const SearchProductsArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  inStock: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});
export type SearchProductsArgs = z.infer<typeof SearchProductsArgsSchema>;

/**
 * Tool arguments for get_product_details
 */
export const GetProductDetailsArgsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});
export type GetProductDetailsArgs = z.infer<typeof GetProductDetailsArgsSchema>;

/**
 * Tool arguments for add_to_cart
 */
export const AddToCartArgsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  reserveInventory: z.boolean().default(false),
  reserveDurationMinutes: z.number().int().min(1).max(60).default(15),
});
export type AddToCartArgs = z.infer<typeof AddToCartArgsSchema>;

/**
 * Tool arguments for check_inventory
 */
export const CheckInventoryArgsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  locationId: z.string().optional(),
});
export type CheckInventoryArgs = z.infer<typeof CheckInventoryArgsSchema>;

/**
 * Tool arguments for get_recommendations
 */
export const GetRecommendationsArgsSchema = z.object({
  productId: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  strategy: z.enum(['similar', 'complementary', 'trending', 'personalized', 'bundle']).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});
export type GetRecommendationsArgs = z.infer<typeof GetRecommendationsArgsSchema>;

/**
 * Tool arguments for create_order
 */
export const CreateOrderArgsSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  shippingAddressId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateOrderArgs = z.infer<typeof CreateOrderArgsSchema>;

// ============================================================================
// Session Schemas
// ============================================================================

/**
 * Session creation request
 */
export const SessionCreateRequestSchema = z.object({
  llmProvider: LLMProviderSchema,
  userId: z.string().optional(),
  anonymous: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  ttl: z.number().int().min(60).optional(), // Minimum 1 minute
});
export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>;

/**
 * Session update request
 */
export const SessionUpdateRequestSchema = z.object({
  preferences: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SessionUpdateRequest = z.infer<typeof SessionUpdateRequestSchema>;

/**
 * Session transfer request
 */
export const SessionTransferRequestSchema = z.object({
  token: z.string().min(1, 'Transfer token is required'),
  targetProvider: LLMProviderSchema,
});
export type SessionTransferRequest = z.infer<typeof SessionTransferRequestSchema>;

// ============================================================================
// Cart Schemas
// ============================================================================

/**
 * Cart item schema
 */
export const CartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  price: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CartItemInput = z.infer<typeof CartItemSchema>;

/**
 * Add to cart request
 */
export const AddToCartRequestSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  item: CartItemSchema,
});
export type AddToCartRequest = z.infer<typeof AddToCartRequestSchema>;

/**
 * Update cart item request
 */
export const UpdateCartItemRequestSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().min(0), // 0 to remove
});
export type UpdateCartItemRequest = z.infer<typeof UpdateCartItemRequestSchema>;

// ============================================================================
// Link Schemas
// ============================================================================

/**
 * Link context schema
 */
export const LinkContextSchema = z.object({
  sessionId: z.string(),
  llmProvider: z.string(),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type LinkContextInput = z.infer<typeof LinkContextSchema>;

/**
 * Create product link request
 */
export const CreateProductLinkRequestSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  context: LinkContextSchema,
  expiryHours: z.number().int().min(1).max(720).optional(), // Max 30 days
  qrCode: z.boolean().optional(),
});
export type CreateProductLinkRequest = z.infer<typeof CreateProductLinkRequestSchema>;

/**
 * Create cart link request
 */
export const CreateCartLinkRequestSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  expiryHours: z.number().int().min(1).max(48).optional(), // Max 48 hours
  qrCode: z.boolean().optional(),
});
export type CreateCartLinkRequest = z.infer<typeof CreateCartLinkRequestSchema>;

// ============================================================================
// API Configuration Schemas
// ============================================================================

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  url: z.string().url().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  password: z.string().optional(),
  db: z.number().int().min(0).max(15).optional(),
  tls: z.boolean().optional(),
});
export type RedisConfig = z.infer<typeof RedisConfigSchema>;

/**
 * Rate limit configuration schema
 */
export const RateLimitConfigSchema = z.object({
  requests: z.number().int().min(1),
  window: z.number().int().min(1), // seconds
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/**
 * Auth configuration schema
 */
export const AuthConfigSchema = z.object({
  apiKeys: z.array(z.string()).optional(),
  oauth: z.object({
    google: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
    }).optional(),
    github: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
    }).optional(),
  }).optional(),
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ValidationError };

/**
 * Validate input against a Zod schema
 * 
 * @throws ValidationError if validation fails
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      
      throw new ValidationError('Invalid request data', { issues });
    }
    throw error;
  }
}

/**
 * Safe validation that returns a result object instead of throwing
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      
      return {
        success: false,
        error: new ValidationError('Invalid request data', { issues }),
      };
    }
    
    return {
      success: false,
      error: new ValidationError(error instanceof Error ? error.message : 'Validation failed'),
    };
  }
}

/**
 * Create a type-safe validator function
 * 
 * @example
 * const validateSession = createValidator(SessionCreateRequestSchema);
 * const session = validateSession(req.body);
 */
export function createValidator<T>(schema: z.ZodSchema<T>): (data: unknown) => T {
  return (data: unknown) => validateRequest(schema, data);
}

/**
 * Validate and transform request body
 * 
 * @example
 * app.post('/sessions', async (c) => {
 *   const body = await parseBody(c, SessionCreateRequestSchema);
 *   // body is typed as SessionCreateRequest
 * });
 */
export async function parseBody<T>(
  context: { req: { json: () => Promise<unknown> } },
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await context.req.json();
  return validateRequest(schema, body);
}

/**
 * Validate query parameters
 * 
 * Note: This function works best with flat object schemas.
 * For complex nested schemas, parse the body instead.
 */
export function parseQuery<T extends z.ZodObject<z.ZodRawShape>>(
  context: { req: { query: (key: string) => string | undefined } },
  schema: T
): z.infer<T> {
  // Get shape from the ZodObject schema
  const shape = schema.shape;
  const queryObj: Record<string, unknown> = {};
  
  for (const key of Object.keys(shape)) {
    const value = context.req.query(key);
    if (value !== undefined) {
      // Try to parse as number if schema expects it
      const fieldSchema = shape[key];
      if (fieldSchema instanceof z.ZodNumber) {
        queryObj[key] = Number(value);
      } else if (fieldSchema instanceof z.ZodBoolean) {
        queryObj[key] = value === 'true';
      } else {
        queryObj[key] = value;
      }
    }
  }
  
  return validateRequest(schema, queryObj);
}

