/**
 * Analytics Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AnalyticsService,
  createAnalyticsService,
} from '../../../src/analytics/analytics-service';

// Mock Prisma
const mockPrisma = {
  productListing: {
    count: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  cartItem: {
    count: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  marketplaceSearchIndex: {
    aggregate: vi.fn(),
  },
  vendorProfile: {
    findUnique: vi.fn(),
  },
};

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return overview stats', async () => {
      mockPrisma.productListing.aggregate.mockResolvedValue({
        _sum: { viewCount: 1000 },
      });
      mockPrisma.cartItem.count.mockResolvedValue(50);
      mockPrisma.cartItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: 2500 },
      });
      mockPrisma.marketplaceSearchIndex.aggregate.mockResolvedValue({
        _avg: { totalSales: 50 },
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getOverview('vendor-1', '30d');

      expect(result.period).toBe('30d');
      expect(result.stats).toHaveProperty('searchAppearances');
      expect(result.stats).toHaveProperty('cartAdds');
      expect(result.stats).toHaveProperty('conversionRate');
      expect(result.stats).toHaveProperty('orders');
      expect(result.stats).toHaveProperty('revenue');
      expect(result.stats).toHaveProperty('avgRank');
    });

    it('should calculate conversion rate correctly', async () => {
      mockPrisma.productListing.aggregate.mockResolvedValue({
        _sum: { viewCount: 100 },
      });
      mockPrisma.cartItem.count.mockResolvedValue(10);
      mockPrisma.cartItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: 500 },
      });
      mockPrisma.marketplaceSearchIndex.aggregate.mockResolvedValue({
        _avg: { totalSales: 10 },
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getOverview('vendor-1', '30d');

      // 10 cart adds / 100 appearances = 10%
      expect(result.stats.conversionRate).toBe(10);
    });

    it('should handle zero search appearances', async () => {
      mockPrisma.productListing.aggregate.mockResolvedValue({
        _sum: { viewCount: null },
      });
      mockPrisma.cartItem.count.mockResolvedValue(0);
      mockPrisma.cartItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrisma.marketplaceSearchIndex.aggregate.mockResolvedValue({
        _avg: { totalSales: null },
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getOverview('vendor-1', '30d');

      expect(result.stats.conversionRate).toBe(0);
    });
  });

  describe('getAttribution', () => {
    it('should group cart adds by LLM provider', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { addedVia: { llmProvider: 'anthropic' }, totalPrice: 100 },
        { addedVia: { llmProvider: 'anthropic' }, totalPrice: 150 },
        { addedVia: { llmProvider: 'openai' }, totalPrice: 200 },
        { addedVia: { llmProvider: 'grok' }, totalPrice: 75 },
      ]);

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getAttribution('vendor-1', '30d');

      expect(result.period).toBe('30d');
      expect(result.totalEvents).toBe(4);
      expect(result.totalRevenue).toBe(525);
      expect(result.byProvider).toHaveLength(3);

      const anthropic = result.byProvider.find(p => p.provider === 'anthropic');
      expect(anthropic?.events).toBe(2);
      expect(anthropic?.revenue).toBe(250);
    });

    it('should handle unknown providers', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { addedVia: { llmProvider: undefined }, totalPrice: 100 },
        { addedVia: null, totalPrice: 50 },
      ]);

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getAttribution('vendor-1', '30d');

      const unknown = result.byProvider.find(p => p.provider === 'unknown');
      expect(unknown?.events).toBe(2);
    });

    it('should calculate percentages correctly', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { addedVia: { llmProvider: 'anthropic' }, totalPrice: 100 },
        { addedVia: { llmProvider: 'anthropic' }, totalPrice: 100 },
        { addedVia: { llmProvider: 'openai' }, totalPrice: 100 },
        { addedVia: { llmProvider: 'openai' }, totalPrice: 100 },
      ]);

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getAttribution('vendor-1', '30d');

      expect(result.byProvider[0].percentage).toBe(50);
      expect(result.byProvider[1].percentage).toBe(50);
    });
  });

  describe('getCompetitiveInsights', () => {
    it('should identify competitors selling same products', async () => {
      mockPrisma.productListing.findMany
        .mockResolvedValueOnce([
          // My listings
          { productMasterId: 'pm-1', price: 100, vendorRating: 4.5, authenticated: true },
          { productMasterId: 'pm-2', price: 150, vendorRating: 4.8, authenticated: true },
        ])
        .mockResolvedValueOnce([
          // Competitor listings
          {
            productMasterId: 'pm-1',
            vendorOrgId: 'comp-1',
            price: 95,
            vendorRating: 4.2,
            authenticated: true,
            vendorOrg: { id: 'comp-1', name: 'Competitor A' },
          },
          {
            productMasterId: 'pm-1',
            vendorOrgId: 'comp-2',
            price: 110,
            vendorRating: 4.7,
            authenticated: false,
            vendorOrg: { id: 'comp-2', name: 'Competitor B' },
          },
        ]);

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getCompetitiveInsights('vendor-1');

      expect(result.myStats).toHaveProperty('avgPrice');
      expect(result.myStats).toHaveProperty('avgRating');
      expect(result.myStats).toHaveProperty('authenticatedPercentage');
      expect(result.competitors.length).toBeGreaterThan(0);
      expect(result.insights).toHaveProperty('pricePosition');
      expect(result.insights).toHaveProperty('ratingPosition');
    });

    it('should handle no competitors', async () => {
      mockPrisma.productListing.findMany
        .mockResolvedValueOnce([
          { productMasterId: 'pm-1', price: 100, vendorRating: 4.5, authenticated: true },
        ])
        .mockResolvedValueOnce([]);

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getCompetitiveInsights('vendor-1');

      expect(result.competitors).toHaveLength(0);
    });
  });

  describe('getRecommendations', () => {
    it('should recommend Signal Tag for unauthenticated products', async () => {
      mockPrisma.productListing.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5)  // unauthenticated
        .mockResolvedValueOnce(0); // out of stock

      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.8,
        returnPolicy: 'Policy',
        shippingPolicy: 'Policy',
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      const authRec = result.recommendations.find(r => r.category === 'authentication');
      expect(authRec).toBeDefined();
      expect(authRec?.priority).toBe('high');
      expect(authRec?.description).toContain('5');
    });

    it('should recommend improving rating if below 4.5', async () => {
      mockPrisma.productListing.count.mockResolvedValue(10);
      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.0,
        returnPolicy: 'Policy',
        shippingPolicy: 'Policy',
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      const ratingRec = result.recommendations.find(r => r.category === 'reputation');
      expect(ratingRec).toBeDefined();
      expect(ratingRec?.description).toContain('4.0');
    });

    it('should recommend completing policies if missing', async () => {
      mockPrisma.productListing.count.mockResolvedValue(10);
      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.8,
        returnPolicy: null,
        shippingPolicy: null,
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      const contentRec = result.recommendations.find(r => r.category === 'content');
      expect(contentRec).toBeDefined();
      expect(contentRec?.priority).toBe('low');
    });

    it('should flag out-of-stock items', async () => {
      mockPrisma.productListing.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(10) // unauthenticated
        .mockResolvedValueOnce(3); // out of stock

      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.8,
        returnPolicy: 'Policy',
        shippingPolicy: 'Policy',
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      const inventoryRec = result.recommendations.find(r => r.category === 'inventory');
      expect(inventoryRec).toBeDefined();
      expect(inventoryRec?.priority).toBe('high');
    });

    it('should calculate total potential boost', async () => {
      mockPrisma.productListing.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5)  // unauthenticated (5 * 20 = 100)
        .mockResolvedValueOnce(0); // out of stock

      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.0, // +12 boost
        returnPolicy: null, // +5 boost
        shippingPolicy: null,
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      expect(result.totalPotentialBoost).toBeGreaterThan(0);
    });

    it('should sort recommendations by priority', async () => {
      mockPrisma.productListing.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5)  // unauthenticated (high)
        .mockResolvedValueOnce(2); // out of stock (high)

      mockPrisma.productListing.findMany.mockResolvedValue([]);
      mockPrisma.vendorProfile.findUnique.mockResolvedValue({
        overallRating: 4.0, // medium
        returnPolicy: null, // low
        shippingPolicy: null,
      });

      const service = createAnalyticsService(mockPrisma as any);
      const result = await service.getRecommendations('vendor-1');

      // High priority should come first
      const priorities = result.recommendations.map(r => r.priority);
      const highIndex = priorities.indexOf('high');
      const mediumIndex = priorities.indexOf('medium');
      const lowIndex = priorities.indexOf('low');

      if (highIndex >= 0 && mediumIndex >= 0) {
        expect(highIndex).toBeLessThan(mediumIndex);
      }
      if (mediumIndex >= 0 && lowIndex >= 0) {
        expect(mediumIndex).toBeLessThan(lowIndex);
      }
    });
  });
});

