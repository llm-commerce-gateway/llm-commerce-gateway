/**
 * Ingestion Pipeline Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionPipeline, createIngestionPipeline } from '../../../src/catalog/ingestion/pipeline';
import type { ProductFetcher, VendorProductInput } from '../../../src/catalog/ingestion/types';

// Mock Prisma
const mockPrisma = {
  productMaster: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  productListing: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  vendorProfile: {
    findUnique: vi.fn(),
  },
  marketplaceSearchIndex: {
    upsert: vi.fn(),
  },
  integration: {
    findFirst: vi.fn(),
  },
};

// Mock fetcher
const mockFetcher: ProductFetcher = {
  name: 'shopify',
  fetchProducts: vi.fn(),
};

describe('IngestionPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ingestVendorProducts', () => {
    it('should process products in batches', async () => {
      const mockProducts: VendorProductInput[] = [
        { vendorSku: 'SKU-1', name: 'Product 1', price: 100, inStock: true },
        { vendorSku: 'SKU-2', name: 'Product 2', price: 200, inStock: true },
        { vendorSku: 'SKU-3', name: 'Product 3', price: 300, inStock: false },
      ];

      (mockFetcher.fetchProducts as any).mockResolvedValue(mockProducts);

      // Mock product matcher responses
      mockPrisma.productMaster.findFirst.mockResolvedValue(null);
      mockPrisma.productMaster.create.mockImplementation(async (args: any) => ({
        id: `pm-${Date.now()}`,
        ...args.data,
      }));

      mockPrisma.productMaster.findUnique.mockResolvedValue({ productName: 'Test' });
      mockPrisma.productListing.findUnique.mockResolvedValue(null);
      mockPrisma.productListing.create.mockImplementation(async (args: any) => ({
        id: `listing-${Date.now()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
        productMaster: { brandName: 'Test', productName: 'Product' },
        vendorOrg: { name: 'Vendor' },
      }));

      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});

      const pipeline = new IngestionPipeline({ prisma: mockPrisma as any });
      pipeline.registerFetcher(mockFetcher);

      const result = await pipeline.ingestVendorProducts('vendor-1', 'shopify', {
        batchSize: 2,
      });

      expect(result.totalProcessed).toBe(3);
      expect(result.errors.length).toBe(0);
      expect(mockFetcher.fetchProducts).toHaveBeenCalledWith('vendor-1', expect.any(Object));
    });

    it('should track new vs matched products', async () => {
      const mockProducts: VendorProductInput[] = [
        { vendorSku: 'NEW-1', name: 'New Product', price: 100, inStock: true },
        { vendorSku: 'EXISTING-1', gtin: '123456', name: 'Existing', price: 50, inStock: true },
      ];

      (mockFetcher.fetchProducts as any).mockResolvedValue(mockProducts);

      // First product: no GTIN match, create new
      // Second product: GTIN match
      mockPrisma.productMaster.findFirst
        .mockResolvedValueOnce(null) // No GTIN match for first
        .mockResolvedValueOnce({ id: 'pm-existing', productName: 'Existing' }); // GTIN match for second

      mockPrisma.productMaster.create.mockResolvedValue({
        id: 'pm-new',
        productName: 'New Product',
      });

      mockPrisma.productMaster.findUnique.mockResolvedValue({ productName: 'Test' });
      mockPrisma.productListing.findUnique.mockResolvedValue(null);
      mockPrisma.productListing.create.mockResolvedValue({
        id: 'listing-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        productMaster: { brandName: 'Test', productName: 'Product' },
        vendorOrg: { name: 'Vendor' },
      });
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});

      const pipeline = new IngestionPipeline({ prisma: mockPrisma as any });
      pipeline.registerFetcher(mockFetcher);

      const result = await pipeline.ingestVendorProducts('vendor-1', 'shopify');

      expect(result.productsCreated + result.productsMatched).toBe(2);
    });

    it('should handle dry run mode', async () => {
      const mockProducts: VendorProductInput[] = [
        { vendorSku: 'SKU-1', name: 'Product 1', price: 100, inStock: true },
      ];

      (mockFetcher.fetchProducts as any).mockResolvedValue(mockProducts);
      mockPrisma.productMaster.findFirst.mockResolvedValue(null);
      mockPrisma.productMaster.create.mockResolvedValue({ id: 'pm-1' });

      const pipeline = new IngestionPipeline({ prisma: mockPrisma as any });
      pipeline.registerFetcher(mockFetcher);

      const result = await pipeline.ingestVendorProducts('vendor-1', 'shopify', {
        dryRun: true,
      });

      expect(result.totalProcessed).toBe(1);
      expect(result.listingsCreated).toBe(0); // Dry run = no listings created
      expect(mockPrisma.productListing.create).not.toHaveBeenCalled();
    });

    it('should collect errors without stopping', async () => {
      const mockProducts: VendorProductInput[] = [
        { vendorSku: 'SKU-1', name: 'Good', price: 100, inStock: true },
        { vendorSku: 'SKU-BAD', name: 'Bad', price: 100, inStock: true },
        { vendorSku: 'SKU-2', name: 'Good 2', price: 100, inStock: true },
      ];

      (mockFetcher.fetchProducts as any).mockResolvedValue(mockProducts);

      mockPrisma.productMaster.findFirst.mockResolvedValue(null);
      mockPrisma.productMaster.findUnique.mockResolvedValue({ productName: 'Test' });
      
      // First succeeds, second fails, third succeeds
      let createCount = 0;
      mockPrisma.productMaster.create.mockImplementation(async () => {
        createCount++;
        if (createCount === 2) {
          throw new Error('Database error');
        }
        return { id: `pm-${createCount}` };
      });

      mockPrisma.productListing.findUnique.mockResolvedValue(null);
      mockPrisma.productListing.create.mockResolvedValue({
        id: 'listing',
        createdAt: new Date(),
        updatedAt: new Date(),
        productMaster: { brandName: 'Test', productName: 'Product' },
        vendorOrg: { name: 'Vendor' },
      });
      mockPrisma.vendorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.marketplaceSearchIndex.upsert.mockResolvedValue({});

      const pipeline = new IngestionPipeline({ prisma: mockPrisma as any });
      pipeline.registerFetcher(mockFetcher);

      const result = await pipeline.ingestVendorProducts('vendor-1', 'shopify', {
        continueOnError: true,
        batchSize: 10, // Process all in one batch
      });

      expect(result.totalProcessed).toBe(3);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].vendorSku).toBe('SKU-BAD');
    });

    it('should throw if no fetcher registered', async () => {
      const pipeline = new IngestionPipeline({ prisma: mockPrisma as any });

      await expect(
        pipeline.ingestVendorProducts('vendor-1', 'shopify')
      ).rejects.toThrow('No fetcher registered for source: shopify');
    });
  });

  describe('registerFetcher', () => {
    it('should register fetcher by name', () => {
      const pipeline = createIngestionPipeline(mockPrisma as any, [mockFetcher]);
      
      // Should not throw when fetcher is registered
      expect(async () => {
        (mockFetcher.fetchProducts as any).mockResolvedValue([]);
        await pipeline.ingestVendorProducts('vendor-1', 'shopify');
      }).not.toThrow();
    });
  });
});

