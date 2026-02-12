/**
 * E2E Test Utilities
 * 
 * Provides helpers for setting up and cleaning up test data.
 * These are used when running tests against a real database.
 * 
 * Usage:
 *   DATABASE_URL=... pnpm test:e2e
 */

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Test Data Interfaces
// ============================================================================

export interface TestVendor {
  id: string;
  name: string;
  slug: string;
  tier: 'FREE' | 'HOSTED' | 'SCM_STARTER' | 'SCM_PRO' | 'SCM_ENTERPRISE';
  rating: number;
  location: {
    city: string;
    state: string;
    lat: number;
    lng: number;
  };
}

export interface TestPlatformAccount {
  id: string;
  vendorOrgId: string;
  platform: 'shopify' | 'square' | 'woocommerce' | 'google_merchant';
  merchantId: string;
  domain?: string;
  locationId?: string;
}

export interface TestProduct {
  gtin?: string;
  brand: string;
  name: string;
  description?: string;
}

export interface TestListing {
  id: string;
  productMasterId: string;
  vendorOrgId: string;
  vendorPlatformAccountId: string;
  platformProductId: string;
  platformVariantId?: string;
  vendorSku: string;
  price: number;
  authenticated: boolean;
  inStock: boolean;
}

export interface TestSetupResult {
  vendors: TestVendor[];
  platformAccounts: TestPlatformAccount[];
  productMasters: { id: string; gtin?: string; brandName: string; productName: string }[];
  listings: TestListing[];
}

// ============================================================================
// Test Data Fixtures
// ============================================================================

export const TEST_PREFIX = 'e2e-test-';

