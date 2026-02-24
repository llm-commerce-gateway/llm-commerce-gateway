/**
 * @betterdata/commerce-gateway - Error Handling System
 * 
 * Comprehensive error hierarchy with typed error codes,
 * HTTP status mapping, and structured error responses.
 * 
 * @license MIT
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Enumeration of all possible error codes
 */
export enum ErrorCode {
  // -------------------------------------------------------------------------
  // Client Errors (4xx)
  // -------------------------------------------------------------------------
  
  /** Invalid input data provided */
  INVALID_INPUT = 'INVALID_INPUT',
  
  /** Required field is missing */
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  /** Authentication failed or missing credentials */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  
  /** Valid credentials but insufficient permissions */
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  
  /** API key is invalid or expired */
  INVALID_API_KEY = 'INVALID_API_KEY',
  
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  /** Requested tool not found */
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  
  /** Session not found */
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  
  /** Session has expired */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  /** Product not found */
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  
  /** Cart not found */
  CART_NOT_FOUND = 'CART_NOT_FOUND',
  
  /** Order not found */
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  
  /** Insufficient inventory for requested quantity */
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  
  /** Invalid session transfer token */
  INVALID_TRANSFER_TOKEN = 'INVALID_TRANSFER_TOKEN',
  
  // -------------------------------------------------------------------------
  // Server Errors (5xx)
  // -------------------------------------------------------------------------
  
  /** Generic backend error */
  BACKEND_ERROR = 'BACKEND_ERROR',
  
  /** Tool execution failed */
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  
  /** Database operation failed */
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  /** External service (Redis, LLM API, etc.) failed */
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  /** Link generation failed */
  LINK_GENERATION_ERROR = 'LINK_GENERATION_ERROR',
  
  /** Session operation failed */
  SESSION_ERROR = 'SESSION_ERROR',
  
