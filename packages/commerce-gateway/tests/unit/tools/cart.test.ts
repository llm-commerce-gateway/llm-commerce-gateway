/**
 * Cart Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CartHandler,
  createCartHandler,
  AddToCartSchema,
  addToCartToolDefinition,
  viewCartToolDefinition,
} from '../../../src/tools/cart';

// Mock Prisma
const mockPrisma = {
  productListing: {
    findUnique: vi.fn(),
  },
  cart: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  cartItem: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockContext = {
  sessionId: 'test-session-123',
  userId: 'user-456',
  llmProvider: 'anthropic' as const,
  timestamp: new Date(),
  lastSearchQuery: 'Nike sneakers',
  lastListingRank: 1,
};

describe('AddToCartSchema', () => {
  it('should validate minimal input', () => {
    const result = AddToCartSchema.safeParse({
      listingId: 'listing-123',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.listingId).toBe('listing-123');
      expect(result.data.quantity).toBe(1);
    }
  });

  it('should validate with quantity', () => {
    const result = AddToCartSchema.safeParse({
      listingId: 'listing-123',
      quantity: 3,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
    }
  });

  it('should reject empty listingId', () => {
    const result = AddToCartSchema.safeParse({
      listingId: '',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject zero quantity', () => {
    const result = AddToCartSchema.safeParse({
      listingId: 'listing-123',
      quantity: 0,
    });
    
    expect(result.success).toBe(false);
  });
});

describe('Tool Definitions', () => {
  it('should have correct add_to_cart definition', () => {
    expect(addToCartToolDefinition.name).toBe('add_to_cart');
    expect(addToCartToolDefinition.parameters.required).toContain('listingId');
  });

  it('should have correct view_cart definition', () => {
    expect(viewCartToolDefinition.name).toBe('view_cart');
    expect(Object.keys(viewCartToolDefinition.parameters.properties)).toHaveLength(0);
  });
});

describe('CartHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addToCart', () => {
    it('should add item to empty cart', async () => {
      const mockListing = {
        id: 'listing-123',
        active: true,
        inStock: true,
        availableQuantity: 10,
        price: 135.00,
        authenticated: true,
        vendorSku: 'SKU-123',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-1',
        signalTagId: null,
        vendorRating: 4.5,
        productMaster: {
          productName: 'Air Max 97',
          brandName: 'Nike',
        },
        vendorOrg: {
          name: 'Sneaker Paradise',
        },
      };

      const mockCart = { id: 'cart-123', sessionId: 'test-session-123' };

      mockPrisma.productListing.findUnique.mockResolvedValue(mockListing);
      mockPrisma.cart.findFirst.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue(mockCart);
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);
      mockPrisma.cartItem.create.mockResolvedValue({
        id: 'cart-item-1',
        cartId: 'cart-123',
        listingId: 'listing-123',
        quantity: 1,
      });
      mockPrisma.cartItem.findMany.mockResolvedValue([{
        id: 'cart-item-1',
        cartId: 'cart-123',
        listingId: 'listing-123',
        quantity: 1,
        unitPrice: 135.00,
        totalPrice: 135.00,
        createdAt: new Date(),
        listing: mockListing,
      }]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'listing-123', quantity: 1 },
        mockContext
      );

      expect(result.type).toBe('cart_updated');
      expect(result.content).toContain('Added');
      expect(result.content).toContain('Air Max 97');
      expect(result.content).toContain('Sneaker Paradise');
      expect(result.data?.totalItems).toBe(1);
    });

    it('should update quantity for existing item', async () => {
      const mockListing = {
        id: 'listing-123',
        active: true,
        inStock: true,
        availableQuantity: 10,
        price: 135.00,
        authenticated: false,
        vendorSku: 'SKU-123',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-1',
        signalTagId: null,
        vendorRating: 4.0,
        productMaster: {
          productName: 'Air Max 97',
          brandName: 'Nike',
        },
        vendorOrg: {
          name: 'Sneaker Paradise',
        },
      };

      const mockCart = { id: 'cart-123', sessionId: 'test-session-123' };

      mockPrisma.productListing.findUnique.mockResolvedValue(mockListing);
      mockPrisma.cart.findFirst.mockResolvedValue(mockCart);
      mockPrisma.cartItem.findFirst.mockResolvedValue({
        id: 'cart-item-1',
        cartId: 'cart-123',
        listingId: 'listing-123',
        quantity: 2,
      });
      mockPrisma.cartItem.update.mockResolvedValue({
        id: 'cart-item-1',
        quantity: 3,
      });
      mockPrisma.cartItem.findMany.mockResolvedValue([{
        id: 'cart-item-1',
        cartId: 'cart-123',
        listingId: 'listing-123',
        quantity: 3,
        unitPrice: 135.00,
        totalPrice: 405.00,
        createdAt: new Date(),
        listing: mockListing,
      }]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'listing-123', quantity: 1 },
        mockContext
      );

      expect(result.type).toBe('cart_updated');
      expect(mockPrisma.cartItem.update).toHaveBeenCalled();
    });

    it('should return error for inactive listing', async () => {
      mockPrisma.productListing.findUnique.mockResolvedValue({
        id: 'listing-123',
        active: false,
        productMaster: { productName: 'Test' },
        vendorOrg: { name: 'Vendor' },
      });

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'listing-123', quantity: 1 },
        mockContext
      );

      expect(result.type).toBe('error');
      expect(result.content).toContain('no longer available');
    });

    it('should return error for out of stock', async () => {
      mockPrisma.productListing.findUnique.mockResolvedValue({
        id: 'listing-123',
        active: true,
        inStock: false,
        productMaster: { productName: 'Test Product' },
        vendorOrg: { name: 'Test Vendor' },
      });

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'listing-123', quantity: 1 },
        mockContext
      );

      expect(result.type).toBe('error');
      expect(result.content).toContain('out of stock');
    });

    it('should return error for insufficient quantity', async () => {
      mockPrisma.productListing.findUnique.mockResolvedValue({
        id: 'listing-123',
        active: true,
        inStock: true,
        availableQuantity: 2,
        productMaster: { productName: 'Test' },
        vendorOrg: { name: 'Vendor' },
      });

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'listing-123', quantity: 5 },
        mockContext
      );

      expect(result.type).toBe('error');
      expect(result.content).toContain('only 2 available');
    });

    it('should return error for non-existent listing', async () => {
      mockPrisma.productListing.findUnique.mockResolvedValue(null);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.addToCart(
        { listingId: 'non-existent', quantity: 1 },
        mockContext
      );

      expect(result.type).toBe('error');
      expect(result.content).toContain("wasn't found");
    });
  });

  describe('viewCart', () => {
    it('should return empty cart message', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
      mockPrisma.cartItem.findMany.mockResolvedValue([]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.viewCart({}, mockContext);

      expect(result.type).toBe('cart_empty');
      expect(result.content).toContain('empty');
    });

    it('should return cart with items', async () => {
      const mockListing = {
        id: 'listing-123',
        price: 100.00,
        authenticated: true,
        vendorRating: 4.5,
        vendorOrgId: 'vendor-1',
        signalTagId: null,
        productMaster: {
          productName: 'Test Product',
          brandName: 'Brand',
        },
        vendorOrg: {
          name: 'Test Vendor',
        },
      };

      mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          id: 'cart-item-1',
          cartId: 'cart-123',
          listingId: 'listing-123',
          quantity: 2,
          unitPrice: 100.00,
          totalPrice: 200.00,
          createdAt: new Date(),
          addedVia: { llmProvider: 'anthropic' },
          listing: mockListing,
        },
      ]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.viewCart({}, mockContext);

      expect(result.type).toBe('cart_contents');
      expect(result.content).toContain('Test Product');
      expect(result.content).toContain('Test Vendor');
      expect(result.content).toContain('$200.00');
      expect(result.data?.totalItems).toBe(2);
      expect(result.data?.totalValue).toBe(200);
    });

    it('should group items by vendor', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          id: 'cart-item-1',
          cartId: 'cart-123',
          listingId: 'listing-1',
          quantity: 1,
          unitPrice: 100.00,
          totalPrice: 100.00,
          createdAt: new Date(),
          listing: {
            id: 'listing-1',
            price: 100.00,
            authenticated: true,
            vendorRating: 4.5,
            vendorOrgId: 'vendor-1',
            signalTagId: null,
            productMaster: { productName: 'Product 1', brandName: 'Brand' },
            vendorOrg: { name: 'Vendor A' },
          },
        },
        {
          id: 'cart-item-2',
          cartId: 'cart-123',
          listingId: 'listing-2',
          quantity: 1,
          unitPrice: 50.00,
          totalPrice: 50.00,
          createdAt: new Date(),
          listing: {
            id: 'listing-2',
            price: 50.00,
            authenticated: false,
            vendorRating: 4.0,
            vendorOrgId: 'vendor-2',
            signalTagId: null,
            productMaster: { productName: 'Product 2', brandName: 'Brand' },
            vendorOrg: { name: 'Vendor B' },
          },
        },
      ]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.viewCart({}, mockContext);

      expect(result.type).toBe('cart_contents');
      expect(result.data?.vendorCount).toBe(2);
      expect(result.content).toContain('Vendor A');
      expect(result.content).toContain('Vendor B');
      expect(result.content).toContain('2 different sellers');
    });
  });

  describe('removeFromCart', () => {
    it('should remove item from cart', async () => {
      const mockCartItem = {
        id: 'cart-item-1',
        cartId: 'cart-123',
        listingId: 'listing-123',
        name: 'Test Product',
        quantity: 1,
      };

      mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
      mockPrisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrisma.cartItem.delete.mockResolvedValue(mockCartItem);
      mockPrisma.cartItem.findMany.mockResolvedValue([]);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.removeFromCart(
        { cartItemId: 'cart-item-1' },
        mockContext
      );

      expect(result.type).toBe('cart_updated');
      expect(result.content).toContain('Removed');
      expect(result.content).toContain('Test Product');
    });

    it('should return error for non-existent item', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);

      const handler = createCartHandler(mockPrisma as any);
      const result = await handler.removeFromCart(
        { cartItemId: 'non-existent' },
        mockContext
      );

      expect(result.type).toBe('error');
      expect(result.content).toContain("wasn't found");
    });
  });
});

describe('Cart Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show authenticated badge', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
    mockPrisma.cartItem.findMany.mockResolvedValue([{
      id: 'cart-1',
      cartId: 'cart-123',
      listingId: 'listing-1',
      quantity: 1,
      unitPrice: 100.00,
      totalPrice: 100.00,
      createdAt: new Date(),
      listing: {
        id: 'listing-1',
        price: 100.00,
        authenticated: true,
        vendorRating: 4.5,
        vendorOrgId: 'vendor-1',
        signalTagId: 'sig-123',
        productMaster: { productName: 'Auth Product', brandName: 'Brand' },
        vendorOrg: { name: 'Vendor' },
      },
    }]);

    const handler = createCartHandler(mockPrisma as any);
    const result = await handler.viewCart({}, mockContext);

    expect(result.content).toContain('✓');
  });

  it('should include cart item IDs for removal', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-123' });
    mockPrisma.cartItem.findMany.mockResolvedValue([{
      id: 'specific-cart-item-id',
      cartId: 'cart-123',
      listingId: 'listing-1',
      quantity: 1,
      unitPrice: 100.00,
      totalPrice: 100.00,
      createdAt: new Date(),
      listing: {
        id: 'listing-1',
        price: 100.00,
        authenticated: false,
        vendorRating: null,
        vendorOrgId: 'vendor-1',
        signalTagId: null,
        productMaster: { productName: 'Product', brandName: '' },
        vendorOrg: { name: 'Vendor' },
      },
    }]);

    const handler = createCartHandler(mockPrisma as any);
    const result = await handler.viewCart({}, mockContext);

    expect(result.content).toContain('specific-cart-item-id');
  });
});
