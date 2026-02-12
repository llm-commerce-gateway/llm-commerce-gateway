/**
 * Federation Hub Integration Tests
 *
 * Tests for the main FederationHub orchestration class.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FederationHub } from '../hub';
import type { MerchantRegistration } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const vuoriMerchant: MerchantRegistration = {
  domain: 'vuoriclothing.com',
  aliases: ['vuori', 'vuori clothing'],
  gatewayUrl: 'https://api.vuoriclothing.com',
  tier: 'registered',
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
  aliases: ['nike', 'just do it'],
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
    categories: ['activewear', 'sportswear', 'footwear', 'running'],
  },
};

const mockSearchResponse = {
  success: true,
  data: {
    products: [
      {
        id: 'prod-1',
        title: 'Test Product',
        description: 'A test product',
        price: { amount: 99.99, currency: 'USD' },
        images: [],
        url: 'https://example.com/product',
        inStock: true,
      },
    ],
    total: 1,
    hasMore: false,
  },
};

// ============================================================================
// FederationHub Tests
// ============================================================================

describe('FederationHub', () => {
  let hub: FederationHub;

  beforeEach(async () => {
    hub = await FederationHub.create({
      registry: {
        type: 'memory',
        initialMerchants: [vuoriMerchant, nikeMerchant],
      },
      discovery: { type: 'tag-based' },
      fallback: {
        suggestAlternatives: true,
        maxAlternatives: 3,
      },
    });

    // Mock fetch for gateway calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockSearchResponse),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create hub with default options', async () => {
      const simpleHub = await FederationHub.create({
        registry: { type: 'memory' },
      });

      expect(simpleHub).toBeDefined();
    });

    it('should create hub with initial merchants', async () => {
      const merchants = await hub.listMerchants();
      expect(merchants).toHaveLength(2);
    });

    it('should create hub with static discovery', async () => {
      const staticHub = await FederationHub.create({
        registry: { type: 'memory' },
        discovery: { type: 'static' },
      });

      expect(staticHub).toBeDefined();
    });

    it('should create hub with file registry', async () => {
      const fileHub = await FederationHub.create({
        registry: { type: 'file', filePath: '/tmp/test-merchants.json' },
      });

      expect(fileHub).toBeDefined();
    });
  });

  describe('registerMerchant', () => {
    it('should register a new merchant', async () => {
      const newMerchant: MerchantRegistration = {
        domain: 'newstore.com',
        aliases: ['newstore'],
        gatewayUrl: 'https://api.newstore.com',
        tier: 'registered',
        capabilities: {
          search: true,
          cart: false,
          checkout: false,
          inventory: true,
          recommendations: false,
        },
        metadata: {
          name: 'New Store',
          categories: ['general'],
        },
      };

      await hub.registerMerchant(newMerchant);

      const merchant = await hub.getMerchant('newstore.com');
      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('newstore.com');
    });

    it('should update existing merchant', async () => {
      await hub.registerMerchant({
        ...vuoriMerchant,
        metadata: { ...vuoriMerchant.metadata, name: 'Vuori Updated' },
      });

      const merchant = await hub.getMerchant('vuoriclothing.com');
      expect(merchant?.metadata.name).toBe('Vuori Updated');
    });
  });

  describe('unregisterMerchant', () => {
    it('should remove a merchant', async () => {
      const result = await hub.unregisterMerchant('vuoriclothing.com');

      expect(result).toBe(true);
      expect(await hub.getMerchant('vuoriclothing.com')).toBeNull();
    });

    it('should return false for non-existent merchant', async () => {
      const result = await hub.unregisterMerchant('nonexistent.com');
      expect(result).toBe(false);
    });
  });

  describe('getMerchant', () => {
    it('should get merchant by domain', async () => {
      const merchant = await hub.getMerchant('vuoriclothing.com');

      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should return null for non-existent merchant', async () => {
      const merchant = await hub.getMerchant('nonexistent.com');
      expect(merchant).toBeNull();
    });
  });

  describe('listMerchants', () => {
    it('should list all merchants', async () => {
      const merchants = await hub.listMerchants();
      expect(merchants).toHaveLength(2);
    });

    it('should filter by tier', async () => {
      const verified = await hub.listMerchants({ tier: 'verified' });
      expect(verified).toHaveLength(1);
      expect(verified[0].domain).toBe('nike.com');
    });

    it('should limit results', async () => {
      const merchants = await hub.listMerchants({ limit: 1 });
      expect(merchants).toHaveLength(1);
    });
  });

  describe('resolveMerchant', () => {
    it('should resolve merchant from domain', async () => {
      const merchant = await hub.resolveMerchant('shop vuoriclothing.com for joggers');

      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should resolve merchant from alias', async () => {
      const merchant = await hub.resolveMerchant('shop vuori for joggers');

      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should return null for unknown merchant', async () => {
      const merchant = await hub.resolveMerchant('shop unknown for stuff');

      expect(merchant).toBeNull();
    });
  });

  describe('search', () => {
    it('should parse intent and route to merchant', async () => {
      const result = await hub.search('shop vuori for joggers');

      expect(result.status).toBe('ok');
      expect(result.attribution?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should suggest alternatives when merchant not found', async () => {
      const result = await hub.search('shop unknown-store for products');

      expect(result.status).toBe('merchant_not_connected');
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('should include search filters', async () => {
      await hub.search('shop vuori for joggers under $100');

      // Verify fetch was called with filters
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      if (fetchCall) {
        const body = JSON.parse(fetchCall[1].body);
        expect(body.arguments.priceMax).toBeDefined();
      }
    });
  });

  describe('shopMerchant', () => {
    it('should execute direct search', async () => {
      const result = await hub.shopMerchant('vuoriclothing.com', 'joggers');

      expect(result.status).toBe('ok');
      expect(result.data).toBeDefined();
    });

    it('should handle merchant by alias', async () => {
      const result = await hub.shopMerchant('vuori', 'shorts');

      expect(result.status).toBe('ok');
      expect(result.attribution?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should return error for unknown merchant', async () => {
      const result = await hub.shopMerchant('unknown.com', 'products');

      expect(result.status).toBe('merchant_not_connected');
    });

    it('should include filters', async () => {
      await hub.shopMerchant('vuori', 'joggers', {
        filters: { category: 'pants', priceMax: 100 },
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.arguments.category).toBe('pants');
    });
  });

  describe('discoverMerchants', () => {
    it('should discover merchants by query', async () => {
      const merchants = await hub.discoverMerchants('running shoes');

      expect(Array.isArray(merchants)).toBe(true);
      expect(merchants.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const merchants = await hub.discoverMerchants('shoes', { category: 'footwear' });

      expect(Array.isArray(merchants)).toBe(true);
    });

    it('should respect limit', async () => {
      const merchants = await hub.discoverMerchants('clothing', { limit: 1 });

      expect(merchants.length).toBeLessThanOrEqual(1);
    });
  });

  describe('verifyMerchant', () => {
    it('should verify merchant and update tier', async () => {
      // Mock successful verification
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            signature: 'valid-signature',
            domain: 'vuoriclothing.com',
          }),
      });

      const verified = await hub.verifyMerchant('vuoriclothing.com');

      expect(verified).toBe(true);

      // Check tier was updated
      const merchant = await hub.getMerchant('vuoriclothing.com');
      expect(merchant?.tier).toBe('verified');
    });

    it('should return false for non-existent merchant', async () => {
      const verified = await hub.verifyMerchant('nonexistent.com');
      expect(verified).toBe(false);
    });

    it('should handle verification failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const verified = await hub.verifyMerchant('vuoriclothing.com');
      expect(verified).toBe(false);
    });
  });

  describe('fallback behavior', () => {
    it('should suggest alternatives when suggestAlternatives is true', async () => {
      const result = await hub.search('shop unknown-store for activewear');

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('should limit alternatives to maxAlternatives', async () => {
      const limitedHub = await FederationHub.create({
        registry: {
          type: 'memory',
          initialMerchants: [vuoriMerchant, nikeMerchant],
        },
        fallback: {
          suggestAlternatives: true,
          maxAlternatives: 1,
        },
      });

      const result = await limitedHub.search('shop unknown for activewear');

      expect(result.alternatives!.length).toBeLessThanOrEqual(1);
    });

    it('should not suggest alternatives when disabled', async () => {
      const noFallbackHub = await FederationHub.create({
        registry: {
          type: 'memory',
          initialMerchants: [vuoriMerchant],
        },
        fallback: {
          suggestAlternatives: false,
        },
      });

      const result = await noFallbackHub.search('shop unknown for stuff');

      expect(result.alternatives).toBeUndefined();
    });
  });

  describe('getters', () => {
    it('should expose registry', () => {
      const registry = hub.getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.get).toBe('function');
    });

    it('should expose discovery provider', () => {
      const discovery = hub.getDiscovery();
      expect(discovery).toBeDefined();
      expect(typeof discovery.discoverByIntent).toBe('function');
    });

    it('should expose client', () => {
      const client = hub.getClient();
      expect(client).toBeDefined();
      expect(typeof client.executeSearch).toBe('function');
    });

    it('should expose parser', () => {
      const parser = hub.getParser();
      expect(parser).toBeDefined();
      expect(typeof parser.parse).toBe('function');
    });
  });
});

// ============================================================================
// Static Factory Tests
// ============================================================================

describe('FederationHub.create', () => {
  it('should be an async factory', async () => {
    const hub = await FederationHub.create({
      registry: { type: 'memory' },
    });

    expect(hub).toBeInstanceOf(FederationHub);
  });

  it('should accept registry instance', async () => {
    const { MemoryMerchantRegistry } = await import('../registry/memory.js');
    const registry = new MemoryMerchantRegistry();

    const hub = await FederationHub.create({
      registry,
    });

    expect(hub).toBeDefined();
  });

  it('should accept discovery provider instance', async () => {
    const { StaticDiscoveryProvider } = await import('../discovery/static.js');
    const { MemoryMerchantRegistry } = await import('../registry/memory.js');

    const registry = new MemoryMerchantRegistry();
    const discovery = new StaticDiscoveryProvider(registry);

    const hub = await FederationHub.create({
      registry,
      discovery,
    });

    expect(hub).toBeDefined();
  });
});