export const defaultTestVendors: TestVendor[] = [
  {
    id: `${TEST_PREFIX}vendor-a`,
    name: 'E2E Test Vendor A',
    slug: `${TEST_PREFIX}vendor-a`,
    tier: 'SCM_PRO',
    rating: 4.8,
    location: { city: 'Brooklyn', state: 'NY', lat: 40.6892, lng: -73.9900 },
  },
  {
    id: `${TEST_PREFIX}vendor-b`,
    name: 'E2E Test Vendor B',
    slug: `${TEST_PREFIX}vendor-b`,
    tier: 'SCM_ENTERPRISE',
    rating: 4.9,
    location: { city: 'Los Angeles', state: 'CA', lat: 34.0928, lng: -118.3287 },
  },
  {
    id: `${TEST_PREFIX}vendor-c`,
    name: 'E2E Test Vendor C',
    slug: `${TEST_PREFIX}vendor-c`,
    tier: 'HOSTED',
    rating: 4.2,
    location: { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  },
];

export const defaultTestProducts: TestProduct[] = [
  {
    gtin: '883419029844',
    brand: 'Nike',
    name: 'Air Max 97 OG Silver Bullet',
    description: 'Classic Nike running shoe with Air Max cushioning',
  },
  {
    gtin: '194501234567',
    brand: 'Adidas',
    name: 'Ultraboost 22',
    description: 'Performance running shoe with Boost technology',
  },
  {
    brand: 'New Balance',
    name: '550 White Green',
    description: 'Retro basketball sneaker',
  },
];

// ============================================================================
// Setup Functions
// ============================================================================

/**
 * Create test organizations and vendor profiles
 */
export async function createTestVendors(
  prisma: PrismaClient,
  vendors: TestVendor[] = defaultTestVendors
): Promise<void> {
  for (const vendor of vendors) {
    await prisma.organization.upsert({
      where: { id: vendor.id },
      update: {},
      create: {
        id: vendor.id,
        name: vendor.name,
        // Note: Organization doesn't have slug or type fields in current schema
        // Using code as a unique identifier instead
        code: vendor.slug,
      },
    });

    await prisma.vendorProfile.upsert({
      where: { organizationId: vendor.id },
      update: {},
      create: {
        organizationId: vendor.id,
        displayName: vendor.name,
        overallRating: vendor.rating,
        marketplaceTier: vendor.tier,
        verifiedSeller: vendor.tier !== 'HOSTED' && vendor.tier !== 'FREE',
        signalTagCertified: vendor.tier === 'SCM_ENTERPRISE',
      },
    });
  }
}

/**
 * Create test platform accounts
 */
export async function createTestPlatformAccounts(
  prisma: PrismaClient,
  vendors: TestVendor[] = defaultTestVendors
): Promise<TestPlatformAccount[]> {
  const accounts: TestPlatformAccount[] = [];

  // Vendor A - Shopify
  const accountA = {
    id: `${TEST_PREFIX}platform-shopify-a`,
    vendorOrgId: vendors[0].id,
    platform: 'shopify' as const,
    merchantId: `${TEST_PREFIX}shopify-merchant-a`,
    domain: `${TEST_PREFIX}vendor-a.myshopify.com`,
  };

  // Note: VendorPlatformAccount model doesn't exist in current schema
  // Skip creating in DB, just track the test data structure
  accounts.push(accountA);

  // Vendor B - Shopify
  const accountB = {
    id: `${TEST_PREFIX}platform-shopify-b`,
    vendorOrgId: vendors[1].id,
    platform: 'shopify' as const,
    merchantId: `${TEST_PREFIX}shopify-merchant-b`,
    domain: `${TEST_PREFIX}vendor-b.myshopify.com`,
  };

  // Note: VendorPlatformAccount model doesn't exist in current schema
  accounts.push(accountB);

  // Vendor C - Square
  const accountC = {
    id: `${TEST_PREFIX}platform-square-c`,
    vendorOrgId: vendors[2].id,
    platform: 'square' as const,
    merchantId: `${TEST_PREFIX}square-merchant-c`,
    locationId: `${TEST_PREFIX}square-location-c`,
  };

  // Note: VendorPlatformAccount model doesn't exist in current schema
  accounts.push(accountC);

  return accounts;
}

/**
 * Create test product masters
 */
export async function createTestProductMasters(
  prisma: PrismaClient,
  products: TestProduct[] = defaultTestProducts
): Promise<{ id: string; gtin?: string; brandName: string; productName: string }[]> {
  const created = [];

  for (const product of products) {
    const id = `${TEST_PREFIX}pm-${product.brand.toLowerCase()}-${Date.now()}`;
    
    const pm = await prisma.productMaster.create({
      data: {
        id,
        globalSku: `${TEST_PREFIX}${product.brand}-${Date.now()}`,
        gtin: product.gtin,
        brandName: product.brand,
        productName: product.name,
        description: product.description,
        managedBy: 'BETTERDATA',
        source: 'INTERNAL_CURATED',
      },
    });

    created.push({
      id: pm.id,
      gtin: pm.gtin ?? undefined,
      brandName: pm.brandName ?? '',
      productName: pm.productName,
    });
  }

  return created;
}

/**
 * Create test listings with search index entries
 */
export async function createTestListings(
  prisma: PrismaClient,
  productMasterId: string,
  vendors: TestVendor[],
  platformAccounts: TestPlatformAccount[]
): Promise<TestListing[]> {
  const listings: TestListing[] = [];

  const prices = [135.00, 140.00, 130.00];
  const authenticated = [true, true, false];

  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    const account = platformAccounts[i];
    const listingId = `${TEST_PREFIX}listing-${vendor.slug}-${Date.now()}`;

    const listing = await prisma.productListing.create({
      data: {
        id: listingId,
        productMasterId,
        vendorOrgId: vendor.id,
        vendorPlatformAccountId: account.id,
        platformProductId: `${TEST_PREFIX}platform-prod-${i}`,
        platformVariantId: `${TEST_PREFIX}platform-var-${i}`,
        vendorSku: `${TEST_PREFIX}sku-${vendor.slug}`,
        price: prices[i],
        currency: 'USD',
        inStock: true,
        authenticated: authenticated[i],
        active: true,
        vendorRating: vendor.rating,
        locationData: vendor.location,
        shippingOptions: [
          { method: 'Standard', cost: 5.99, estimatedDays: 5 },
          { method: 'Express', cost: 12.99, estimatedDays: 2 },
        ],
      },
    });

    listings.push({
      id: listing.id,
      productMasterId,
      vendorOrgId: vendor.id,
      vendorPlatformAccountId: account.id,
      platformProductId: listing.platformProductId!,
      platformVariantId: listing.platformVariantId ?? undefined,
      vendorSku: listing.vendorSku,
      price: parseFloat(listing.price.toString()),
      authenticated: listing.authenticated,
      inStock: listing.inStock,
    });

    // Create search index entry
    await prisma.marketplaceSearchIndex.create({
      data: {
        listingId: listing.id,
        productMasterId,
        brand: 'Nike',
        productName: 'Air Max 97 OG Silver Bullet',
        category: 'Sneakers', // Required field
        vendorOrgId: vendor.id,
        vendorName: vendor.name,
        vendorRating: vendor.rating,
        price: prices[i],
        currency: 'USD',
        authenticated: authenticated[i],
        inStock: true,
        active: true,
        platform: account.platform,
        merchantId: account.merchantId,
        locationLat: vendor.location.lat,
        locationLng: vendor.location.lng,
        city: vendor.location.city,
        state: vendor.location.state,
        country: 'US',
        searchText: `Nike Air Max 97 OG Silver Bullet ${vendor.name}`,
      },
    });
  }

  return listings;
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Clean up all test data created by E2E tests
 */
export async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  // Delete in reverse order of dependencies
  
  // Note: analyticsEvent model doesn't exist in current schema
  // Skipping analytics event cleanup

  // Cart items - filter by cart relation since CartItem doesn't have sessionId directly
  await prisma.cartItem.deleteMany({
    where: {
      OR: [
        { cart: { sessionId: { contains: TEST_PREFIX } } },
        { listing: { id: { contains: TEST_PREFIX } } },
      ],
    },
  });

  // Sessions
  await prisma.session.deleteMany({
    where: { id: { contains: TEST_PREFIX } },
  });

  // Search index
  await prisma.marketplaceSearchIndex.deleteMany({
    where: { listingId: { contains: TEST_PREFIX } },
  });

  // Listings
  await prisma.productListing.deleteMany({
    where: { id: { contains: TEST_PREFIX } },
  });

  // Note: VendorPlatformAccount model doesn't exist in current schema
  // Skipping platform account cleanup

  // Vendor profiles
  await prisma.vendorProfile.deleteMany({
    where: { organizationId: { contains: TEST_PREFIX } },
  });

  // Organizations
  await prisma.organization.deleteMany({
    where: { id: { contains: TEST_PREFIX } },
  });

  // Product masters
  await prisma.productMaster.deleteMany({
    where: { id: { contains: TEST_PREFIX } },
  });
}

