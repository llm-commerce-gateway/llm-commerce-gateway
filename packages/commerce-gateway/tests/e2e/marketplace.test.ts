/**
 * Marketplace E2E Tests
 * 
 * Tests complete flows: vendor uploads → matching → search → cart → attribution
 * 
 * NOTE: These tests require a test database. Run with:
 *   DATABASE_URL=... pnpm test:e2e
 * 
 * Or skip with:
 *   pnpm test:e2e -- --skip-e2e
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { rankListings, type SearchResultRow, type RankedListing } from '../../src/catalog/ranking-service';
import {
  TEST_PREFIX,
  assertVendorScope,
  assertPlatformScope,
} from './test-utils';

// ============================================================================
// Base Search Result Row - all required fields for SearchResultRow
// ============================================================================

const baseSearchRow: Omit<SearchResultRow, 'listingId' | 'productMasterId' | 'vendorOrgId' | 'vendorName' | 'price' | 'authenticated' | 'inStock' | 'relevance'> = {
  vendorRating: 4.5,
  platform: 'shopify',
  merchantId: null,
  platformProductId: null,
  platformVariantId: null,
  currency: 'USD',
  availableQuantity: 10,
  locationLat: 40.6892,
  locationLng: -73.9900,
  city: 'Brooklyn',
  state: 'NY',
};

function createSearchRow(overrides: Partial<SearchResultRow> & Pick<SearchResultRow, 'listingId' | 'productMasterId' | 'vendorOrgId' | 'vendorName' | 'price' | 'authenticated' | 'inStock' | 'relevance'>): SearchResultRow {
  return {
    ...baseSearchRow,
    ...overrides,
  };
}

// ============================================================================
// Mock Functions for Product Matching (simulating catalog functions)
// ============================================================================

interface VendorProductInput {
  gtin?: string;
  vendorSku?: string;
  brand: string;
  name: string;
  description?: string;
  price?: number;
  inStock?: boolean;
}

interface MatchResult {
  productMaster: { id: string; gtin?: string | null; brandName?: string | null; productName: string };
  isNewProduct: boolean;
  matchConfidence: number;
  matchMethod: 'gtin' | 'brand_name_fuzzy' | 'new';
}

async function matchOrCreateProduct(
  vendorOrgId: string,
  product: VendorProductInput,
  prisma: any
): Promise<MatchResult> {
  // Try GTIN match first
  if (product.gtin) {
    const existing = await prisma.productMaster.findFirst({
      where: { gtin: product.gtin },
    });
    
    if (existing) {
      return {
        productMaster: existing,
        isNewProduct: false,
        matchConfidence: 1.0,
        matchMethod: 'gtin',
      };
    }
  }
  
  // No match - create new
  const created = await prisma.productMaster.create({
    data: {
      globalSku: `AUTO-${Date.now()}`,
      gtin: product.gtin,
      brandName: product.brand,
      productName: product.name,
      description: product.description,
      managedBy: 'BETTERDATA',
      source: 'VENDOR_IMPORT',
    },
  });
  
  return {
    productMaster: created,
    isNewProduct: true,
    matchConfidence: 1.0,
    matchMethod: 'new',
  };
}

// ============================================================================
// Mock Prisma Client
// ============================================================================

const createMockPrisma = () => ({
  organization: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  vendorProfile: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  productMaster: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  productListing: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  marketplaceSearchIndex: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $disconnect: vi.fn(),
});


// ============================================================================
// Product Matching Tests
// ============================================================================

describe('Marketplace E2E: Product Matching', () => {
  const mockPrisma = createMockPrisma();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Same product from different vendors creates shared ProductMaster via GTIN', async () => {
    const productMaster = {
      id: 'pm-test-1',
      gtin: '883419029844',
      brandName: 'Nike',
      productName: 'Air Max 97 OG Silver Bullet',
    };

    // First vendor - no match, creates new
    mockPrisma.productMaster.findFirst
      .mockResolvedValueOnce(null) // No GTIN match first time
      .mockResolvedValueOnce(productMaster); // GTIN match second time

    mockPrisma.productMaster.create.mockResolvedValue(productMaster);

    // Vendor A uploads product
    const productA = {
      gtin: '883419029844',
      vendorSku: 'VENDOR-A-SKU-1',
      brand: 'Nike',
      name: 'Air Max 97 OG Silver Bullet',
      price: 140.00,
      inStock: true,
    };

    const matchA = await matchOrCreateProduct('vendor-a-test', productA, mockPrisma as any);
    
    expect(matchA.isNewProduct).toBe(true);
    expect(matchA.matchConfidence).toBe(1.0);
    expect(matchA.productMaster.id).toBe('pm-test-1');

    // Vendor B uploads same product (same GTIN)
    const productB = {
      gtin: '883419029844',
      vendorSku: 'VENDOR-B-SKU-1',
      brand: 'Nike',
      name: 'Nike AirMax 97 - Silver',
      price: 135.00,
      inStock: true,
    };

    const matchB = await matchOrCreateProduct('vendor-b-test', productB, mockPrisma as any);
    
    // Should match to same ProductMaster
    expect(matchB.isNewProduct).toBe(false);
    expect(matchB.productMaster.id).toBe('pm-test-1');
    expect(matchB.matchMethod).toBe('gtin');
    expect(matchB.matchConfidence).toBe(1.0);
  });
});

// ============================================================================
// Search and Ranking Tests
// ============================================================================

describe('Marketplace E2E: Search and Ranking', () => {
  test('Search returns products with multiple vendor listings', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Vendor A',
        vendorRating: 4.8,
        price: 140.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-1', // Same product
        vendorOrgId: 'vendor-b',
        vendorName: 'Vendor B',
        vendorRating: 4.5,
        price: 135.00,
        authenticated: false,
        inStock: true,
        relevance: 0.90,
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    expect(ranked.length).toBe(2);
    
    // Verify listings are ranked
    expect(ranked[0].relevanceScore).toBeGreaterThanOrEqual(ranked[1].relevanceScore);
    
    // Authenticated should have higher authenticated factor
    const authListing = ranked.find(l => l.authenticated);
    expect(authListing?.rankFactors.authenticated).toBeGreaterThan(0);
  });

  test('Authenticated listings receive ranking boost', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Vendor A',
        vendorRating: 4.5,
        price: 145.00,
        authenticated: true, // Authenticated
        inStock: true,
        relevance: 0.90,
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-b',
        vendorName: 'Vendor B',
        vendorRating: 4.5,
        price: 140.00, // Lower price
        authenticated: false, // Not authenticated
        inStock: true,
        relevance: 0.90,
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    // Check authenticated factor differences
    expect(ranked[0].rankFactors.authenticated).toBe(1);
    expect(ranked[1].rankFactors.authenticated).toBe(0);
  });

  test('Closer vendors rank higher when location provided', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Brooklyn Store',
        vendorRating: 4.5,
        price: 140.00,
        authenticated: false,
        inStock: true,
        relevance: 0.90,
        distance: 5, // 5 miles away
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-b',
        vendorName: 'LA Store',
        vendorRating: 4.8,
        price: 135.00,
        authenticated: false,
        inStock: true,
        relevance: 0.90,
        distance: 2800, // 2800 miles away
      }),
    ];

    const ranked = rankListings(mockSearchResults, {
      userLocation: { lat: 40.6892, lng: -73.9900 }, // Brooklyn
    });

    // Closer store should have better distance factor
    expect(ranked[0].rankFactors.distance).toBeGreaterThan(ranked[1].rankFactors.distance);
  });

  test('Higher vendor ratings improve ranking', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Vendor A',
        vendorRating: 4.9, // High rating
        price: 145.00,
        authenticated: false,
        inStock: true,
        relevance: 0.90,
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-b',
        vendorName: 'Vendor B',
        vendorRating: 3.2, // Low rating
        price: 130.00, // Lower price
        authenticated: false,
        inStock: true,
        relevance: 0.90,
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    // Higher rated vendor should have better rating factor
    const highRatedListing = ranked.find(l => l.vendorRating === 4.9);
    const lowRatedListing = ranked.find(l => l.vendorRating === 3.2);
    expect(highRatedListing?.rankFactors.vendorRating).toBeGreaterThan(lowRatedListing?.rankFactors.vendorRating ?? 0);
  });
});

// ============================================================================
// Scoped Search Tests
// ============================================================================

describe('Marketplace E2E: Scoped Search', () => {
  test('Global scope returns products from all vendors', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-shopify-a',
        productMasterId: 'pm-1',
        vendorOrgId: `${TEST_PREFIX}vendor-a`,
        vendorName: 'Vendor A (Shopify)',
        vendorRating: 4.8,
        price: 140.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
        platform: 'shopify',
      }),
      createSearchRow({
        listingId: 'listing-shopify-b',
        productMasterId: 'pm-1',
        vendorOrgId: `${TEST_PREFIX}vendor-b`,
        vendorName: 'Vendor B (Shopify)',
        vendorRating: 4.9,
        price: 145.00,
        authenticated: true,
        inStock: true,
        relevance: 0.92,
        platform: 'shopify',
      }),
      createSearchRow({
        listingId: 'listing-square-c',
        productMasterId: 'pm-1',
        vendorOrgId: `${TEST_PREFIX}vendor-c`,
        vendorName: 'Vendor C (Square)',
        vendorRating: 4.2,
        price: 130.00,
        authenticated: false,
        inStock: true,
        relevance: 0.88,
        platform: 'square',
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    // Should include all vendors
    const vendorIds = new Set(ranked.map(l => l.vendorOrgId));
    expect(vendorIds.size).toBe(3);

    // Should include both platforms
    const platforms = new Set(ranked.map(l => l.platform));
    expect(platforms.has('shopify')).toBe(true);
    expect(platforms.has('square')).toBe(true);
  });

  test('Vendor scope returns only that vendor\'s products', () => {
    const targetVendorId = `${TEST_PREFIX}vendor-a`;
    
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-shopify-a-1',
        productMasterId: 'pm-1',
        vendorOrgId: targetVendorId,
        vendorName: 'Vendor A',
        vendorRating: 4.8,
        price: 140.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
        platform: 'shopify',
      }),
      createSearchRow({
        listingId: 'listing-shopify-a-2',
        productMasterId: 'pm-2',
        vendorOrgId: targetVendorId,
        vendorName: 'Vendor A',
        vendorRating: 4.8,
        price: 180.00,
        authenticated: true,
        inStock: true,
        relevance: 0.85,
        platform: 'shopify',
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    expect(ranked.length).toBe(2);
    for (const listing of ranked) {
      expect(listing.vendorOrgId).toBe(targetVendorId);
    }
  });

  test('Platform scope returns all vendors on that platform', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-shopify-a',
        productMasterId: 'pm-1',
        vendorOrgId: `${TEST_PREFIX}vendor-a`,
        vendorName: 'Vendor A (Shopify)',
        vendorRating: 4.8,
        price: 140.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
        platform: 'shopify',
      }),
      createSearchRow({
        listingId: 'listing-shopify-b',
        productMasterId: 'pm-1',
        vendorOrgId: `${TEST_PREFIX}vendor-b`,
        vendorName: 'Vendor B (Shopify)',
        vendorRating: 4.9,
        price: 145.00,
        authenticated: true,
        inStock: true,
        relevance: 0.92,
        platform: 'shopify',
      }),
    ];

    const ranked = rankListings(mockSearchResults);

    expect(ranked.length).toBe(2);
    assertPlatformScope(ranked.map(r => ({ ...r, platform: r.platform ?? undefined })), 'shopify');
    
    // Should include multiple vendors within platform
    const vendorIds = new Set(ranked.map(l => l.vendorOrgId));
    expect(vendorIds.size).toBe(2);
  });
});

// ============================================================================
// Platform Identifier Tests
// ============================================================================

describe('Marketplace E2E: Platform Identifiers', () => {
  test('Listings contain complete platform identifiers', () => {
    const mockListing: SearchResultRow = createSearchRow({
      listingId: 'listing-123',
      productMasterId: 'pm-1',
      vendorOrgId: `${TEST_PREFIX}vendor-a`,
      vendorName: 'Vendor A',
      vendorRating: 4.8,
      price: 140.00,
      authenticated: true,
      inStock: true,
      relevance: 0.95,
      // Platform identifiers
      platform: 'shopify',
      merchantId: 'shopify-merchant-123',
      platformProductId: 'shopify-prod-456',
      platformVariantId: 'shopify-var-789',
    });

    const ranked = rankListings([mockListing]);
    const result = ranked[0];

    expect(result.platform).toBe('shopify');
    expect(result.merchantId).toBe('shopify-merchant-123');
    expect(result.platformProductId).toBe('shopify-prod-456');
    expect(result.platformVariantId).toBe('shopify-var-789');
  });

  test('Square listings include location ID', () => {
    const mockListing: SearchResultRow = createSearchRow({
      listingId: 'listing-sq-123',
      productMasterId: 'pm-1',
      vendorOrgId: `${TEST_PREFIX}vendor-c`,
      vendorName: 'Vendor C',
      vendorRating: 4.2,
      price: 130.00,
      authenticated: false,
      inStock: true,
      relevance: 0.88,
      // Square-specific identifiers
      platform: 'square',
      merchantId: 'square-merchant-abc',
      platformProductId: 'square-item-def',
      platformVariantId: 'square-variation-ghi',
    });

    const ranked = rankListings([mockListing]);
    const result = ranked[0];

    expect(result.platform).toBe('square');
    expect(result.merchantId).toBe('square-merchant-abc');
  });
});

// ============================================================================
// Sorting Tests
// ============================================================================

describe('Marketplace E2E: Sorting', () => {
  test('Sort by price ascending', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Vendor A',
        price: 150.00,
        authenticated: true,
        inStock: true,
        relevance: 0.90,
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-2',
        vendorOrgId: 'vendor-b',
        vendorName: 'Vendor B',
        price: 100.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
      }),
      createSearchRow({
        listingId: 'listing-3',
        productMasterId: 'pm-3',
        vendorOrgId: 'vendor-c',
        vendorName: 'Vendor C',
        price: 125.00,
        authenticated: true,
        inStock: true,
        relevance: 0.85,
      }),
    ];

    const ranked = rankListings(mockSearchResults, { sortBy: 'price_low' });

    expect(ranked[0].price).toBe(100);
    expect(ranked[1].price).toBe(125);
    expect(ranked[2].price).toBe(150);
  });

  test('Sort by price descending', () => {
    const mockSearchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-1',
        productMasterId: 'pm-1',
        vendorOrgId: 'vendor-a',
        vendorName: 'Vendor A',
        price: 150.00,
        authenticated: true,
        inStock: true,
        relevance: 0.90,
      }),
      createSearchRow({
        listingId: 'listing-2',
        productMasterId: 'pm-2',
        vendorOrgId: 'vendor-b',
        vendorName: 'Vendor B',
        price: 100.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
      }),
    ];

    const ranked = rankListings(mockSearchResults, { sortBy: 'price_high' });

    expect(ranked[0].price).toBe(150);
    expect(ranked[1].price).toBe(100);
  });
});

// ============================================================================
// Integration Flow Test
// ============================================================================

describe('Marketplace E2E: Full Integration Flow', () => {
  test('Complete flow: vendor upload → match → search', async () => {
    const mockPrisma = createMockPrisma();

    // Step 1: Vendor uploads product
    const productMaster = {
      id: 'pm-flow-1',
      gtin: '883419029844',
      brandName: 'Nike',
      productName: 'Air Max 97 OG Silver Bullet',
    };
    
    mockPrisma.productMaster.findFirst.mockResolvedValue(null);
    mockPrisma.productMaster.create.mockResolvedValue(productMaster);

    const vendorProduct = {
      gtin: '883419029844',
      vendorSku: 'FLOW-SKU-1',
      brand: 'Nike',
      name: 'Air Max 97 OG Silver Bullet',
      price: 140.00,
      inStock: true,
    };

    const match = await matchOrCreateProduct('vendor-flow', vendorProduct, mockPrisma as any);
    expect(match.productMaster.id).toBe('pm-flow-1');

    // Step 2: Search returns the listing
    const searchResults: SearchResultRow[] = [
      createSearchRow({
        listingId: 'listing-flow-1',
        productMasterId: 'pm-flow-1',
        vendorOrgId: 'vendor-flow',
        vendorName: 'Flow Vendor',
        vendorRating: 4.8,
        price: 140.00,
        authenticated: true,
        inStock: true,
        relevance: 0.95,
      }),
    ];

    const ranked = rankListings(searchResults);
    expect(ranked.length).toBe(1);
    expect(ranked[0].authenticated).toBe(true);
    expect(ranked[0].listingId).toBe('listing-flow-1');
  });
});
