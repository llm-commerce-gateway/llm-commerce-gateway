/**
 * Search and Ranking Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rankListings,
  calculateRankScore,
  calculateDistance,
  type SearchResultRow,
  type RankingContext,
} from '../../../src/catalog/ranking-service';
import {
  SearchService,
  createSearchService,
} from '../../../src/catalog/search-service';

// ============================================================================
// Ranking Service Tests
// ============================================================================

describe('rankListings', () => {
  const mockSearchResults: SearchResultRow[] = [
    {
      listingId: 'listing-1',
      productMasterId: 'pm-1',
      vendorOrgId: 'vendor-a',
      vendorName: 'Sneaker Paradise',
      vendorRating: 4.9,
      price: 135,
      currency: 'USD',
      authenticated: true,
      inStock: true,
      availableQuantity: 10,
      locationLat: 40.6892,
      locationLng: -73.9900,
      city: 'Brooklyn',
      state: 'NY',
      distance: 5, // 5 miles
      relevance: 0.95,
    },
    {
      listingId: 'listing-2',
      productMasterId: 'pm-1',
      vendorOrgId: 'vendor-b',
      vendorName: 'Discount Sneakers',
      vendorRating: 4.1,
      price: 130,
      currency: 'USD',
      authenticated: false,
      inStock: true,
      availableQuantity: 25,
      locationLat: 32.7767,
      locationLng: -96.7970,
      city: 'Dallas',
      state: 'TX',
      distance: 1500, // 1500 miles
      relevance: 0.90,
    },
    {
      listingId: 'listing-3',
      productMasterId: 'pm-1',
      vendorOrgId: 'vendor-c',
      vendorName: 'Classic Kicks',
      vendorRating: 5.0,
      price: 140,
      currency: 'USD',
      authenticated: true,
      inStock: true,
      availableQuantity: 8,
      locationLat: 34.0928,
      locationLng: -118.3287,
      city: 'Los Angeles',
      state: 'CA',
      distance: 30, // 30 miles
      relevance: 0.92,
    },
  ];

  it('should rank listings by default (relevance)', () => {
    const ranked = rankListings(mockSearchResults, {});
    
    expect(ranked.length).toBe(3);
    // First should have highest rank score
    expect(ranked[0].rankScore).toBeGreaterThanOrEqual(ranked[1].rankScore);
    expect(ranked[1].rankScore).toBeGreaterThanOrEqual(ranked[2].rankScore);
  });

  it('should boost authenticated listings', () => {
    const ranked = rankListings(mockSearchResults, {});
    
    const authListing = ranked.find(l => l.id === 'listing-1');
    const unauthListing = ranked.find(l => l.id === 'listing-2');
    
    expect(authListing?.rankFactors.authentication).toBe(20);
    expect(unauthListing?.rankFactors.authentication).toBe(0);
  });

  it('should boost nearby listings when user location provided', () => {
    const ranked = rankListings(mockSearchResults, {
      userLocation: { lat: 40.7128, lng: -74.0060 }, // NYC
    });
    
    // Brooklyn listing should have distance factor
    const brooklynListing = ranked.find(l => l.id === 'listing-1');
    expect(brooklynListing?.rankFactors.distance).toBe(30); // Same city
    
    // Dallas listing should have no distance factor (too far)
    const dallasListing = ranked.find(l => l.id === 'listing-2');
    expect(dallasListing?.rankFactors.distance).toBe(0);
  });

  it('should boost higher-rated vendors', () => {
    const ranked = rankListings(mockSearchResults, {});
    
    const rating5 = ranked.find(l => l.id === 'listing-3');
    const rating49 = ranked.find(l => l.id === 'listing-1');
    const rating41 = ranked.find(l => l.id === 'listing-2');
    
    expect(rating5?.rankFactors.vendorRating).toBe(15);  // >= 4.5
    expect(rating49?.rankFactors.vendorRating).toBe(15); // >= 4.5
    expect(rating41?.rankFactors.vendorRating).toBe(10); // >= 4.0
  });

  it('should sort by price when requested', () => {
    const ranked = rankListings(mockSearchResults, { sortBy: 'price_low' });
    
    expect(ranked[0].price).toBe(130); // Cheapest first
    expect(ranked[1].price).toBe(135);
    expect(ranked[2].price).toBe(140);
  });

  it('should sort by distance when requested', () => {
    const ranked = rankListings(mockSearchResults, { 
      sortBy: 'distance',
      userLocation: { lat: 40.7128, lng: -74.0060 },
    });
    
    expect(ranked[0].id).toBe('listing-1'); // Brooklyn (5 miles)
    expect(ranked[1].id).toBe('listing-3'); // LA (30 miles)
    expect(ranked[2].id).toBe('listing-2'); // Dallas (1500 miles)
  });
});

describe('calculateRankScore', () => {
  it('should return base score of 100 with no factors', () => {
    const result = calculateRankScore(
      {
        listingId: 'test',
        productMasterId: 'pm',
        vendorOrgId: 'v',
        vendorName: 'Test',
        price: 100,
        authenticated: false,
        inStock: true,
      },
      {}
    );
    
    expect(result.rankScore).toBe(100);
    expect(result.rankFactors.total).toBe(0);
  });

  it('should add authentication bonus', () => {
    const result = calculateRankScore(
      {
        listingId: 'test',
        productMasterId: 'pm',
        vendorOrgId: 'v',
        vendorName: 'Test',
        price: 100,
        authenticated: true,
        inStock: true,
      },
      {}
    );
    
    expect(result.rankFactors.authentication).toBe(20);
    expect(result.rankScore).toBe(120);
  });
});

describe('calculateDistance', () => {
  it('should calculate distance between two points', () => {
    // NYC to LA
    const distance = calculateDistance(
      { lat: 40.7128, lng: -74.0060 }, // NYC
      { lat: 34.0522, lng: -118.2437 } // LA
    );
    
    // Should be approximately 2,450 miles
    expect(distance).toBeGreaterThan(2400);
    expect(distance).toBeLessThan(2500);
  });

  it('should return 0 for same location', () => {
    const distance = calculateDistance(
      { lat: 40.7128, lng: -74.0060 },
      { lat: 40.7128, lng: -74.0060 }
    );
    
    expect(distance).toBe(0);
  });

  it('should calculate short distances accurately', () => {
    // Brooklyn to Manhattan
    const distance = calculateDistance(
      { lat: 40.6892, lng: -73.9900 }, // Brooklyn
      { lat: 40.7831, lng: -73.9712 } // Manhattan
    );
    
    // Should be approximately 6-7 miles
    expect(distance).toBeGreaterThan(5);
    expect(distance).toBeLessThan(10);
  });
});

// ============================================================================
// Search Service Tests (with mocks)
// ============================================================================

describe('SearchService', () => {
  const mockPrisma = {
    marketplaceSearchIndex: {
      findMany: vi.fn(),
    },
    productMaster: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should return search results grouped by product', async () => {
      const mockIndexResults = [
        {
          listingId: 'listing-1',
          productMasterId: 'pm-1',
          vendorOrgId: 'vendor-a',
          vendorName: 'Sneaker Paradise',
          vendorRating: 4.9,
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
        {
          listingId: 'listing-2',
          productMasterId: 'pm-1',
          vendorOrgId: 'vendor-b',
          vendorName: 'Discount Sneakers',
          vendorRating: 4.1,
          price: 130,
          currency: 'USD',
          authenticated: false,
          inStock: true,
          active: true,
          locationLat: null,
          locationLng: null,
          city: 'Dallas',
          state: 'TX',
          totalSales: 50,
          viewCount: 200,
        },
      ];

      const mockProductMaster = {
        id: 'pm-1',
        brandName: 'Nike',
        productName: 'Air Max 97',
        description: 'Classic sneaker',
        gtin: '123456789',
      };

      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockIndexResults);
      mockPrisma.productMaster.findUnique.mockResolvedValue(mockProductMaster);

      const service = new SearchService({ prisma: mockPrisma as any });
      const response = await service.search({ text: 'Nike Air Max' });

      expect(response.results.length).toBe(1);
      expect(response.results[0].product.name).toBe('Air Max 97');
      expect(response.results[0].listings.length).toBe(2);
      expect(response.results[0].totalVendors).toBe(2);
    });

    it('should apply filters', async () => {
      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue([]);
      mockPrisma.productMaster.findUnique.mockResolvedValue(null);

      const service = new SearchService({ prisma: mockPrisma as any });
      
      await service.search({
        text: 'Nike',
        filters: {
          authenticatedOnly: true,
          priceMax: 150,
        },
      });

      // Check that filters were applied
      expect(mockPrisma.marketplaceSearchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authenticated: true,
            price: expect.objectContaining({
              lte: 150,
            }),
          }),
        })
      );
    });

    it('should limit listings per product', async () => {
      // Create 5 listings for same product
      const mockIndexResults = Array(5).fill(null).map((_, i) => ({
        listingId: `listing-${i}`,
        productMasterId: 'pm-1',
        vendorOrgId: `vendor-${i}`,
        vendorName: `Vendor ${i}`,
        vendorRating: 4.0,
        price: 100 + i * 10,
        currency: 'USD',
        authenticated: i % 2 === 0,
        inStock: true,
        active: true,
        locationLat: null,
        locationLng: null,
        city: 'NYC',
        state: 'NY',
        totalSales: 100 - i * 10,
        viewCount: 500 - i * 50,
      }));

      const mockProductMaster = {
        id: 'pm-1',
        brandName: 'Nike',
        productName: 'Air Max 97',
        description: 'Classic sneaker',
        gtin: '123456789',
      };

      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue(mockIndexResults);
      mockPrisma.productMaster.findUnique.mockResolvedValue(mockProductMaster);

      const service = new SearchService({ 
        prisma: mockPrisma as any,
        maxListingsPerProduct: 3,
      });
      
      const response = await service.search({ text: 'Nike' });

      // Should only return 3 listings per product
      expect(response.results[0].listings.length).toBe(3);
      expect(response.results[0].totalVendors).toBe(5);
    });
  });

  describe('suggest', () => {
    it('should return autocomplete suggestions', async () => {
      mockPrisma.marketplaceSearchIndex.findMany.mockResolvedValue([
        { productName: 'Nike Air Max 97', brand: 'Nike' },
        { productName: 'Nike Air Force 1', brand: 'Nike' },
      ]);

      const service = new SearchService({ prisma: mockPrisma as any });
      const suggestions = await service.suggest('Nik');

      expect(suggestions).toContain('Nike Air Max 97');
      expect(suggestions).toContain('Nike Air Force 1');
    });

    it('should return empty for short prefix', async () => {
      const service = new SearchService({ prisma: mockPrisma as any });
      const suggestions = await service.suggest('N');

      expect(suggestions).toEqual([]);
      expect(mockPrisma.marketplaceSearchIndex.findMany).not.toHaveBeenCalled();
    });
  });
});