// ============================================================================
// Full Setup
// ============================================================================

/**
 * Complete test environment setup
 */
export async function setupTestEnvironment(
  prisma: PrismaClient
): Promise<TestSetupResult> {
  // Clean first
  await cleanupTestData(prisma);

  // Create vendors
  await createTestVendors(prisma);

  // Create platform accounts
  const platformAccounts = await createTestPlatformAccounts(prisma);

  // Create product masters
  const productMasters = await createTestProductMasters(prisma);

  // Create listings for first product
  const listings = await createTestListings(
    prisma,
    productMasters[0].id,
    defaultTestVendors,
    platformAccounts
  );

  return {
    vendors: defaultTestVendors,
    platformAccounts,
    productMasters,
    listings,
  };
}

// ============================================================================
// Mock Factory
// ============================================================================

/**
 * Create a mock Prisma client for unit testing
 */
export function createMockPrisma() {
  const mockFn = () => ({
    mockResolvedValue: (val: any) => mockFn,
    mockResolvedValueOnce: (val: any) => mockFn,
    mockRejectedValue: (err: any) => mockFn,
    mockRejectedValueOnce: (err: any) => mockFn,
  });

  return {
    organization: {
      findFirst: mockFn(),
      findUnique: mockFn(),
      upsert: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      delete: mockFn(),
      deleteMany: mockFn(),
    },
    vendorProfile: {
      upsert: mockFn(),
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      deleteMany: mockFn(),
    },
    vendorPlatformAccount: {
      findFirst: mockFn(),
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      upsert: mockFn(),
      update: mockFn(),
      deleteMany: mockFn(),
    },
    productMaster: {
      findFirst: mockFn(),
      findMany: mockFn(),
      findUnique: mockFn(),
      create: mockFn(),
      update: mockFn(),
      deleteMany: mockFn(),
    },
    productListing: {
      findUnique: mockFn(),
      findFirst: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      update: mockFn(),
      updateMany: mockFn(),
      count: mockFn(),
      aggregate: mockFn(),
      deleteMany: mockFn(),
    },
    marketplaceSearchIndex: {
      findUnique: mockFn(),
      findFirst: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      upsert: mockFn(),
      aggregate: mockFn(),
      deleteMany: mockFn(),
    },
    cart: {
      findFirst: mockFn(),
      findUnique: mockFn(),
      create: mockFn(),
      update: mockFn(),
    },
    cartItem: {
      findFirst: mockFn(),
      findUnique: mockFn(),
      findMany: mockFn(),
      create: mockFn(),
      createMany: mockFn(),
      update: mockFn(),
      delete: mockFn(),
      deleteMany: mockFn(),
      count: mockFn(),
      aggregate: mockFn(),
    },
    session: {
      findUnique: mockFn(),
      findFirst: mockFn(),
      create: mockFn(),
      update: mockFn(),
      deleteMany: mockFn(),
    },
    analyticsEvent: {
      findMany: mockFn(),
      create: mockFn(),
      deleteMany: mockFn(),
    },
    $queryRawUnsafe: mockFn(),
    $connect: mockFn(),
    $disconnect: mockFn(),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that listings are sorted by relevance score descending
 */
export function assertSortedByRank(
  listings: { relevanceScore: number }[]
): void {
  for (let i = 0; i < listings.length - 1; i++) {
    if (listings[i].relevanceScore < listings[i + 1].relevanceScore) {
      throw new Error(
        `Listings not sorted by rank: ${listings[i].relevanceScore} < ${listings[i + 1].relevanceScore}`
      );
    }
  }
}

/**
 * Assert that all listings belong to a specific vendor
 */
export function assertVendorScope(
  listings: { vendorOrgId: string }[],
  vendorId: string
): void {
  for (const listing of listings) {
    if (listing.vendorOrgId !== vendorId) {
      throw new Error(
        `Listing from wrong vendor: ${listing.vendorOrgId} !== ${vendorId}`
      );
    }
  }
}

/**
 * Assert that all listings are from a specific platform
 */
export function assertPlatformScope(
  listings: { platform?: string }[],
  platform: string
): void {
  for (const listing of listings) {
    if (listing.platform !== platform) {
      throw new Error(
        `Listing from wrong platform: ${listing.platform} !== ${platform}`
      );
    }
  }
}

