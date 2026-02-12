/**
 * Marketplace Admin Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarketplaceAdminService,
  createMarketplaceAdmin,
} from '../../../src/admin/marketplace-admin';

// Mock Prisma
const createMockPrisma = () => ({
  vendorProfile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  organization: {
    update: vi.fn(),
  },
  productListing: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  productMaster: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  marketplaceSearchIndex: {
    findFirst: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  cartItem: {
    findMany: vi.fn(),
  },
  integration: {
    findMany: vi.fn().mockResolvedValue([]),
  },
});

describe('MarketplaceAdminService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
  });

  describe('Vendor Management', () => {
    it('should list vendors with pagination', async () => {
      mockPrisma.vendorProfile.findMany.mockResolvedValue([
        {
          id: 'vendor-1',
          organizationId: 'org-1',
          displayName: 'Test Vendor',
          marketplaceTier: 'SCM_PRO',
          verifiedSeller: true,
          signalTagCertified: true,
          overallRating: 4.8,
          createdAt: new Date(),
          organization: { status: 'ACTIVE' },
        },
      ]);
      mockPrisma.vendorProfile.count.mockResolvedValue(1);
      mockPrisma.productListing.count.mockResolvedValue(10);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const result = await admin.listVendors({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].displayName).toBe('Test Vendor');
    });

    it('should filter vendors by status', async () => {
      mockPrisma.vendorProfile.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.count.mockResolvedValue(0);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.listVendors({ status: 'ACTIVE' });

      expect(mockPrisma.vendorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization: { status: 'ACTIVE' },
          }),
        })
      );
    });

    it('should get vendor details with listings', async () => {
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
        displayName: 'Test Vendor',
        tagline: 'Test tagline',
        description: 'Test description',
        marketplaceTier: 'SCM_PRO',
        verifiedSeller: true,
        signalTagCertified: true,
        overallRating: 4.8,
        totalOrders: 100,
        totalReviews: 50,
        averageShipTime: 1.5,
        onTimeShipRate: 98,
        returnPolicy: 'Returns accepted',
        shippingPolicy: 'Fast shipping',
        createdAt: new Date(),
        organization: { status: 'ACTIVE' },
      });
      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.productListing.count.mockResolvedValue(0);
      (mockPrisma as any).integration = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const result = await admin.getVendorDetails('vendor-1');

      expect(result).not.toBeNull();
      expect(result?.displayName).toBe('Test Vendor');
      expect(result?.tier).toBe('SCM_PRO');
    });

    it('should suspend vendor and deactivate listings', async () => {
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
      });
      mockPrisma.productListing.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.organization.update.mockResolvedValue({});

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.suspendVendor('vendor-1', 'Policy violation', 'admin-1');

      expect(mockPrisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { vendorOrgId: 'org-1' },
        data: { active: false },
      });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { status: 'SUSPENDED' },
      });
    });
  });

  describe('Listing Management', () => {
    it('should list listings with filters', async () => {
      mockPrisma.productListing.findMany.mockResolvedValue([
        {
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          vendorSku: 'SKU-1',
          price: 100,
          authenticated: true,
          active: true,
          inStock: true,
          viewCount: 500,
          totalSales: 50,
          createdAt: new Date(),
          productMaster: { productName: 'Test Product', brandName: 'Brand' },
          vendorOrg: { name: 'Vendor' },
        },
      ]);
      mockPrisma.productListing.count.mockResolvedValue(1);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const result = await admin.listListings({
        authenticated: true,
        active: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].authenticated).toBe(true);
    });

    it('should update listing with audit log', async () => {
      // First call for getting before state
      mockPrisma.productListing.findUnique
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          active: false,
        })
        // Second call for updateSearchIndexForListing
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          currency: 'USD',
          price: 100,
          authenticated: true,
          inStock: true,
          active: true,
          productMaster: { brandName: 'Nike', productName: 'Air Max' },
          vendorOrg: { name: 'Vendor' },
        })
        // Third call for getListingDetails
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          vendorSku: 'SKU-1',
          price: 100,
          authenticated: true,
          active: true,
          inStock: true,
          viewCount: 100,
          totalSales: 10,
          createdAt: new Date(),
          internalName: null,
          internalDescription: null,
          compareAtPrice: null,
          availableQuantity: 10,
          locationData: null,
          shippingOptions: [],
          pickupAvailable: false,
          freeShipping: false,
          vendorRating: 4.5,
          reviewCount: 20,
          featured: true,
          searchBoost: 0,
          signalTagId: null,
          metadata: null,
          productMaster: { productName: 'Air Max', brandName: 'Nike' },
          vendorOrg: { name: 'Vendor' },
          signalTag: null,
        });
      mockPrisma.productListing.update.mockResolvedValue({});
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.updateListing('listing-1', { active: true, featured: true }, 'admin-1');

      expect(mockPrisma.productListing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: expect.objectContaining({ active: true, featured: true }),
      });
    });

    it('should bulk update listings', async () => {
      mockPrisma.productListing.updateMany.mockResolvedValue({ count: 5 });

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const count = await admin.bulkUpdateListings(
        ['l1', 'l2', 'l3', 'l4', 'l5'],
        { featured: true },
        'admin-1'
      );

      expect(count).toBe(5);
      expect(mockPrisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['l1', 'l2', 'l3', 'l4', 'l5'] } },
        data: { featured: true },
      });
    });
  });

  describe('ProductMaster Management', () => {
    it('should list products with stats', async () => {
      mockPrisma.productMaster.findMany.mockResolvedValue([
        {
          id: 'pm-1',
          globalSku: 'SKU-1',
          gtin: '123456789',
          brandName: 'Nike',
          productName: 'Air Max 97',
          createdAt: new Date(),
          _count: { marketplaceListings: 3 },
        },
      ]);
      mockPrisma.productMaster.count.mockResolvedValue(1);
      mockPrisma.productListing.aggregate.mockResolvedValue({
        _min: { price: 100 },
        _max: { price: 150 },
      });
      mockPrisma.productListing.groupBy.mockResolvedValue([
        { vendorOrgId: 'org-1' },
        { vendorOrgId: 'org-2' },
      ]);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const result = await admin.listProducts({ brand: 'Nike' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].brandName).toBe('Nike');
      expect(result.items[0].listingCount).toBe(3);
    });

    it('should merge duplicate products', async () => {
      mockPrisma.productListing.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.marketplaceSearchIndex.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.productMaster.delete.mockResolvedValue({});

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.mergeProducts(
        { sourceId: 'pm-duplicate', targetId: 'pm-canonical', deleteSource: true },
        'admin-1'
      );

      expect(mockPrisma.productListing.updateMany).toHaveBeenCalledWith({
        where: { productMasterId: 'pm-duplicate' },
        data: { productMasterId: 'pm-canonical' },
      });
      expect(mockPrisma.productMaster.delete).toHaveBeenCalledWith({
        where: { id: 'pm-duplicate' },
      });
    });
  });

  describe('Search Index Management', () => {
    it('should get search index stats', async () => {
      mockPrisma.marketplaceSearchIndex.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(800)  // active
        .mockResolvedValueOnce(500)  // authenticated
        .mockResolvedValueOnce(750); // inStock
      mockPrisma.marketplaceSearchIndex.aggregate.mockResolvedValue({
        _avg: { price: 125.50 },
      });
      mockPrisma.marketplaceSearchIndex.findFirst.mockResolvedValue({
        updatedAt: new Date('2024-01-15'),
      });

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const stats = await admin.getSearchIndexStats();

      expect(stats.totalEntries).toBe(1000);
      expect(stats.activeEntries).toBe(800);
      expect(stats.authenticatedEntries).toBe(500);
      expect(stats.averagePrice).toBe(125.50);
    });

    it('should rebuild search index', async () => {
      mockPrisma.productListing.findMany.mockResolvedValue([
        {
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          currency: 'USD',
          price: 100,
          authenticated: true,
          inStock: true,
          active: true,
          totalSales: 10,
          viewCount: 100,
          locationData: null,
          productMaster: { brandName: 'Nike', productName: 'Air Max', description: null },
          vendorOrg: { name: 'Vendor' },
        },
      ]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        displayName: 'Vendor Display',
        overallRating: 4.5,
      });
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const result = await admin.rebuildSearchIndex('admin-1');

      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.marketplaceSearchIndex.upsert).toHaveBeenCalled();
    });
  });

  describe('Marketplace Stats', () => {
    it('should get comprehensive marketplace stats', async () => {
      mockPrisma.vendorProfile.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // active
        .mockResolvedValueOnce(10); // pending
      mockPrisma.vendorProfile.groupBy.mockResolvedValue([
        { marketplaceTier: 'FREE', _count: 50 },
        { marketplaceTier: 'HOSTED', _count: 30 },
        { marketplaceTier: 'SCM_PRO', _count: 20 },
      ]);
      mockPrisma.productListing.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(800)  // active
        .mockResolvedValueOnce(500)  // authenticated
        .mockResolvedValueOnce(900); // inStock
      mockPrisma.productMaster.count
        .mockResolvedValueOnce(500) // total
        .mockResolvedValueOnce(450); // with listings
      mockPrisma.productListing.groupBy.mockResolvedValue([
        { productMasterId: 'pm-1' },
        { productMasterId: 'pm-2' },
      ]);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const stats = await admin.getMarketplaceStats();

      expect(stats.vendors.total).toBe(100);
      expect(stats.vendors.active).toBe(80);
      expect(stats.vendors.byTier['FREE']).toBe(50);
      expect(stats.listings.total).toBe(1000);
      expect(stats.products.multiVendor).toBe(2);
    });
  });

  describe('Vendor Reports', () => {
    it('should generate vendor report with attribution', async () => {
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
        displayName: 'Test Vendor',
      });
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          totalPrice: 100,
          addedVia: { llmProvider: 'anthropic' },
          listing: { productMaster: { productName: 'Product 1' } },
        },
        {
          id: 'item-2',
          totalPrice: 150,
          addedVia: { llmProvider: 'anthropic' },
          listing: { productMaster: { productName: 'Product 1' } },
        },
        {
          id: 'item-3',
          totalPrice: 200,
          addedVia: { llmProvider: 'openai' },
          listing: { productMaster: { productName: 'Product 2' } },
        },
      ]);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      const report = await admin.getVendorReport('vendor-1', '30d');

      expect(report.vendorName).toBe('Test Vendor');
      expect(report.metrics.cartAdds).toBe(3);
      expect(report.metrics.revenue).toBe(450);
      expect(report.byProvider['anthropic'].events).toBe(2);
      expect(report.byProvider['anthropic'].revenue).toBe(250);
      expect(report.byProvider['openai'].events).toBe(1);
    });
  });

  describe('Moderation', () => {
    it('should suspend vendor via moderation action', async () => {
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        id: 'vendor-1',
        organizationId: 'org-1',
      });
      mockPrisma.productListing.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.organization.update.mockResolvedValue({});

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.moderateEntity(
        {
          entityType: 'vendor',
          entityId: 'vendor-1',
          action: 'suspend',
          reason: 'Policy violation',
        },
        'admin-1'
      );

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { status: 'SUSPENDED' },
      });
    });

    it('should deactivate listing via moderation action', async () => {
      mockPrisma.productListing.findUnique
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
        })
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          currency: 'USD',
          price: 100,
          authenticated: true,
          inStock: true,
          active: false,
          productMaster: { brandName: 'Nike', productName: 'Air Max' },
          vendorOrg: { name: 'Vendor' },
        })
        .mockResolvedValueOnce({
          id: 'listing-1',
          vendorOrgId: 'org-1',
          productMasterId: 'pm-1',
          vendorSku: 'SKU-1',
          price: 100,
          authenticated: true,
          active: false,
          inStock: true,
          viewCount: 100,
          totalSales: 10,
          createdAt: new Date(),
          internalName: null,
          internalDescription: null,
          compareAtPrice: null,
          availableQuantity: 10,
          locationData: null,
          shippingOptions: [],
          pickupAvailable: false,
          freeShipping: false,
          vendorRating: 4.5,
          reviewCount: 20,
          featured: false,
          searchBoost: 0,
          signalTagId: null,
          metadata: null,
          productMaster: { productName: 'Air Max', brandName: 'Nike' },
          vendorOrg: { name: 'Vendor' },
          signalTag: null,
        });
      mockPrisma.productListing.update.mockResolvedValue({});
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);

      const admin = createMarketplaceAdmin(mockPrisma as any);
      await admin.moderateEntity(
        {
          entityType: 'listing',
          entityId: 'listing-1',
          action: 'suspend',
          reason: 'Inappropriate content',
        },
        'admin-1'
      );

      expect(mockPrisma.productListing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: expect.objectContaining({ active: false }),
      });
    });
  });
});

