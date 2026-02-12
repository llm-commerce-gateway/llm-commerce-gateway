import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: APIError;
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_PARAMETER: 'MISSING_PARAMETER',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',

  // Business logic errors
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  CART_EMPTY: 'CART_EMPTY',
  INVALID_QUANTITY: 'INVALID_QUANTITY',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Tool errors
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Custom Error Classes
// ============================================================================

export class GatewayError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON(): APIError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

export const Errors = {
  unauthorized: (message = 'Authentication required') =>
    new GatewayError(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Access denied') =>
    new GatewayError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (resource: string) =>
    new GatewayError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),

  productNotFound: (id: string) =>
    new GatewayError(ErrorCodes.PRODUCT_NOT_FOUND, `Product not found: ${id}`, 404),

  cartNotFound: (id: string) =>
    new GatewayError(ErrorCodes.CART_NOT_FOUND, `Cart not found: ${id}`, 404),

  validation: (message: string, details?: unknown) =>
    new GatewayError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  insufficientInventory: (available: number, requested: number) =>
    new GatewayError(
      ErrorCodes.INSUFFICIENT_INVENTORY,
      `Insufficient inventory. Available: ${available}, Requested: ${requested}`,
      400
    ),

  rateLimited: (retryAfter: number) =>
    new GatewayError(
      ErrorCodes.RATE_LIMITED,
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      429
    ),

  toolNotFound: (name: string) =>
    new GatewayError(ErrorCodes.TOOL_NOT_FOUND, `Tool not found: ${name}`, 404),

  toolExecution: (name: string, message: string) =>
    new GatewayError(
      ErrorCodes.TOOL_EXECUTION_ERROR,
      `Tool execution failed (${name}): ${message}`,
      500
    ),

  internal: (message = 'An internal error occurred') =>
    new GatewayError(ErrorCodes.INTERNAL_ERROR, message, 500),
};

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Global error handler for the gateway
 */
export function errorHandler(error: Error, c: Context): Response {
  const requestId = c.req.header('X-Request-ID') ?? crypto.randomUUID();

  // Handle our custom errors
  if (error instanceof GatewayError) {
    return c.json<ErrorResponse>(
      {
        error: {
          ...error.toJSON(),
          requestId,
        },
      },
      error.statusCode as 400 | 401 | 403 | 404 | 429 | 500
    );
  }

  // Handle Hono HTTP exceptions
  if (error instanceof HTTPException) {
    return c.json<ErrorResponse>(
      {
        error: {
          code: error.status === 429 ? ErrorCodes.RATE_LIMITED : ErrorCodes.INTERNAL_ERROR,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      error.status
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return c.json<ErrorResponse>(
      {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid input parameters',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      400
    );
  }

  // Log unexpected errors
  console.error('[LLM Gateway] Unexpected error:', {
    requestId,
    error: error.message,
    stack: error.stack,
  });

  // Return generic error for unexpected errors
  return c.json<ErrorResponse>(
    {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    500
  );
}

// ============================================================================
// Not Found Handler
// ============================================================================

/**
 * Handler for 404 routes
 */
export function notFoundHandler(c: Context): Response {
  return c.json<ErrorResponse>(
    {
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        requestId: c.req.header('X-Request-ID') ?? crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    },
    404
  );
}

