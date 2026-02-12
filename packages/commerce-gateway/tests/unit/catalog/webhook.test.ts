/**
 * Webhook Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookHandler, createWebhookHandler } from '../../../src/catalog/sync/webhook-handler';
import { verifyShopifyWebhook, verifySquareWebhook } from '../../../src/catalog/sync/webhook-middleware';
import * as crypto from 'crypto';

// Mock Prisma
const mockPrisma = {
  vendorPlatformAccount: {
    findFirst: vi.fn(),
  },
  productListing: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  productMaster: {
    findUnique: vi.fn(),
  },
  vendorProfile: {
    findUnique: vi.fn(),
  },
  marketplaceSearchIndex: {
    upsert: vi.fn(),
  },
};

describe('WebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleShopify', () => {
    it('should update listing on product.update', async () => {
      mockPrisma.vendorPlatformAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        vendorOrgId: 'org-1',
        platform: 'shopify',
        domain: 'test.myshopify.com',
        isActive: true,
      });

      // findMany for getting listings by platformProductId
      mockPrisma.productListing.findMany.mockResolvedValue([{
        id: 'listing-1',
        vendorOrgId: 'org-1',
        vendorPlatformAccountId: 'account-1',
        platformProductId: '123',
        platformVariantId: '456',
        vendorSku: 'SKU-123',
        productMasterId: 'pm-1',
        metadata: {},
      }]);

      mockPrisma.productListing.findUnique.mockResolvedValue({
        id: 'listing-1',
        productMaster: { brandName: 'Test', productName: 'Product' },
        vendorOrg: { name: 'Vendor' },
        vendorPlatformAccount: { platform: 'shopify', domain: 'test.myshopify.com' },
      });

      mockPrisma.productListing.update.mockResolvedValue({ id: 'listing-1' });
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});

      const handler = createWebhookHandler(mockPrisma as any);

      const result = await handler.handleShopify('product.update', {
        id: 123,
        title: 'Updated Product',
        body_html: '<p>Description</p>',
        variants: [{
          id: 456,
          sku: 'SKU-123',
          price: '99.99',
          compare_at_price: '129.99',
          inventory_quantity: 10,
        }],
      }, 'test.myshopify.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(mockPrisma.productListing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: expect.objectContaining({
          internalName: 'Updated Product',
          price: 99.99,
          inStock: true,
        }),
      });
    });

    it('should deactivate listing on product.delete', async () => {
      mockPrisma.vendorPlatformAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        vendorOrgId: 'org-1',
        platform: 'shopify',
        domain: 'test.myshopify.com',
        isActive: true,
      });

      mockPrisma.productListing.updateMany.mockResolvedValue({ count: 1 });

      const handler = createWebhookHandler(mockPrisma as any);

      const result = await handler.handleShopify('product.delete', {
        id: 123,
      }, 'test.myshopify.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('deactivated');
      expect(mockPrisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { vendorPlatformAccountId: 'account-1', platformProductId: '123' },
        data: { active: false, inStock: false },
      });
    });

    it('should update inventory on inventory.update', async () => {
      mockPrisma.vendorPlatformAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        vendorOrgId: 'org-1',
        platform: 'shopify',
        domain: 'test.myshopify.com',
        isActive: true,
      });

      // findFirst for getting listing by platformVariantId
      mockPrisma.productListing.findFirst.mockResolvedValue({
        id: 'listing-1',
        vendorPlatformAccountId: 'account-1',
        platformVariantId: '456',
        productMasterId: 'pm-1',
        metadata: {},
      });

      mockPrisma.productListing.findUnique.mockResolvedValue({
        id: 'listing-1',
        productMaster: { brandName: 'Test', productName: 'Product' },
        vendorOrg: { name: 'Vendor' },
        vendorPlatformAccount: { platform: 'shopify', domain: 'test.myshopify.com' },
      });

      mockPrisma.productListing.update.mockResolvedValue({ id: 'listing-1' });
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});

      const handler = createWebhookHandler(mockPrisma as any);

      const result = await handler.handleShopify('inventory.update', {
        variant_id: 456,
        available: 5,
      }, 'test.myshopify.com');

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
    });

    it('should return ignored if platform account not found', async () => {
      mockPrisma.vendorPlatformAccount.findFirst.mockResolvedValue(null);

      const handler = createWebhookHandler(mockPrisma as any);

      const result = await handler.handleShopify('product.update', {}, 'unknown.myshopify.com');

      expect(result.success).toBe(false);
      expect(result.action).toBe('ignored');
      expect(result.error).toBe('Platform account not found');
    });
  });
});

describe('Webhook Verification', () => {
  describe('verifyShopifyWebhook', () => {
    it('should verify valid HMAC signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');

      const result = verifyShopifyWebhook(body, hmac, secret);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      // Create a valid-length but wrong HMAC
      const wrongHmac = crypto
        .createHmac('sha256', 'wrong-secret')
        .update(body, 'utf8')
        .digest('base64');

      const result = verifyShopifyWebhook(body, wrongHmac, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject missing HMAC header', () => {
      const body = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';

      const result = verifyShopifyWebhook(body, undefined, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing HMAC header');
    });
  });

  describe('verifySquareWebhook', () => {
    it('should verify valid Square signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const signatureKey = 'test-key';
      const notificationUrl = 'https://example.com/webhook';
      
      const payload = notificationUrl + body;
      const signature = crypto
        .createHmac('sha256', signatureKey)
        .update(payload, 'utf8')
        .digest('base64');

      const result = verifySquareWebhook(body, signature, signatureKey, notificationUrl);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const notificationUrl = 'https://example.com/webhook';
      // Create valid-length but wrong signature
      const wrongSignature = crypto
        .createHmac('sha256', 'wrong-key')
        .update(notificationUrl + body, 'utf8')
        .digest('base64');
      
      const result = verifySquareWebhook(body, wrongSignature, 'correct-key', notificationUrl);

      expect(result.valid).toBe(false);
    });
  });
});

