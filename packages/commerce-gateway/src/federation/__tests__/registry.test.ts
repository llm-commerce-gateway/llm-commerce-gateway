/**
 * Federation Registry Tests
 *
 * Tests for MemoryMerchantRegistry and FileMerchantRegistry.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryMerchantRegistry } from '../registry/memory';
import { FileMerchantRegistry } from '../registry/file';
import type { MerchantRegistration } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMerchant = (domain: string, overrides?: Partial<MerchantRegistration>): MerchantRegistration => ({
  domain,
  aliases: [`${domain.split('.')[0]}`, `${domain.split('.')[0]} store`],
  gatewayUrl: `https://api.${domain}/llm-gateway`,
  tier: 'registered',
  capabilities: {
    search: true,
    cart: false,
    checkout: false,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
    categories: ['general'],
  },
  ...overrides,
});

const vuoriMerchant = createMerchant('vuoriclothing.com', {
  aliases: ['vuori', 'vuori clothing'],
  tier: 'verified',
  metadata: {
    name: 'Vuori',
    categories: ['activewear', 'athleisure', 'fitness'],
  },
});

const nikeMerchant = createMerchant('nike.com', {
  aliases: ['nike', 'just do it'],
  tier: 'verified',
  metadata: {
    name: 'Nike',
    categories: ['activewear', 'sportswear', 'footwear'],
  },
});

const techstoreMerchant = createMerchant('techstore.com', {
  aliases: ['techstore', 'tech store'],
  tier: 'registered',
  metadata: {
    name: 'TechStore',
    categories: ['electronics', 'gadgets', 'computers'],
  },
});

// ============================================================================
// MemoryMerchantRegistry Tests
// ============================================================================

describe('MemoryMerchantRegistry', () => {
  let registry: MemoryMerchantRegistry;

  beforeEach(() => {
    registry = new MemoryMerchantRegistry();
  });

  describe('register', () => {
    it('should register a new merchant', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
      expect(merchant?.metadata.name).toBe('Vuori');
    });

    it('should update existing merchant on duplicate registration', async () => {
      await registry.register(vuoriMerchant);
      await registry.register({
        ...vuoriMerchant,
        tier: 'verified',
        metadata: { ...vuoriMerchant.metadata, name: 'Vuori Updated' },
      });

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant?.metadata.name).toBe('Vuori Updated');
      expect(await registry.count()).toBe(1);
    });

    it('should build alias index correctly', async () => {
      await registry.register(vuoriMerchant);

      const byAlias = await registry.findByAlias('vuori');
      expect(byAlias).not.toBeNull();
      expect(byAlias?.domain).toBe('vuoriclothing.com');
    });

    it('should build category index correctly', async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);

      const activewearMerchants = await registry.findByCategory('activewear');
      expect(activewearMerchants).toHaveLength(2);
      expect(activewearMerchants.map((m) => m.domain)).toContain('vuoriclothing.com');
      expect(activewearMerchants.map((m) => m.domain)).toContain('nike.com');
    });
  });

  describe('unregister', () => {
    it('should remove a merchant', async () => {
      await registry.register(vuoriMerchant);
      const result = await registry.unregister('vuoriclothing.com');

      expect(result).toBe(true);
      expect(await registry.get('vuoriclothing.com')).toBeNull();
    });

    it('should return false for non-existent merchant', async () => {
      const result = await registry.unregister('nonexistent.com');
      expect(result).toBe(false);
    });

    it('should remove from alias index', async () => {
      await registry.register(vuoriMerchant);
      await registry.unregister('vuoriclothing.com');

      expect(await registry.findByAlias('vuori')).toBeNull();
    });

    it('should remove from category index', async () => {
      await registry.register(vuoriMerchant);
      await registry.unregister('vuoriclothing.com');

      const activewearMerchants = await registry.findByCategory('activewear');
      expect(activewearMerchants).toHaveLength(0);
    });
  });

  describe('get', () => {
    it('should return merchant by domain', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should return null for non-existent domain', async () => {
      const merchant = await registry.get('nonexistent.com');
      expect(merchant).toBeNull();
    });

    it('should be case-insensitive', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.get('VUORICLOTHING.COM');
      expect(merchant).not.toBeNull();
    });
  });

  describe('findByAlias', () => {
    it('should find merchant by alias', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.findByAlias('vuori');
      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should be case-insensitive', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.findByAlias('VUORI');
      expect(merchant).not.toBeNull();
    });

    it('should find by multi-word alias', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.findByAlias('vuori clothing');
      expect(merchant).not.toBeNull();
    });

    it('should return null for unknown alias', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.findByAlias('unknown');
      expect(merchant).toBeNull();
    });
  });

  describe('findByCategory', () => {
    beforeEach(async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);
      await registry.register(techstoreMerchant);
    });

    it('should return merchants in category', async () => {
      const merchants = await registry.findByCategory('activewear');

      expect(merchants).toHaveLength(2);
      const domains = merchants.map((m) => m.domain);
      expect(domains).toContain('vuoriclothing.com');
      expect(domains).toContain('nike.com');
    });

    it('should be case-insensitive', async () => {
      const merchants = await registry.findByCategory('ACTIVEWEAR');
      expect(merchants).toHaveLength(2);
    });

    it('should return empty array for unknown category', async () => {
      const merchants = await registry.findByCategory('nonexistent');
      expect(merchants).toHaveLength(0);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);
      await registry.register(techstoreMerchant);
    });

    it('should return all merchants', async () => {
      const merchants = await registry.list();
      expect(merchants).toHaveLength(3);
    });

    it('should filter by tier', async () => {
      const verified = await registry.list({ tier: 'verified' });
      expect(verified).toHaveLength(2);
      expect(verified.every((m) => m.tier === 'verified')).toBe(true);
    });

    it('should limit results', async () => {
      const merchants = await registry.list({ limit: 2 });
      expect(merchants).toHaveLength(2);
    });
  });

  describe('updateTier', () => {
    it('should update merchant tier', async () => {
      await registry.register({ ...vuoriMerchant, tier: 'registered' });
      await registry.updateTier('vuoriclothing.com', 'verified');

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant?.tier).toBe('verified');
    });

    it('should throw for non-existent merchant', async () => {
      await expect(registry.updateTier('nonexistent.com', 'verified')).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all merchants', async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);

      await registry.clear();

      expect(await registry.count()).toBe(0);
      expect(await registry.get('vuoriclothing.com')).toBeNull();
    });
  });

  describe('with initial merchants', () => {
    it('should initialize with provided merchants', async () => {
      const registry = new MemoryMerchantRegistry([vuoriMerchant, nikeMerchant]);

      expect(await registry.count()).toBe(2);
      expect(await registry.get('vuoriclothing.com')).not.toBeNull();
      expect(await registry.get('nike.com')).not.toBeNull();
    });
  });
});

// ============================================================================
// FileMerchantRegistry Tests
// ============================================================================

describe('FileMerchantRegistry', () => {
  let registry: FileMerchantRegistry;
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-gateway-test-'));
    filePath = path.join(tempDir, 'merchants.json');
    registry = new FileMerchantRegistry(filePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('file handling', () => {
    it('should create file if it does not exist', async () => {
      await registry.register(vuoriMerchant);

      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should persist data across instances', async () => {
      await registry.register(vuoriMerchant);

      // Create new instance with same file
      const registry2 = new FileMerchantRegistry(filePath);
      const merchant = await registry2.get('vuoriclothing.com');

      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should handle empty file gracefully', async () => {
      await fs.writeFile(filePath, '');

      const registry2 = new FileMerchantRegistry(filePath);
      const merchants = await registry2.list();

      expect(merchants).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      await fs.writeFile(filePath, '{ invalid json }');

      const registry2 = new FileMerchantRegistry(filePath);

      // Should not throw, should initialize empty
      const merchants = await registry2.list();
      expect(merchants).toHaveLength(0);
    });
  });

  describe('basic operations', () => {
    it('should register and retrieve merchant', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant).not.toBeNull();
      expect(merchant?.domain).toBe('vuoriclothing.com');
    });

    it('should unregister merchant', async () => {
      await registry.register(vuoriMerchant);
      await registry.unregister('vuoriclothing.com');

      const merchant = await registry.get('vuoriclothing.com');
      expect(merchant).toBeNull();
    });

    it('should find by alias', async () => {
      await registry.register(vuoriMerchant);

      const merchant = await registry.findByAlias('vuori');
      expect(merchant).not.toBeNull();
    });

    it('should find by category', async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);

      const merchants = await registry.findByCategory('activewear');
      expect(merchants).toHaveLength(2);
    });

    it('should list merchants', async () => {
      await registry.register(vuoriMerchant);
      await registry.register(nikeMerchant);

      const merchants = await registry.list();
      expect(merchants).toHaveLength(2);
    });
  });

  describe('data integrity', () => {
    it('should persist updates correctly', async () => {
      await registry.register(vuoriMerchant);
      await registry.register({
        ...vuoriMerchant,
        metadata: { ...vuoriMerchant.metadata, name: 'Vuori Updated' },
      });

      const registry2 = new FileMerchantRegistry(filePath);
      const merchant = await registry2.get('vuoriclothing.com');

      expect(merchant?.metadata.name).toBe('Vuori Updated');
    });

    it('should persist deletions correctly', async () => {
      await registry.register(vuoriMerchant);
      await registry.unregister('vuoriclothing.com');

      const registry2 = new FileMerchantRegistry(filePath);
      const merchant = await registry2.get('vuoriclothing.com');

      expect(merchant).toBeNull();
    });
  });
});

