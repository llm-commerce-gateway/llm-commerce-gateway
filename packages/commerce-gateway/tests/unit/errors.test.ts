/**
 * @betterdata/commerce-gateway - Error System Tests
 * 
 * Unit tests for the error handling system.
 * 
 * @license MIT
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  GatewayError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ToolNotFoundError,
  ToolExecutionError,
  SessionNotFoundError,
  SessionExpiredError,
  ProductNotFoundError,
  CartNotFoundError,
  OrderNotFoundError,
  InsufficientInventoryError,
  BackendError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  isGatewayError,
  wrapError,
  safeErrorMessage,
} from '../../src/core/errors';

describe('GatewayError', () => {
  it('should create error with code and message', () => {
    const error = new GatewayError(ErrorCode.INVALID_INPUT, 'Invalid data');
    
    expect(error.code).toBe(ErrorCode.INVALID_INPUT);
    expect(error.message).toBe('Invalid data');
    expect(error.name).toBe('GatewayError');
  });

  it('should set correct status code for client errors', () => {
    const error = new GatewayError(ErrorCode.INVALID_INPUT, 'Invalid data');
    
    expect(error.statusCode).toBe(400);
    expect(error.isClientError()).toBe(true);
    expect(error.isServerError()).toBe(false);
  });

  it('should set correct status code for server errors', () => {
    const error = new GatewayError(ErrorCode.INTERNAL_ERROR, 'Server error');
    
    expect(error.statusCode).toBe(500);
    expect(error.isClientError()).toBe(false);
    expect(error.isServerError()).toBe(true);
  });

  it('should include details when provided', () => {
    const error = new GatewayError(
      ErrorCode.INVALID_INPUT,
      'Invalid data',
      { field: 'email', value: 'not-an-email' }
    );
    
    expect(error.details).toEqual({ field: 'email', value: 'not-an-email' });
  });

  it('should include original error when provided', () => {
    const original = new Error('Original error');
    const error = new GatewayError(
      ErrorCode.BACKEND_ERROR,
      'Wrapped error',
      undefined,
      original
    );
    
    expect(error.cause).toBe(original);
  });

  it('should serialize to JSON correctly', () => {
    const error = new GatewayError(
      ErrorCode.INVALID_INPUT,
      'Invalid data',
      { field: 'email' }
    );
    error.requestId = 'req-123';
    
    const json = error.toJSON();
    
    expect(json).toEqual({
      error: {
        code: ErrorCode.INVALID_INPUT,
        message: 'Invalid data',
        statusCode: 400,
        details: { field: 'email' },
        requestId: 'req-123',
      },
    });
  });

  it('should identify retryable errors', () => {
    const rateLimitError = new GatewayError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limited');
    const authError = new GatewayError(ErrorCode.AUTHENTICATION_FAILED, 'Auth failed');
    
    expect(rateLimitError.isRetryable()).toBe(true);
    expect(authError.isRetryable()).toBe(false);
  });
});

describe('ValidationError', () => {
  it('should have correct code and status', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.code).toBe(ErrorCode.INVALID_INPUT);
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
  });

  it('should include validation details', () => {
    const error = new ValidationError('Invalid input', {
      issues: [{ path: 'email', message: 'Invalid email' }],
    });
    
    expect(error.details).toEqual({
      issues: [{ path: 'email', message: 'Invalid email' }],
    });
  });
});

describe('AuthenticationError', () => {
  it('should have correct code and status', () => {
    const error = new AuthenticationError();
    
    expect(error.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication failed');
  });

  it('should accept custom message', () => {
    const error = new AuthenticationError('Invalid API key');
    
    expect(error.message).toBe('Invalid API key');
  });
});

describe('AuthorizationError', () => {
  it('should have correct code and status', () => {
    const error = new AuthorizationError();
    
    expect(error.code).toBe(ErrorCode.AUTHORIZATION_FAILED);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Insufficient permissions');
  });
});

describe('RateLimitError', () => {
  it('should have correct code and status', () => {
    const error = new RateLimitError();
    
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
  });

  it('should include retry-after information', () => {
    const error = new RateLimitError('Too many requests', 60);
    
    expect(error.retryAfter).toBe(60);
    expect(error.details).toEqual({ retryAfter: 60 });
  });
});

describe('ToolNotFoundError', () => {
  it('should include tool name in message and details', () => {
    const error = new ToolNotFoundError('my_tool');
    
    expect(error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Tool 'my_tool' not found");
    expect(error.details).toEqual({ toolName: 'my_tool' });
  });
});

describe('ToolExecutionError', () => {
  it('should include tool name and original error', () => {
    const original = new Error('Handler failed');
    const error = new ToolExecutionError('search_products', 'Handler failed', original);
    
    expect(error.code).toBe(ErrorCode.TOOL_EXECUTION_FAILED);
    expect(error.message).toBe("Tool 'search_products' failed: Handler failed");
    expect(error.details).toEqual({ toolName: 'search_products' });
    expect(error.cause).toBe(original);
  });
});

describe('SessionNotFoundError', () => {
  it('should include session ID', () => {
    const error = new SessionNotFoundError('session-123');
    
    expect(error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Session 'session-123' not found");
    expect(error.details).toEqual({ sessionId: 'session-123' });
  });
});

describe('SessionExpiredError', () => {
  it('should include session ID', () => {
    const error = new SessionExpiredError('session-123');
    
    expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    expect(error.statusCode).toBe(410);
    expect(error.message).toBe("Session 'session-123' has expired");
  });
});

describe('ProductNotFoundError', () => {
  it('should include product ID', () => {
    const error = new ProductNotFoundError('prod-123');
    
    expect(error.code).toBe(ErrorCode.PRODUCT_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ productId: 'prod-123' });
  });
});

describe('CartNotFoundError', () => {
  it('should include cart ID', () => {
    const error = new CartNotFoundError('cart-123');
    
    expect(error.code).toBe(ErrorCode.CART_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ cartId: 'cart-123' });
  });
});

describe('OrderNotFoundError', () => {
  it('should include order ID', () => {
    const error = new OrderNotFoundError('order-123');
    
    expect(error.code).toBe(ErrorCode.ORDER_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ orderId: 'order-123' });
  });
});

describe('InsufficientInventoryError', () => {
  it('should include inventory details', () => {
    const error = new InsufficientInventoryError('prod-123', 10, 5);
    
    expect(error.code).toBe(ErrorCode.INSUFFICIENT_INVENTORY);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(
      "Insufficient inventory for product 'prod-123': requested 10, available 5"
    );
    expect(error.details).toEqual({
      productId: 'prod-123',
      requested: 10,
      available: 5,
    });
  });
});

describe('BackendError', () => {
  it('should wrap original error', () => {
    const original = new Error('DB connection failed');
    const error = new BackendError('Database error', original);
    
    expect(error.code).toBe(ErrorCode.BACKEND_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.cause).toBe(original);
  });
});

describe('DatabaseError', () => {
  it('should wrap database errors', () => {
    const original = new Error('Query failed');
    const error = new DatabaseError('Failed to save', original);
    
    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.statusCode).toBe(500);
  });
});

describe('ExternalServiceError', () => {
  it('should include service name', () => {
    const error = new ExternalServiceError('Redis', 'Connection timeout');
    
    expect(error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    expect(error.statusCode).toBe(502);
    expect(error.message).toBe('Redis error: Connection timeout');
    expect(error.details).toEqual({ service: 'Redis' });
  });
});

describe('ConfigurationError', () => {
  it('should have correct code', () => {
    const error = new ConfigurationError('Missing API key');
    
    expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
    expect(error.statusCode).toBe(500);
  });
});

describe('isGatewayError', () => {
  it('should return true for GatewayError instances', () => {
    expect(isGatewayError(new GatewayError(ErrorCode.INTERNAL_ERROR, 'Error'))).toBe(true);
    expect(isGatewayError(new ValidationError('Error'))).toBe(true);
    expect(isGatewayError(new AuthenticationError())).toBe(true);
  });

  it('should return false for non-GatewayError instances', () => {
    expect(isGatewayError(new Error('Error'))).toBe(false);
    expect(isGatewayError('error')).toBe(false);
    expect(isGatewayError(null)).toBe(false);
    expect(isGatewayError(undefined)).toBe(false);
  });
});

describe('wrapError', () => {
  it('should return GatewayError unchanged', () => {
    const original = new ValidationError('Invalid');
    const wrapped = wrapError(original);
    
    expect(wrapped).toBe(original);
  });

  it('should wrap regular Error', () => {
    const original = new Error('Something went wrong');
    const wrapped = wrapError(original);
    
    expect(wrapped).toBeInstanceOf(GatewayError);
    expect(wrapped.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(wrapped.message).toBe('Something went wrong');
    expect(wrapped.cause).toBe(original);
  });

  it('should wrap string error', () => {
    const wrapped = wrapError('String error');
    
    expect(wrapped).toBeInstanceOf(GatewayError);
    expect(wrapped.message).toBe('String error');
  });

  it('should include context when provided', () => {
    const wrapped = wrapError(new Error('Failed'), 'Database operation');
    
    expect(wrapped.message).toBe('Database operation: Failed');
  });
});

describe('safeErrorMessage', () => {
  it('should return message for GatewayError', () => {
    const error = new ValidationError('Invalid email format');
    
    expect(safeErrorMessage(error)).toBe('Invalid email format');
  });

  it('should return message for Error in non-production', () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    env.NODE_ENV = 'development';
    
    const error = new Error('Detailed error info');
    expect(safeErrorMessage(error)).toBe('Detailed error info');
    
    if (originalEnv === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = originalEnv;
    }
  });

  it('should return generic message in production', () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    
    const error = new Error('Sensitive error info');
    expect(safeErrorMessage(error)).toBe('An unexpected error occurred');
    
    if (originalEnv === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = originalEnv;
    }
  });

  it('should handle non-error values', () => {
    expect(safeErrorMessage('string error')).toBe('An unexpected error occurred');
    expect(safeErrorMessage(null)).toBe('An unexpected error occurred');
    expect(safeErrorMessage(undefined)).toBe('An unexpected error occurred');
  });
});