  /** Configuration error */
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  /** Unexpected internal error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * HTTP status code mapping for error codes
 */
const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // 4xx Client Errors
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.AUTHENTICATION_FAILED]: 401,
  [ErrorCode.AUTHORIZATION_FAILED]: 403,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.TOOL_NOT_FOUND]: 404,
  [ErrorCode.SESSION_NOT_FOUND]: 404,
  [ErrorCode.SESSION_EXPIRED]: 410,
  [ErrorCode.PRODUCT_NOT_FOUND]: 404,
  [ErrorCode.CART_NOT_FOUND]: 404,
  [ErrorCode.ORDER_NOT_FOUND]: 404,
  [ErrorCode.INSUFFICIENT_INVENTORY]: 409,
  [ErrorCode.INVALID_TRANSFER_TOKEN]: 400,
  
  // 5xx Server Errors
  [ErrorCode.BACKEND_ERROR]: 500,
  [ErrorCode.TOOL_EXECUTION_FAILED]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.LINK_GENERATION_ERROR]: 500,
  [ErrorCode.SESSION_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Structured error response format
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

// ============================================================================
// Base Gateway Error
// ============================================================================

/**
 * Base error class for all gateway errors
 * 
 * @example
 * throw new GatewayError(
 *   ErrorCode.INVALID_INPUT,
 *   'Invalid product ID format',
 *   { field: 'productId', value: input.productId }
 * );
 */
export class GatewayError extends Error {
  /**
   * HTTP status code for this error
   */
  public readonly statusCode: number;

  /**
   * Unique request ID for tracking
   */
  public requestId?: string;

  constructor(
    /**
     * Error code from ErrorCode enum
     */
    public readonly code: ErrorCode,
    /**
     * Human-readable error message
     */
    message: string,
    /**
     * Additional error details
     */
    public readonly details?: Record<string, unknown>,
    /**
     * Original error that caused this error
     */
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = ERROR_STATUS_CODES[code] ?? 500;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        requestId: this.requestId,
      },
    };
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * Check if error should be retried
   */
  isRetryable(): boolean {
    return [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      ErrorCode.DATABASE_ERROR,
    ].includes(this.code);
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Validation error for invalid input data
 * 
 * @example
 * throw new ValidationError('Invalid email format', {
 *   field: 'email',
 *   value: input.email,
 *   expected: 'valid email address',
 * });
 */
export class ValidationError extends GatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_INPUT, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error for failed auth attempts
 * 
 * @example
 * throw new AuthenticationError('Invalid API key');
 */
export class AuthenticationError extends GatewayError {
  constructor(message: string = 'Authentication failed') {
    super(ErrorCode.AUTHENTICATION_FAILED, message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error for insufficient permissions
 */
export class AuthorizationError extends GatewayError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.AUTHORIZATION_FAILED, message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Rate limit error with retry information
 * 
 * @example
 * throw new RateLimitError('Too many requests', 60);
 */
export class RateLimitError extends GatewayError {
  constructor(
    message: string = 'Rate limit exceeded',
    /**
     * Seconds until rate limit resets
     */
    public readonly retryAfter?: number
  ) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends GatewayError {
  constructor(toolName: string) {
    super(ErrorCode.TOOL_NOT_FOUND, `Tool '${toolName}' not found`, { toolName });
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends GatewayError {
  constructor(toolName: string, message: string, originalError?: Error) {
    super(
      ErrorCode.TOOL_EXECUTION_FAILED,
      `Tool '${toolName}' failed: ${message}`,
      { toolName },
      originalError
    );
    this.name = 'ToolExecutionError';
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends GatewayError {
  constructor(sessionId: string) {
    super(ErrorCode.SESSION_NOT_FOUND, `Session '${sessionId}' not found`, { sessionId });
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends GatewayError {
  constructor(sessionId: string) {
    super(ErrorCode.SESSION_EXPIRED, `Session '${sessionId}' has expired`, { sessionId });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Product not found error
 */
export class ProductNotFoundError extends GatewayError {
  constructor(productId: string) {
    super(ErrorCode.PRODUCT_NOT_FOUND, `Product '${productId}' not found`, { productId });
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Cart not found error
 */
export class CartNotFoundError extends GatewayError {
  constructor(cartId: string) {
    super(ErrorCode.CART_NOT_FOUND, `Cart '${cartId}' not found`, { cartId });
    this.name = 'CartNotFoundError';
  }
}

/**
 * Order not found error
 */
export class OrderNotFoundError extends GatewayError {
  constructor(orderId: string) {
    super(ErrorCode.ORDER_NOT_FOUND, `Order '${orderId}' not found`, { orderId });
    this.name = 'OrderNotFoundError';
  }
}

/**
 * Insufficient inventory error
 */
export class InsufficientInventoryError extends GatewayError {
  constructor(
    productId: string,
    requested: number,
    available: number
  ) {
    super(
      ErrorCode.INSUFFICIENT_INVENTORY,
      `Insufficient inventory for product '${productId}': requested ${requested}, available ${available}`,
      { productId, requested, available }
    );
    this.name = 'InsufficientInventoryError';
  }
}

/**
 * Backend error for backend implementation failures
 */
export class BackendError extends GatewayError {
  constructor(message: string, originalError?: Error) {
    super(ErrorCode.BACKEND_ERROR, message, undefined, originalError);
    this.name = 'BackendError';
  }
}

/**
 * Database error
 */
export class DatabaseError extends GatewayError {
  constructor(message: string, originalError?: Error) {
    super(ErrorCode.DATABASE_ERROR, message, undefined, originalError);
    this.name = 'DatabaseError';
  }
}

/**
 * External service error (Redis, LLM APIs, etc.)
 */
export class ExternalServiceError extends GatewayError {
  constructor(
    service: string,
    message: string,
    originalError?: Error
  ) {
    super(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `${service} error: ${message}`,
      { service },
      originalError
    );
    this.name = 'ExternalServiceError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends GatewayError {
  constructor(message: string) {
    super(ErrorCode.CONFIGURATION_ERROR, message);
    this.name = 'ConfigurationError';
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if a value is a GatewayError
 */
export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError;
}

/**
 * Wrap an unknown error in a GatewayError
 */
export function wrapError(error: unknown, context?: string): GatewayError {
  if (error instanceof GatewayError) {
    return error;
  }

  const message = error instanceof Error 
    ? error.message 
    : String(error);

  const fullMessage = context ? `${context}: ${message}` : message;

  return new GatewayError(
    ErrorCode.INTERNAL_ERROR,
    fullMessage,
    undefined,
    error instanceof Error ? error : undefined
  );
}

/**
 * Create a safe error message (no sensitive data)
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof GatewayError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    if (process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

