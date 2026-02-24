/**
 * @betterdata/commerce-gateway - Backend Integration Tests
 * 
 * Integration tests for backend implementations.
 * 
 * @license MIT
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockProductBackend,
  MockCartBackend,
  MockOrderBackend,
  MockLinkGenerator,
  MOCK_PRODUCTS,
} from '../mocks/backends';
import {
  createProduct,
  createCart,
  createCartItem,
  createCartWithItems,
} from '../mocks/fixtures';
import type { Address } from '../../src/backends/interfaces';

// Test address fixture
const testAddress: Address = {
  firstName: 'Test',
  lastName: 'User',
  address1: '123 Test St',
  city: 'Test City',
  state: 'TS',
  postalCode: '12345',
  country: 'US',
};

describe('MockProductBackend', () => {
  let backend: MockProductBackend;

  beforeEach(() => {
    backend = new MockProductBackend();
  });

  describe('searchProducts', () => {
    it('should find products by name', async () => {
      const result = await backend.searchProducts('Bond');

      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products.some((p) => p.name.includes('Bond'))).toBe(true);
    });

    it('should find products by description', async () => {
      const result = await backend.searchProducts('damaged hair');

      expect(result.products.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', async () => {
      const result = await backend.searchProducts('xyz123nonexistent');

      expect(result.products).toEqual([]);
    });

    it('should filter by category', async () => {
      const result = await backend.searchProducts('', { category: 'haircare' });

      expect(result.products.every((p) => p.category === 'haircare')).toBe(true);
    });

    it('should filter by price range', async () => {
      const result = await backend.searchProducts('', {
        priceMin: 50,
        priceMax: 80,
      });

      expect(result.products.every((p) => p.price.amount >= 50 && p.price.amount <= 80)).toBe(true);
    });

    it('should filter by inStock', async () => {
      const result = await backend.searchProducts('', { inStock: true });

      expect(result.products.every((p) => p.availability?.inStock)).toBe(true);
    });

    it('should throw on configured error', async () => {
      const errorBackend = new MockProductBackend({ throwOnSearch: true });

      await expect(errorBackend.searchProducts('test')).rejects.toThrow();
    });

    it('should respect search delay', async () => {
      const slowBackend = new MockProductBackend({ searchDelay: 100 });
      const start = Date.now();

      await slowBackend.searchProducts('test');

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getProductDetails', () => {
    it('should return product by ID', async () => {
      const product = await backend.getProductDetails('prod-001');

      expect(product).not.toBeNull();
      expect(product?.id).toBe('prod-001');
      expect(product?.name).toBe('Bond Repair Oil');
    });

    it('should return null for non-existent product', async () => {
      const product = await backend.getProductDetails('non-existent');

      expect(product).toBeNull();
    });

    it('should throw on configured error', async () => {
      const errorBackend = new MockProductBackend({ throwOnDetails: true });

      await expect(errorBackend.getProductDetails('prod-001')).rejects.toThrow();
    });
  });

  describe('checkInventory', () => {
    it('should return inventory status for products', async () => {
      const results = await backend.checkInventory(['prod-001', 'prod-002']);

      expect(results).toHaveLength(2);
      expect(results[0].productId).toBe('prod-001');
      expect(results[0].inStock).toBe(true);
      expect(results[0].quantity).toBeGreaterThan(0);
    });

    it('should accept locationId option', async () => {
      backend.setInventory('prod-001', 5);

      const results = await backend.checkInventory(['prod-001'], { locationId: 'loc-1' });

      expect(results[0].inStock).toBe(true);
      expect(results[0].quantity).toBe(5);
    });

    it('should return unavailable for non-existent product', async () => {
      const results = await backend.checkInventory(['non-existent']);

      expect(results[0].inStock).toBe(false);
      expect(results[0].quantity).toBe(0);
    });
  });

  describe('getRecommendations', () => {
    it('should return recommendations', async () => {
      const results = await backend.getRecommendations({ productIds: ['prod-001'] });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].product).toBeDefined();
      expect(results[0].confidence).toBeGreaterThan(0);
    });

    it('should respect limit', async () => {
      const results = await backend.getRecommendations(
        { productIds: ['prod-001'], strategy: 'similar' },
        2
      );

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should not include source products', async () => {
      const results = await backend.getRecommendations({ productIds: ['prod-001'] });

      expect(results.every((r) => r.product.id !== 'prod-001')).toBe(true);
    });
  });

  describe('test helpers', () => {
    it('should add product', async () => {
      const newProduct = createProduct({ id: 'prod-new', name: 'New Product' });
      backend.addProduct(newProduct);

      const result = await backend.searchProducts('New Product');
      expect(result.products).toHaveLength(1);
    });

    it('should remove product', async () => {
      backend.removeProduct('prod-001');

      const product = await backend.getProductDetails('prod-001');
      expect(product).toBeNull();
    });

    it('should update product inventory', async () => {
      backend.setInventory('prod-001', 0);

      const results = await backend.checkInventory(['prod-001']);
      expect(results[0].quantity).toBe(0);
      expect(results[0].inStock).toBe(false);
    });
  });
});

describe('MockCartBackend', () => {
  let backend: MockCartBackend;

  beforeEach(() => {
    backend = new MockCartBackend();
  });

  describe('createCart', () => {
    it('should create empty cart', async () => {
      const cart = await backend.createCart('session-123');

      expect(cart.id).toBeDefined();
      expect(cart.sessionId).toBe('session-123');
      expect(cart.items).toEqual([]);
      expect(cart.subtotal).toBe(0);
      expect(cart.itemCount).toBe(0);
    });

    it('should assign unique cart IDs', async () => {
      const cart1 = await backend.createCart('session-1');
      const cart2 = await backend.createCart('session-2');

      expect(cart1.id).not.toBe(cart2.id);
    });

    it('should throw on configured error', async () => {
      const errorBackend = new MockCartBackend({ throwOnCreate: true });

      await expect(errorBackend.createCart('session-123')).rejects.toThrow();
    });
  });

  describe('getCart', () => {
    it('should return cart by ID', async () => {
      const created = await backend.createCart('session-123');
      const retrieved = await backend.getCart(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent cart', async () => {
      const cart = await backend.getCart('non-existent');

      expect(cart).toBeNull();
    });
  });

  describe('getOrCreateCart', () => {
    it('should create cart if none exists', async () => {
      const cart = await backend.getOrCreateCart('session-123');

      expect(cart.id).toBeDefined();
      expect(cart.sessionId).toBe('session-123');
    });

    it('should return existing cart for same session', async () => {
      const cart1 = await backend.getOrCreateCart('session-123');
      const cart2 = await backend.getOrCreateCart('session-123');

      expect(cart1.id).toBe(cart2.id);
    });
  });

  describe('addToCart', () => {
    it('should add item to cart', async () => {
      const cart = await backend.createCart('session-123');
      
      const updated = await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 2,
      });

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].productId).toBe('prod-001');
      expect(updated.items[0].quantity).toBe(2);
    });

    it('should add multiple items', async () => {
      const cart = await backend.createCart('session-123');
      
      await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 1,
      });
      
      const updated = await backend.addToCart(cart.id, {
        productId: 'prod-002',
        quantity: 2,
      });

      expect(updated.items).toHaveLength(2);
      expect(updated.itemCount).toBe(3);
    });

    it('should throw for non-existent cart', async () => {
      await expect(
        backend.addToCart('non-existent', {
          productId: 'prod-001',
          quantity: 1,
        })
      ).rejects.toThrow('Cart not found');
    });
  });

  describe('updateCartItem', () => {
    it('should update item quantity', async () => {
      const cart = await backend.createCart('session-123');
      const withItem = await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 1,
      });
      const itemId = withItem.items[0].id!;

      const updated = await backend.updateCartItem(cart.id, itemId, 3);

      expect(updated.items[0].quantity).toBe(3);
    });

    it('should remove item when quantity is 0', async () => {
      const cart = await backend.createCart('session-123');
      const withItem = await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 1,
      });
      const itemId = withItem.items[0].id!;

      const updated = await backend.updateCartItem(cart.id, itemId, 0);

      expect(updated.items).toHaveLength(0);
    });
  });

  describe('removeFromCart', () => {
    it('should remove item from cart', async () => {
      const cart = await backend.createCart('session-123');
      const withItem = await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 1,
      });
      const itemId = withItem.items[0].id!;

      const updated = await backend.removeFromCart(cart.id, itemId);

      expect(updated.items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('should remove all items from cart', async () => {
      const cart = await backend.createCart('session-123');
      await backend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 1,
      });

      const cleared = await backend.clearCart(cart.id);

      expect(cleared.items).toHaveLength(0);
      expect(cleared.subtotal).toBe(0);
      expect(cleared.itemCount).toBe(0);
    });
  });
});

describe('MockOrderBackend', () => {
  let backend: MockOrderBackend;
  let cartBackend: MockCartBackend;

  beforeEach(() => {
    backend = new MockOrderBackend();
    cartBackend = new MockCartBackend();
  });

  describe('createOrder', () => {
    it('should create order from cart', async () => {
      const cart = await cartBackend.createCart('session-123');
      await cartBackend.addToCart(cart.id, {
        productId: 'prod-001',
        quantity: 2,
      });
      const filledCart = await cartBackend.getCart(cart.id);

      const order = await backend.createOrder(filledCart!, testAddress);

      expect(order.id).toBeDefined();
      expect(order.orderNumber).toMatch(/^ORD-\d+$/);
      expect(order.status).toBe('pending');
      expect(order.items).toHaveLength(1);
      expect(order.currency).toBe('USD');
    });

    it('should include shipping address', async () => {
      const cart = createCartWithItems(1);

      const order = await backend.createOrder(cart, testAddress);

      expect(order.shippingAddress).toEqual(testAddress);
    });

    it('should throw on configured error', async () => {
      const errorBackend = new MockOrderBackend({ throwOnCreate: true });
      const cart = createCartWithItems(1);

      await expect(errorBackend.createOrder(cart, testAddress)).rejects.toThrow();
    });
  });

  describe('getOrder', () => {
    it('should return order by ID', async () => {
      const cart = createCartWithItems(1);
      const created = await backend.createOrder(cart, testAddress);

      const retrieved = await backend.getOrder(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent order', async () => {
      const order = await backend.getOrder('non-existent');

      expect(order).toBeNull();
    });
  });

  describe('getOrderByNumber', () => {
    it('should return order by order number', async () => {
      const cart = createCartWithItems(1);
      const created = await backend.createOrder(cart, testAddress);

      const retrieved = await backend.getOrderByNumber(created.orderNumber);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate order totals', async () => {
      const cart = createCartWithItems(2);

      const totals = await backend.calculateTotals(cart, testAddress);

      expect(totals.subtotal).toBe(cart.subtotal);
      expect(totals.shipping).toBeGreaterThanOrEqual(0);
      expect(totals.tax).toBeGreaterThanOrEqual(0);
      expect(totals.total).toBe(totals.subtotal + totals.shipping + totals.tax);
      expect(totals.currency).toBe(cart.currency);
    });
  });
});

describe('MockLinkGenerator', () => {
  let generator: MockLinkGenerator;

  beforeEach(() => {
    generator = new MockLinkGenerator();
  });

  describe('createProductLink', () => {
    it('should create short link for product', async () => {
      const product = createProduct({ id: 'prod-123' });
      
      const link = await generator.createProductLink(product, {
        sessionId: 'session-123',
        campaign: 'test',
      });

      expect(link.id).toBeDefined();
      expect(link.shortUrl).toContain('prod-123');
      expect(link.originalUrl).toContain('prod-123');
      expect(link.expiresAt).toBeInstanceOf(Date);
      expect(link.metadata?.productId).toBe('prod-123');
    });

    it('should throw on configured error', async () => {
      const errorGenerator = new MockLinkGenerator({ throwOnCreate: true });
      const product = createProduct();

      await expect(
        errorGenerator.createProductLink(product, { sessionId: 's' })
      ).rejects.toThrow();
    });
  });

  describe('createCartLink', () => {
    it('should create short link for cart', async () => {
      const cart = createCartWithItems(2);

      const link = await generator.createCartLink(cart);

      expect(link.shortUrl).toContain(cart.id);
      expect(link.metadata?.cartId).toBe(cart.id);
      expect(link.metadata?.itemCount).toBe(cart.itemCount);
    });

    it('should respect custom expiry', async () => {
      const cart = createCartWithItems(1);
      const now = Date.now();

      const link = await generator.createCartLink(cart, 48);

      const expiryMs = link.expiresAt!.getTime() - now;
      const expiryHours = expiryMs / (60 * 60 * 1000);
      expect(expiryHours).toBeCloseTo(48, 0);
    });
  });

  describe('createLink', () => {
    it('should create generic short link', async () => {
      const link = await generator.createLink('https://example.com/test', {
        source: 'test',
      });

      expect(link.shortUrl).toBeDefined();
      expect(link.originalUrl).toBe('https://example.com/test');
      expect(link.metadata?.source).toBe('test');
    });
  });
});
