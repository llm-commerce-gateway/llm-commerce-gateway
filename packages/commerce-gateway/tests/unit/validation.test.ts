/**
 * @betterdata/commerce-gateway - Validation Tests
 * 
 * Unit tests for the Zod validation schemas and helpers.
 * 
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  ToolCallRequestSchema,
  SearchProductsArgsSchema,
  GetProductDetailsArgsSchema,
  AddToCartArgsSchema,
  CheckInventoryArgsSchema,
  GetRecommendationsArgsSchema,
  CreateOrderArgsSchema,
  SessionCreateRequestSchema,
  SessionUpdateRequestSchema,
  CartItemSchema,
  AddToCartRequestSchema,
  validateRequest,
  safeValidate,
  createValidator,
} from '../../src/core/validation';
import { ValidationError } from '../../src/core/errors';

describe('ToolCallRequestSchema', () => {
  it('should validate valid tool call request', () => {
    const input = {
      tool: 'search_products',
      arguments: { query: 'test' },
      sessionId: 'session-123',
      llmProvider: 'claude',
    };

    const result = ToolCallRequestSchema.parse(input);

    expect(result.tool).toBe('search_products');
    expect(result.arguments).toEqual({ query: 'test' });
    expect(result.sessionId).toBe('session-123');
    expect(result.llmProvider).toBe('claude');
  });

  it('should reject empty tool name', () => {
    const input = {
      tool: '',
      arguments: {},
    };

    expect(() => ToolCallRequestSchema.parse(input)).toThrow();
  });

  it('should default arguments to empty object', () => {
    const input = { tool: 'test_tool' };

    const result = ToolCallRequestSchema.parse(input);

    expect(result.arguments).toEqual({});
  });

  it('should reject invalid llmProvider', () => {
    const input = {
      tool: 'test',
      arguments: {},
      llmProvider: 'invalid',
    };

    expect(() => ToolCallRequestSchema.parse(input)).toThrow();
  });
});

describe('SearchProductsArgsSchema', () => {
  it('should validate valid search args', () => {
    const input = {
      query: 'hair oil',
      category: 'haircare',
      minPrice: 10,
      maxPrice: 100,
      inStock: true,
      limit: 20,
      offset: 0,
    };

    const result = SearchProductsArgsSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should reject empty query', () => {
    const input = { query: '' };

    expect(() => SearchProductsArgsSchema.parse(input)).toThrow();
  });

  it('should reject negative prices', () => {
    const input = {
      query: 'test',
      minPrice: -10,
    };

    expect(() => SearchProductsArgsSchema.parse(input)).toThrow();
  });

  it('should default limit and offset', () => {
    const input = { query: 'test' };

    const result = SearchProductsArgsSchema.parse(input);

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('should reject limit > 100', () => {
    const input = {
      query: 'test',
      limit: 150,
    };

    expect(() => SearchProductsArgsSchema.parse(input)).toThrow();
  });
});

describe('GetProductDetailsArgsSchema', () => {
  it('should validate valid product ID', () => {
    const input = { productId: 'prod-123' };

    const result = GetProductDetailsArgsSchema.parse(input);

    expect(result.productId).toBe('prod-123');
  });

  it('should reject empty product ID', () => {
    const input = { productId: '' };

    expect(() => GetProductDetailsArgsSchema.parse(input)).toThrow();
  });
});

describe('AddToCartArgsSchema', () => {
  it('should validate valid add to cart args', () => {
    const input = {
      productId: 'prod-123',
      quantity: 2,
      variantId: 'var-456',
    };

    const result = AddToCartArgsSchema.parse(input);

    expect(result.productId).toBe('prod-123');
    expect(result.quantity).toBe(2);
    expect(result.variantId).toBe('var-456');
  });

  it('should default quantity to 1', () => {
    const input = { productId: 'prod-123' };

    const result = AddToCartArgsSchema.parse(input);

    expect(result.quantity).toBe(1);
  });

  it('should reject quantity < 1', () => {
    const input = {
      productId: 'prod-123',
      quantity: 0,
    };

    expect(() => AddToCartArgsSchema.parse(input)).toThrow();
  });

  it('should default reserveInventory to false', () => {
    const input = { productId: 'prod-123' };

    const result = AddToCartArgsSchema.parse(input);

    expect(result.reserveInventory).toBe(false);
  });
});

describe('CheckInventoryArgsSchema', () => {
  it('should validate valid inventory check args', () => {
    const input = {
      productId: 'prod-123',
      quantity: 5,
      locationId: 'loc-001',
    };

    const result = CheckInventoryArgsSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should default quantity to 1', () => {
    const input = { productId: 'prod-123' };

    const result = CheckInventoryArgsSchema.parse(input);

    expect(result.quantity).toBe(1);
  });
});

describe('GetRecommendationsArgsSchema', () => {
  it('should validate valid recommendations args', () => {
    const input = {
      productId: 'prod-123',
      strategy: 'similar',
      limit: 10,
    };

    const result = GetRecommendationsArgsSchema.parse(input);

    expect(result.strategy).toBe('similar');
    expect(result.limit).toBe(10);
  });

  it('should accept multiple product IDs', () => {
    const input = {
      productIds: ['prod-1', 'prod-2'],
    };

    const result = GetRecommendationsArgsSchema.parse(input);

    expect(result.productIds).toEqual(['prod-1', 'prod-2']);
  });

  it('should reject invalid strategy', () => {
    const input = {
      productId: 'prod-123',
      strategy: 'invalid',
    };

    expect(() => GetRecommendationsArgsSchema.parse(input)).toThrow();
  });

  it('should default limit to 5', () => {
    const input = {};

    const result = GetRecommendationsArgsSchema.parse(input);

    expect(result.limit).toBe(5);
  });
});

describe('CreateOrderArgsSchema', () => {
  it('should validate valid order args', () => {
    const input = {
      cartId: 'cart-123',
      shippingAddressId: 'addr-456',
      notes: 'Gift wrap please',
    };

    const result = CreateOrderArgsSchema.parse(input);

    expect(result).toEqual(input);
  });

  it('should reject empty cart ID', () => {
    const input = { cartId: '' };

    expect(() => CreateOrderArgsSchema.parse(input)).toThrow();
  });
});

describe('SessionCreateRequestSchema', () => {
  it('should validate valid session request', () => {
    const input = {
      llmProvider: 'claude',
      userId: 'user-123',
      metadata: { source: 'web' },
    };

    const result = SessionCreateRequestSchema.parse(input);

    expect(result.llmProvider).toBe('claude');
    expect(result.userId).toBe('user-123');
  });

  it('should default anonymous to true', () => {
    const input = { llmProvider: 'openai' };

    const result = SessionCreateRequestSchema.parse(input);

    expect(result.anonymous).toBe(true);
  });

  it('should reject invalid provider', () => {
    const input = { llmProvider: 'invalid' };

    expect(() => SessionCreateRequestSchema.parse(input)).toThrow();
  });

  it('should validate minimum TTL', () => {
    const input = {
      llmProvider: 'claude',
      ttl: 30, // Too short
    };

    expect(() => SessionCreateRequestSchema.parse(input)).toThrow();
  });
});

describe('SessionUpdateRequestSchema', () => {
  it('should validate valid update request', () => {
    const input = {
      preferences: { theme: 'dark' },
      metadata: { lastAction: 'search' },
    };

    const result = SessionUpdateRequestSchema.parse(input);

    expect(result.preferences).toEqual({ theme: 'dark' });
  });

  it('should allow empty update', () => {
    const input = {};

    const result = SessionUpdateRequestSchema.parse(input);

    expect(result).toEqual({});
  });
});

describe('CartItemSchema', () => {
  it('should validate valid cart item', () => {
    const input = {
      productId: 'prod-123',
      quantity: 2,
      price: 50.00,
    };

    const result = CartItemSchema.parse(input);

    expect(result.productId).toBe('prod-123');
    expect(result.quantity).toBe(2);
    expect(result.price).toBe(50.00);
  });

  it('should reject non-positive quantity', () => {
    const input = {
      productId: 'prod-123',
      quantity: 0,
    };

    expect(() => CartItemSchema.parse(input)).toThrow();
  });

  it('should reject negative price', () => {
    const input = {
      productId: 'prod-123',
      quantity: 1,
      price: -10,
    };

    expect(() => CartItemSchema.parse(input)).toThrow();
  });
});

describe('AddToCartRequestSchema', () => {
  it('should validate valid add to cart request', () => {
    const input = {
      cartId: 'cart-123',
      item: {
        productId: 'prod-456',
        quantity: 1,
      },
    };

    const result = AddToCartRequestSchema.parse(input);

    expect(result.cartId).toBe('cart-123');
    expect(result.item.productId).toBe('prod-456');
  });

  it('should reject empty cart ID', () => {
    const input = {
      cartId: '',
      item: {
        productId: 'prod-123',
        quantity: 1,
      },
    };

    expect(() => AddToCartRequestSchema.parse(input)).toThrow();
  });
});

describe('validateRequest', () => {
  it('should return parsed data for valid input', () => {
    const schema = ToolCallRequestSchema;
    const input = { tool: 'test', arguments: {} };

    const result = validateRequest(schema, input);

    expect(result.tool).toBe('test');
  });

  it('should throw ValidationError for invalid input', () => {
    const schema = ToolCallRequestSchema;
    const input = { tool: '', arguments: {} };

    expect(() => validateRequest(schema, input)).toThrow(ValidationError);
  });

  it('should include validation issues in error details', () => {
    const schema = ToolCallRequestSchema;
    const input = { tool: '' };

    try {
      validateRequest(schema, input);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details?.issues).toBeDefined();
    }
  });
});

describe('safeValidate', () => {
  it('should return success result for valid input', () => {
    const schema = ToolCallRequestSchema;
    const input = { tool: 'test', arguments: {} };

    const result = safeValidate(schema, input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tool).toBe('test');
    }
  });

  it('should return error result for invalid input', () => {
    const schema = ToolCallRequestSchema;
    const input = { tool: '' };

    const result = safeValidate(schema, input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

describe('createValidator', () => {
  it('should create reusable validator function', () => {
    const validateToolCall = createValidator(ToolCallRequestSchema);

    const result = validateToolCall({ tool: 'test', arguments: {} });

    expect(result.tool).toBe('test');
  });

  it('should throw for invalid input', () => {
    const validateToolCall = createValidator(ToolCallRequestSchema);

    expect(() => validateToolCall({ tool: '' })).toThrow(ValidationError);
  });
});

