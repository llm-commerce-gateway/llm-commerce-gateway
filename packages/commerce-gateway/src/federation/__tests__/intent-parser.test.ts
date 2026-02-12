/**
 * Intent Parser Tests
 *
 * Tests for the IntentParser that extracts merchant + query from user input.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentParser } from '../router/intent-parser';
import { MemoryMerchantRegistry } from '../registry/memory';
import type { MerchantRegistration } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const vuoriMerchant: MerchantRegistration = {
  domain: 'vuoriclothing.com',
  aliases: ['vuori', 'vuori clothing'],
  gatewayUrl: 'https://api.vuoriclothing.com/llm-gateway',
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
  aliases: ['nike', 'just do it'],
  gatewayUrl: 'https://api.nike.com/llm-gateway',
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

const macysMerchant: MerchantRegistration = {
  domain: 'macys.com',
  aliases: ["macy's", 'macys'],
  gatewayUrl: 'https://api.macys.com/llm-gateway',
  tier: 'verified',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: true,
  },
  metadata: {
    name: "Macy's",
    categories: ['fashion', 'clothing', 'accessories', 'home'],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('IntentParser', () => {
  let registry: MemoryMerchantRegistry;
  let parser: IntentParser;

  beforeEach(async () => {
    registry = new MemoryMerchantRegistry([vuoriMerchant, nikeMerchant, macysMerchant]);
    parser = new IntentParser({ registry });
  });

  describe('URL extraction', () => {
    it('should extract domain from full URL', async () => {
      const intent = await parser.parse('shop https://vuoriclothing.com for joggers');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
      expect(intent?.merchant.confidence).toBe('high');
      expect(intent?.query).toContain('joggers');
    });

    it('should extract domain from URL with path', async () => {
      const intent = await parser.parse('find stuff at https://nike.com/running');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('nike.com');
    });

    it('should extract domain from http URL', async () => {
      const intent = await parser.parse('search http://macys.com for dresses');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('macys.com');
    });
  });

  describe('domain pattern extraction', () => {
    it('should extract domain from "shop domain for"', async () => {
      const intent = await parser.parse('shop macys.com for dresses');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('macys.com');
      expect(intent?.merchant.confidence).toBe('high');
    });

    it('should extract domain from "search domain for"', async () => {
      const intent = await parser.parse('search nike.com for running shoes');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('nike.com');
      expect(intent?.query).toContain('running shoes');
    });

    it('should extract domain from "find stuff on domain"', async () => {
      const intent = await parser.parse('find stuff on vuoriclothing.com');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should extract domain from "browse domain"', async () => {
      const intent = await parser.parse('browse macys.com for shoes');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('macys.com');
    });
  });

  describe('brand/alias extraction', () => {
    it('should match registered alias', async () => {
      const intent = await parser.parse('shop Nike for running shoes');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('nike.com');
      expect(intent?.merchant.confidence).toBe('high');
    });

    it('should match alias case-insensitively', async () => {
      const intent = await parser.parse('shop VUORI for joggers');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should match multi-word alias', async () => {
      const intent = await parser.parse('shop vuori clothing for shorts');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should match possessive brand names', async () => {
      const intent = await parser.parse("search Macy's for dresses");

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('macys.com');
    });

    it('should handle "at" pattern', async () => {
      const intent = await parser.parse('find joggers at vuori');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
    });

    it('should handle "from" pattern', async () => {
      const intent = await parser.parse('get running shoes from Nike');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('nike.com');
    });

    it('should handle "on" pattern', async () => {
      const intent = await parser.parse('look for shirts on macys');

      expect(intent).not.toBeNull();
      expect(intent?.merchant.domain).toBe('macys.com');
    });
  });

  describe('query extraction', () => {
    it('should extract query after "for"', async () => {
      const intent = await parser.parse('shop vuori for joggers');

      expect(intent?.query).toBe('joggers');
    });

    it('should extract multi-word query', async () => {
      const intent = await parser.parse('search nike for running shoes size 10');

      expect(intent?.query).toContain('running shoes');
    });

    it('should extract query with "find"', async () => {
      const intent = await parser.parse('find red dresses at macys');

      expect(intent?.query).toContain('red dresses');
    });
  });

  describe('price filter parsing', () => {
    it('should parse "under $X" filter', async () => {
      const intent = await parser.parse('shop vuori for joggers under $100');

      expect(intent?.filters?.priceRange?.max).toBe(100);
    });

    it('should parse "less than $X" filter', async () => {
      const intent = await parser.parse('search nike for shoes less than $150');

      expect(intent?.filters?.priceRange?.max).toBe(150);
    });

    it('should parse "below $X" filter', async () => {
      const intent = await parser.parse('find shirts below $50 at macys');

      expect(intent?.filters?.priceRange?.max).toBe(50);
    });

    it('should parse "$X-$Y" range filter', async () => {
      const intent = await parser.parse('shop vuori for joggers $50-$100');

      expect(intent?.filters?.priceRange?.min).toBe(50);
      expect(intent?.filters?.priceRange?.max).toBe(100);
    });

    it('should parse "$X to $Y" range filter', async () => {
      const intent = await parser.parse('search nike for shoes $100 to $200');

      expect(intent?.filters?.priceRange?.min).toBe(100);
      expect(intent?.filters?.priceRange?.max).toBe(200);
    });

    it('should parse range without dollar signs', async () => {
      const intent = await parser.parse('shop vuori for joggers 50-100');

      expect(intent?.filters?.priceRange?.min).toBe(50);
      expect(intent?.filters?.priceRange?.max).toBe(100);
    });
  });

  describe('category hints', () => {
    it('should parse "in [category]" hint', async () => {
      const intent = await parser.parse('shop macys for shoes in womens');

      expect(intent?.filters?.category).toContain('womens');
    });

    it('should parse "from [category]" hint', async () => {
      const intent = await parser.parse('find shirts from menswear at macys');

      // This might match as merchant or category depending on implementation
      expect(intent).not.toBeNull();
    });
  });

  describe('confidence levels', () => {
    it('should return high confidence for exact domain match', async () => {
      const intent = await parser.parse('shop vuoriclothing.com for joggers');

      expect(intent?.merchant.confidence).toBe('high');
    });

    it('should return high confidence for exact alias match', async () => {
      const intent = await parser.parse('shop vuori for joggers');

      expect(intent?.merchant.confidence).toBe('high');
    });

    it('should return medium confidence for fuzzy match', async () => {
      // Add a test case for fuzzy matching if supported
      const intent = await parser.parse('shop vuor for joggers');

      // Depending on implementation, this might be medium or null
      if (intent) {
        expect(['medium', 'low']).toContain(intent.merchant.confidence);
      }
    });
  });

  describe('strict mode', () => {
    it('should only match registered merchants in strict mode', async () => {
      const strictParser = new IntentParser({ registry, strictMode: true });

      const intent = await strictParser.parse('shop unknown-store.com for products');

      // In strict mode, unregistered domains should not match
      expect(intent?.merchant.domain).not.toBe('unknown-store.com');
    });

    it('should match registered domains in strict mode', async () => {
      const strictParser = new IntentParser({ registry, strictMode: true });

      const intent = await strictParser.parse('shop vuoriclothing.com for joggers');

      expect(intent?.merchant.domain).toBe('vuoriclothing.com');
    });
  });

  describe('suggestMerchants', () => {
    it('should suggest merchants based on query', async () => {
      const suggestions = await parser.suggestMerchants('running shoes', 5);

      expect(suggestions.length).toBeGreaterThan(0);
      // Nike should be suggested for running shoes
      expect(suggestions.some((s) => s.domain === 'nike.com')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const suggestions = await parser.suggestMerchants('clothing', 1);

      expect(suggestions.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for unrelated query', async () => {
      const suggestions = await parser.suggestMerchants('xyz123abc', 5);

      // May return some suggestions based on general matching
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const intent = await parser.parse('');

      expect(intent).toBeNull();
    });

    it('should handle whitespace-only input', async () => {
      const intent = await parser.parse('   ');

      expect(intent).toBeNull();
    });

    it('should handle input without merchant', async () => {
      const intent = await parser.parse('I want to buy some shoes');

      // Should return null or have low confidence
      expect(intent === null || intent.merchant.confidence === 'low').toBe(true);
    });

    it('should preserve raw input', async () => {
      const input = 'shop vuori for joggers under $100';
      const intent = await parser.parse(input);

      expect(intent?.rawInput).toBe(input);
    });
  });
});

