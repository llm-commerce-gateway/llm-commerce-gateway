/**
 * Marketplace Search Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarketplaceSearchHandler,
  createMarketplaceSearchHandler,
  MarketplaceSearchSchema,
  marketplaceSearchToolDefinition,
} from '../../../src/tools/marketplace-search';

// Mock Prisma
const mockPrisma = {
  marketplaceSearchIndex: {
    findMany: vi.fn(),
  },
  productMaster: {
    findUnique: vi.fn(),
  },
};

describe('MarketplaceSearchSchema', () => {
  it('should validate minimal input', () => {
    const result = MarketplaceSearchSchema.safeParse({
      query: 'Nike Air Max',
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('Nike Air Max');
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('relevance');
    }
  });

  it('should validate full input', () => {
    const result = MarketplaceSearchSchema.safeParse({
      query: 'Nike Air Max 97',
      userLocation: { lat: 40.7128, lng: -74.0060 },
      filters: {
        brand: 'Nike',
        priceMax: 200,
        authenticatedOnly: true,
      },
      sortBy: 'price_low',
      limit: 20,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filters?.brand).toBe('Nike');
      expect(result.data.filters?.priceMax).toBe(200);
      expect(result.data.sortBy).toBe('price_low');
    }
  });

  it('should reject empty query', () => {
    const result = MarketplaceSearchSchema.safeParse({
      query: '',
    });
    
    expect(result.success).toBe(false);
  });

  it('should reject invalid sortBy', () => {
    const result = MarketplaceSearchSchema.safeParse({
      query: 'test',
      sortBy: 'invalid',
    });
    
    expect(result.success).toBe(false);
  });
});

describe('marketplaceSearchToolDefinition', () => {
  it('should have correct name', () => {
    expect(marketplaceSearchToolDefinition.name).toBe('product_search');
  });

  it('should have required query parameter', () => {
    expect(marketplaceSearchToolDefinition.parameters.required).toContain('query');
  });

  it('should define all filter options', () => {
    const filters = marketplaceSearchToolDefinition.parameters.properties.filters.properties;
    
    expect(filters).toHaveProperty('brand');
    expect(filters).toHaveProperty('category');
    expect(filters).toHaveProperty('priceMin');
    expect(filters).toHaveProperty('priceMax');
    expect(filters).toHaveProperty('authenticatedOnly');
    expect(filters).toHaveProperty('inStockOnly');
  });

  it('should define sortBy options', () => {
    const sortBy = marketplaceSearchToolDefinition.parameters.properties.sortBy;
    
    expect(sortBy.enum).toContain('relevance');
    expect(sortBy.enum).toContain('price_low');
    expect(sortBy.enum).toContain('price_high');
    expect(sortBy.enum).toContain('distance');
  });
});

describe('MarketplaceSearchHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should return formatted results', async () => {
      const mockSearchResults = [
        {
          listingId: 'listing-1',
          productMasterId: 'pm-1',
          vendorOrgId: 'vendor-1',
          vendorName: 'Sneaker Paradise',
          vendorRating: 4.8,
          price: 135,
          currency: 'USD',
          authenticated: true,
          inStock: true,
          active: true,
          locationLat: null,
          locationLng: null,
          city: 'Brooklyn',
          state: 'NY',
          totalSales: 100,
          viewCount: 500,
        },
      ];

      const mockProductMaster = {
        id: 'pm-1',
        brandName: 'Nike',
        productName: 'Air Max 97',
        description: 'Classic sneaker',
        gtin: '123456789',
      };

      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockSearchResults);
      mockPrisma.productMaster.findUnique.mockResolvedValue(mockProductMaster);

      const handler = createMarketplaceSearchHandler(mockPrisma as any);
      
      const result = await handler.search(
        { query: 'Nike Air Max' },
        {
          sessionId: 'test-session',
          llmProvider: 'anthropic',
          timestamp: new Date(),
        }
      );

      expect(result.type).toBe('search_results');
      expect(result.data?.totalProducts).toBe(1);
      expect(result.data?.query).toBe('Nike Air Max');
      expect(result.content).toContain('Nike');
      expect(result.content).toContain('Air Max 97');
    });

    it('should return empty message when no results', async () => {
      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue([]);

      const handler = createMarketplaceSearchHandler(mockPrisma as any);
      
      const result = await handler.search(
        { query: 'NonexistentProduct12345' },
        {
          sessionId: 'test-session',
          llmProvider: 'anthropic',
          timestamp: new Date(),
        }
      );

      expect(result.type).toBe('search_results');
      expect(result.data?.totalProducts).toBe(0);
      expect(result.content).toContain("couldn't find any products");
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.marketplaceSearchIndex.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const handler = createMarketplaceSearchHandler(mockPrisma as any);
      
      const result = await handler.search(
        { query: 'Nike' },
        {
          sessionId: 'test-session',
          llmProvider: 'anthropic',
          timestamp: new Date(),
        }
      );

      expect(result.type).toBe('error');
      expect(result.error).toBe('Database error');
      expect(result.content).toContain('error');
    });

    it('should include listing URLs in response', async () => {
      const mockSearchResults = [
        {
          listingId: 'listing-xyz',
          productMasterId: 'pm-1',
          vendorOrgId: 'vendor-1',
          vendorName: 'Test Vendor',
          vendorRating: 4.5,
          price: 100,
          currency: 'USD',
          authenticated: false,
          inStock: true,
          active: true,
          locationLat: null,
          locationLng: null,
          city: null,
          state: null,
          totalSales: 50,
          viewCount: 200,
        },
      ];

      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockSearchResults);
      mockPrisma.productMaster.findUnique.mockResolvedValue({
        id: 'pm-1',
        brandName: 'Test',
        productName: 'Product',
        description: 'Test product',
      });

      const handler = new MarketplaceSearchHandler(
        mockPrisma as any,
        'https://shop.example.com'
      );
      
      const result = await handler.search(
        { query: 'test' },
        {
          sessionId: 'test-session',
          llmProvider: 'openai',
          timestamp: new Date(),
        }
      );

      expect(result.data?.results[0].vendors[0].listingUrl).toBe(
        'https://shop.example.com/listings/listing-xyz'
      );
    });
  });
});

describe('LLM Response Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format authenticated products with checkmark', async () => {
    const mockSearchResults = [{
      listingId: 'l-1',
      productMasterId: 'pm-1',
      vendorOrgId: 'v-1',
      vendorName: 'Auth Vendor',
      vendorRating: 5.0,
      price: 150,
      currency: 'USD',
      authenticated: true,
      inStock: true,
      active: true,
      locationLat: null,
      locationLng: null,
      city: null,
      state: null,
      totalSales: 200,
      viewCount: 1000,
    }];

    mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockSearchResults);
    mockPrisma.productMaster.findUnique.mockResolvedValue({
      id: 'pm-1',
      brandName: 'Brand',
      productName: 'Product',
      description: 'Description',
    });

    const handler = createMarketplaceSearchHandler(mockPrisma as any);
    const result = await handler.search(
      { query: 'test' },
      { sessionId: 's', llmProvider: 'anthropic', timestamp: new Date() }
    );

    expect(result.content).toContain('✓ Signal Tag Authenticated');
  });

  it('should show vendor ratings with star emoji', async () => {
    const mockSearchResults = [{
      listingId: 'l-1',
      productMasterId: 'pm-1',
      vendorOrgId: 'v-1',
      vendorName: 'Top Vendor',
      vendorRating: 4.9,
      price: 100,
      currency: 'USD',
      authenticated: false,
      inStock: true,
      active: true,
      locationLat: null,
      locationLng: null,
      city: null,
      state: null,
      totalSales: 100,
      viewCount: 500,
    }];

    mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockSearchResults);
    mockPrisma.productMaster.findUnique.mockResolvedValue({
      id: 'pm-1',
      brandName: 'Brand',
      productName: 'Product',
      description: 'Description',
    });

    const handler = createMarketplaceSearchHandler(mockPrisma as any);
    const result = await handler.search(
      { query: 'test' },
      { sessionId: 's', llmProvider: 'anthropic', timestamp: new Date() }
    );

    expect(result.content).toContain('⭐ 4.9');
  });
});

