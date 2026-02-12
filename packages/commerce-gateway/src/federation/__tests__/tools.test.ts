/**
 * Federation Tools Tests
 *
 * Tests for ShopMerchantTool and DiscoverMerchantsTool.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopMerchantTool } from '../tools/shop-merchant';
import { DiscoverMerchantsTool, type DiscoveryProvider } from '../tools/discover-merchants';
import { MemoryMerchantRegistry } from '../registry/memory';
import { IntentParser } from '../router/intent-parser';
import { GatewayClient } from '../client/gateway-client';
import type { MerchantRegistration, FederatedResult } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const vuoriMerchant: MerchantRegistration = {
  domain: 'vuoriclothing.com',
  aliases: ['vuori', 'vuori clothing'],
  gatewayUrl: 'https://api.vuoriclothing.com',
  tier: 'verified',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: 'Vuori',
    categories: ['activewear', 'athleisure', 'fitness'],
  },
};

const nikeMerchant: MerchantRegistration = {
  domain: 'nike.com',
  aliases: ['nike'],
  gatewayUrl: 'https://api.nike.com',
  tier: 'verified',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: true,
  },
  metadata: {
    name: 'Nike',
    categories: ['activewear', 'sportswear', 'footwear'],
  },
};

const noSearchMerchant: MerchantRegistration = {
  domain: 'nosearch.com',
  aliases: ['nosearch'],
  gatewayUrl: 'https://api.nosearch.com',
  tier: 'registered',
  capabilities: {
    search: false,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: 'No Search Store',
    categories: ['other'],
  },
};

const mockSearchResult = {
  products: [
    {
      id: 'prod-1',
      title: 'Test Joggers',
      description: 'Comfortable joggers',
      price: { amount: 98, currency: 'USD' },
      images: [],
      url: 'https://example.com/joggers',
      inStock: true,
    },
  ],
  total: 1,
  hasMore: false,
};

// ============================================================================
// ShopMerchantTool Tests
// ============================================================================

describe('ShopMerchantTool', () => {
  let registry: MemoryMerchantRegistry;
  let parser: IntentParser;
  let client: GatewayClient;
  let tool: ShopMerchantTool;

  beforeEach(async () => {
    registry = new MemoryMerchantRegistry([vuoriMerchant, nikeMerchant, noSearchMerchant]);
    parser = new IntentParser({ registry });
    client = new GatewayClient({ timeout: 5000, retries: 1 });
    tool = new ShopMerchantTool(registry, client, parser);

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: mockSearchResult }),
    });
  });

  describe('execute', () => {
    it('should execute search for known merchant by domain', async () => {
      const result = await tool.execute({
        merchant: 'vuoriclothing.com',
        query: 'joggers',
      });

      expect(result.status).toBe('ok');
      expect(result.data).toBeDefined();
      expect(result.attribution?.merchant.domain).toBe('vuoriclothing.com');
      expect(result.attribution?.merchant.name).toBe('Vuori');
    });

    it('should execute search for known merchant by alias', async () => {
      const result = await tool.execute({
        merchant: 'vuori',
        query: 'shorts',
      });

      expect(result.status).toBe('ok');
      expect(result.attribution?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should return merchant_not_connected for unknown merchant', async () => {
      const result = await tool.execute({
        merchant: 'unknown-store.com',
        query: 'products',
      });

      expect(result.status).toBe('merchant_not_connected');
      expect(result.message).toContain('not found');
    });

    it('should return alternatives when merchant not found', async () => {
      const result = await tool.execute({
        merchant: 'unknown-store.com',
        query: 'activewear',
      });

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('should return capability_not_supported for merchant without search', async () => {
      const result = await tool.execute({
        merchant: 'nosearch.com',
        query: 'products',
      });

      expect(result.status).toBe('capability_not_supported');
      expect(result.message).toContain('search');
    });

    it('should include filters in search', async () => {
      await tool.execute({
        merchant: 'vuori',
        query: 'joggers',
        filters: {
          limit: 10,
          category: 'pants',
          priceMax: 100,
        },
      });

      // Verify fetch was called with filters
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.arguments.category).toBe('pants');
      expect(body.arguments.priceMax).toBe(100);
    });

    it('should handle URL-style merchant input', async () => {
      const result = await tool.execute({
        merchant: 'https://vuoriclothing.com/products',
        query: 'joggers',
      });

      expect(result.status).toBe('ok');
      expect(result.attribution?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should include tier in attribution', async () => {
      const result = await tool.execute({
        merchant: 'vuori',
        query: 'joggers',
      });

      expect(result.attribution?.merchant.tier).toBe('verified');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await tool.execute({
        merchant: 'vuori',
        query: 'joggers',
      });

      expect(result.status).toBe('merchant_unreachable');
    });

    it('should handle invalid response format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'format' }),
      });

      const result = await tool.execute({
        merchant: 'vuori',
        query: 'joggers',
      });

      // Should handle gracefully without crashing
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// DiscoverMerchantsTool Tests
// ============================================================================

describe('DiscoverMerchantsTool', () => {
  let registry: MemoryMerchantRegistry;
  let tool: DiscoverMerchantsTool;

  beforeEach(async () => {
    registry = new MemoryMerchantRegistry([vuoriMerchant, nikeMerchant]);
    tool = new DiscoverMerchantsTool(registry);
  });

  describe('execute', () => {
    it('should return merchants matching query', async () => {
      const result = await tool.execute({
        query: 'activewear',
        limit: 10,
      });

      expect(result.status).toBe('ok');
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should return merchants with relevance scores', async () => {
      const result = await tool.execute({
        query: 'running shoes',
        limit: 10,
      });

      expect(result.data).toBeDefined();
      result.data!.forEach((merchant) => {
        expect(merchant.relevanceScore).toBeDefined();
        expect(merchant.relevanceScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('should filter by category', async () => {
      const result = await tool.execute({
        query: 'shoes',
        limit: 10,
        category: 'footwear',
      });

      expect(result.data).toBeDefined();
      // Nike should be included (has footwear category)
      expect(result.data!.some((m) => m.domain === 'nike.com')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await tool.execute({
        query: 'clothing',
        limit: 1,
      });

      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeLessThanOrEqual(1);
    });

    it('should include merchant name and categories', async () => {
      const result = await tool.execute({
        query: 'activewear',
        limit: 10,
      });

      expect(result.data).toBeDefined();
      result.data!.forEach((merchant) => {
        expect(merchant.name).toBeDefined();
        expect(merchant.categories).toBeDefined();
        expect(Array.isArray(merchant.categories)).toBe(true);
      });
    });

    it('should include merchant tier', async () => {
      const result = await tool.execute({
        query: 'clothing',
        limit: 10,
      });

      expect(result.data).toBeDefined();
      result.data!.forEach((merchant) => {
        expect(['verified', 'registered', 'discovered']).toContain(merchant.tier);
      });
    });
  });

  describe('with custom discovery provider', () => {
    it('should use custom provider if provided', async () => {
      const customProvider: DiscoveryProvider = {
        discover: vi.fn().mockResolvedValue([
          {
            domain: 'custom.com',
            name: 'Custom Store',
            categories: ['custom'],
            tier: 'verified',
            relevanceScore: 1.0,
          },
        ]),
      };

      const customTool = new DiscoverMerchantsTool(registry, customProvider);
      const result = await customTool.execute({ query: 'test', limit: 10 });

      expect(result.data).toBeDefined();
      expect(result.data![0].domain).toBe('custom.com');
      expect(customProvider.discover).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const result = await tool.execute({
        query: '',
        limit: 10,
      });

      // Should return some merchants even with empty query
      expect(result.status).toBe('ok');
    });

    it('should handle no matches', async () => {
      const result = await tool.execute({
        query: 'xyz123nonexistent',
        limit: 10,
      });

      expect(result.status).toBe('ok');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});

// ============================================================================
// Tool Definition Tests
// ============================================================================

describe('Tool Definitions', () => {
  describe('ShopMerchantTool definition', () => {
    it('should have correct name', () => {
      expect(ShopMerchantTool.name).toBeDefined();
    });
  });

  describe('DiscoverMerchantsTool definition', () => {
    it('should have correct name', () => {
      expect(DiscoverMerchantsTool.name).toBeDefined();
    });
  });
});

