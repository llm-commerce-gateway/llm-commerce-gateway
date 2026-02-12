/**
 * Product Matcher Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ProductMatcher,
  compareTwoStrings,
  normalizeBrand,
  normalizeProductName,
  calculateNameSimilarity,
  createProductListing,
  updateSearchIndex
} from '../../../src/catalog/product-matcher';
import type { VendorProductInput } from '../../../src/catalog/types';

// ============================================================================
// String Similarity Tests
// ============================================================================

describe('compareTwoStrings (Dice coefficient)', () => {
  it('should return 1 for identical strings', () => {
    expect(compareTwoStrings('hello', 'hello')).toBe(1);
    expect(compareTwoStrings('Nike Air Max 97', 'Nike Air Max 97')).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    expect(compareTwoStrings('abc', 'xyz')).toBe(0);
  });

  it('should return high similarity for similar strings', () => {
    const similarity = compareTwoStrings('Nike Air Max 97', 'Nike AirMax 97');
    expect(similarity).toBeGreaterThan(0.8);
  });

  it('should be case-insensitive', () => {
    expect(compareTwoStrings('NIKE', 'nike')).toBe(1);
  });

  it('should handle empty strings', () => {
    expect(compareTwoStrings('', '')).toBe(1);
    expect(compareTwoStrings('abc', '')).toBe(0);
  });

  it('should handle single character strings', () => {
    expect(compareTwoStrings('a', 'a')).toBe(1);
    expect(compareTwoStrings('a', 'b')).toBe(0);
  });
});

// ============================================================================
// Normalization Tests
// ============================================================================

describe('normalizeBrand', () => {
  it('should lowercase brand names', () => {
    expect(normalizeBrand('NIKE')).toBe('nike');
    expect(normalizeBrand('Adidas')).toBe('adidas');
  });

  it('should remove trademark symbols', () => {
    expect(normalizeBrand('Nike™')).toBe('nike');
    expect(normalizeBrand('Apple®')).toBe('apple');
    expect(normalizeBrand('Disney©')).toBe('disney');
  });

  it('should trim whitespace', () => {
    expect(normalizeBrand('  Nike  ')).toBe('nike');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeBrand('Under   Armour')).toBe('under armour');
  });
});

describe('normalizeProductName', () => {
  it('should lowercase product names', () => {
    expect(normalizeProductName('Air Max 97')).toBe('air max 97');
  });

  it('should remove special characters', () => {
    expect(normalizeProductName('Air-Max (97)')).toBe('airmax 97');
  });

  it('should remove articles', () => {
    expect(normalizeProductName('The Nike Air')).toBe('nike air');
    expect(normalizeProductName('A Good Shoe')).toBe('good shoe');
  });

  it('should normalize whitespace', () => {
    expect(normalizeProductName('Air   Max')).toBe('air max');
  });
});

describe('calculateNameSimilarity', () => {
  it('should return 1 for identical names', () => {
    expect(calculateNameSimilarity('Nike Air Max 97', 'Nike Air Max 97')).toBe(1);
  });

  it('should return high similarity for minor differences', () => {
    const similarity = calculateNameSimilarity(
      'Nike Air Max 97 Silver Bullet',
      'Nike AirMax 97 - Silver'
    );
    expect(similarity).toBeGreaterThan(0.7);
  });

  it('should return low similarity for different products', () => {
    const similarity = calculateNameSimilarity(
      'Nike Air Max 97',
      'Adidas Ultraboost 22'
    );
    expect(similarity).toBeLessThan(0.3);
  });
});

// ============================================================================
// ProductMatcher Tests (with mocks)
// ============================================================================

describe('ProductMatcher', () => {
  const mockPrisma = {
    productMaster: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    },
    productListing: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    vendorProfile: {
      findUnique: vi.fn()
    },
    marketplaceSearchIndex: {
      upsert: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('matchOrCreateProduct', () => {
    it('should match by exact GTIN', async () => {
      const mockMaster = {
        id: 'pm-123',
        globalSku: 'NIKE-AM97',
        gtin: '883419029844',
        brandName: 'Nike',
        productName: 'Air Max 97',
        description: null
      };

      mockPrisma.productMaster.findFirst.mockResolvedValueOnce(mockMaster);

      const matcher = new ProductMatcher({ prisma: mockPrisma as any });
      
      const result = await matcher.matchOrCreateProduct('vendor-1', {
        gtin: '883419029844',
        vendorSku: 'TEST-SKU-1',
        name: 'Nike Air Max 97',
        price: 135.00,
        inStock: true
      });

      expect(result.matchConfidence).toBe(1.0);
      expect(result.matchMethod).toBe('gtin');
      expect(result.isNewProduct).toBe(false);
      expect(result.productMaster.id).toBe('pm-123');
    });

    it('should create new product if no match found', async () => {
      const newMaster = {
        id: 'pm-new-123',
        globalSku: 'AUTO-123',
        gtin: null,
        brandName: 'Unknown Brand',
        productName: 'New Product',
        description: null
      };

      mockPrisma.productMaster.findFirst.mockResolvedValueOnce(null);
      mockPrisma.productMaster.findMany.mockResolvedValueOnce([]);
      mockPrisma.productMaster.create.mockResolvedValueOnce(newMaster);

      const matcher = new ProductMatcher({ prisma: mockPrisma as any });
      
      const result = await matcher.matchOrCreateProduct('vendor-1', {
        vendorSku: 'NEW-SKU-1',
        name: 'New Product',
        price: 50.00,
        inStock: true
      });

      expect(result.matchMethod).toBe('new');
      expect(result.isNewProduct).toBe(true);
      expect(result.matchConfidence).toBe(1.0);
    });

    it('should fuzzy match by brand and name', async () => {
      const mockMaster = {
        id: 'pm-456',
        globalSku: 'NIKE-AM97-SB',
        gtin: null,
        brandName: 'Nike',
        productName: 'Air Max 97 Silver Bullet',
        description: null
      };

      // Reset mocks
      mockPrisma.productMaster.findFirst.mockReset();
      mockPrisma.productMaster.findMany.mockReset();
      
      // No GTIN provided, so findFirst won't be called for GTIN
      mockPrisma.productMaster.findMany.mockResolvedValueOnce([mockMaster]);

      const matcher = new ProductMatcher({ prisma: mockPrisma as any });
      
      // No GTIN, so it should go straight to fuzzy matching
      const result = await matcher.matchOrCreateProduct('vendor-1', {
        brand: 'Nike',
        vendorSku: 'VENDOR-AM97',
        name: 'Air Max 97 Silver Bullet', // Exact match
        price: 140.00,
        inStock: true
      });

      expect(result.matchMethod).toBe('brand_name_fuzzy');
      expect(result.isNewProduct).toBe(false);
      expect(result.matchConfidence).toBeGreaterThan(0.85);
    });
  });
});

// ============================================================================
// Listing Creation Tests
// ============================================================================

describe('createProductListing', () => {
  const mockPrisma = {
    productListing: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    productMaster: {
      findUnique: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new listing if none exists', async () => {
    mockPrisma.productListing.findUnique.mockResolvedValueOnce(null);
    mockPrisma.productMaster.findUnique.mockResolvedValueOnce({
      productName: 'Air Max 97'
    });
    mockPrisma.productListing.create.mockResolvedValueOnce({
      id: 'listing-123'
    });

    const result = await createProductListing(
      mockPrisma as any,
      'vendor-1',
      'pm-123',
      {
        vendorSku: 'SKU-1',
        name: 'Air Max 97',
        price: 135.00,
        inStock: true
      }
    );

    expect(result.created).toBe(true);
    expect(result.id).toBe('listing-123');
    expect(mockPrisma.productListing.create).toHaveBeenCalled();
  });

  it('should update existing listing', async () => {
    mockPrisma.productListing.findUnique.mockResolvedValueOnce({
      id: 'listing-existing'
    });
    mockPrisma.productListing.update.mockResolvedValueOnce({
      id: 'listing-existing'
    });

    const result = await createProductListing(
      mockPrisma as any,
      'vendor-1',
      'pm-123',
      {
        vendorSku: 'SKU-1',
        name: 'Air Max 97',
        price: 140.00, // Updated price
        inStock: true
      }
    );

    expect(result.created).toBe(false);
    expect(result.id).toBe('listing-existing');
    expect(mockPrisma.productListing.update).toHaveBeenCalled();
  });
});

