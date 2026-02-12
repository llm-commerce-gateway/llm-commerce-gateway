# Hybrid v1 Marketplace Search Specification

## Overview

This spec defines the Hybrid Marketplace search strategy that combines:
1. **Federation Discovery** (default ON): Query merchant gateways for real-time results
2. **Centralized Listings** (ON when platform connected): Search imported `ProductListing` data for fast, indexed results
3. **ProductMaster Resolution**: Canonical product identity across both sources

**Goal:** Maximize existing infrastructure while providing fast search + real-time data + infinite scalability.

---

## 1. Search Sources & Configuration

### 1.1 Search Sources

```typescript
interface SearchSourceConfig {
  // Federation (Network Results)
  federation: {
    enabled: boolean;        // Default: true (always ON)
    maxMerchants: number;    // Default: 5 (query top N merchants in parallel)
    timeoutMs: number;       // Default: 3000ms per merchant
    retries: number;         // Default: 1
  };

  // Centralized Listings (Imported)
  centralized: {
    enabled: boolean;        // Default: true (ON when vendor has platform)
    autoEnable: boolean;     // Default: true (auto-enable when VendorPlatformAccount exists)
    scope: 'my_org' | 'all'; // Default: 'my_org' (only vendors connected to this tenant)
  };
}
```

### 1.2 Source Activation Rules

| Vendor State | Federation | Centralized | Rationale |
|--------------|-----------|-------------|-----------|
| Has `VendorPlatformAccount` (Square/Shopify) | ✅ ON | ✅ ON | Fast indexed search + real-time sync |
| Has `FederatedMerchant` only (gateway URL) | ✅ ON | ❌ OFF | Real-time gateway query only |
| No platform connection | ✅ ON | ❌ OFF | Discovery + federation fallback |

**Key Rule:** Centralized listings are ONLY enabled when:
- Vendor has active `VendorPlatformAccount` (platform: Square, Shopify, etc.)
- `VendorPlatformAccount.isActive === true`
- At least one `ProductListing` exists with `active === true`

---

## 2. Hybrid Routing Rules

### 2.1 Query Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Query: "organic honey"                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Discover Merchants (Federation)                     │
│   - Call /api/federation/discover?query=organic+honey       │
│   - Returns top 5 merchants matching query                  │
│   - Includes: VERIFIED, REGISTERED, DISCOVERED tiers        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────────┐         ┌──────────────────────────┐
│ STEP 2A: Federation  │         │ STEP 2B: Centralized     │
│ Query (Parallel)     │         │ Search (MySQL FULLTEXT)  │
│                      │         │                          │
│ For each merchant:   │         │ Query MarketplaceSearch  │
│ - Execute gateway    │         │ Index WHERE:             │
│   search (timeout 3s)│         │ - searchText LIKE query  │
│ - Collect results    │         │ - active = true          │
│                      │         │ - vendorOrgId IN (...)   │
│ Max: 5 merchants     │         │   (connected vendors)    │
└──────────────────────┘         └──────────────────────────┘
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Merge & Deduplicate                                 │
│   - Resolve to ProductMaster (GTIN match)                   │
│   - Prefer centralized for same vendor/product               │
│   - Group by productMasterId                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Rank & Return                                        │
│   - Apply ML ranking (existing RankingService)               │
│   - Sort by relevance + price + distance                     │
│   - Return normalized Offer[]                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Implementation Logic

```typescript
async function hybridSearch(
  query: string,
  context: SearchContext,
  config: SearchSourceConfig
): Promise<HybridSearchResult> {
  const startTime = Date.now();
  const results: {
    centralized: NormalizedOffer[];
    federated: NormalizedOffer[];
  } = {
    centralized: [],
    federated: [],
  };

  // STEP 1: Always discover merchants (federation)
  const merchants = config.federation.enabled
    ? await discoverMerchants(query, {
        limit: config.federation.maxMerchants,
        tiers: ['VERIFIED', 'REGISTERED', 'DISCOVERED'],
      })
    : [];

  // STEP 2: Parallel queries
  const [centralizedResults, federatedResults] = await Promise.all([
    // 2A: Centralized search (if enabled)
    config.centralized.enabled
      ? searchCentralizedListings(query, {
          scope: config.centralized.scope,
          organizationId: context.organizationId,
        })
      : Promise.resolve([]),

    // 2B: Federation queries (parallel with timeout)
    config.federation.enabled && merchants.length > 0
      ? queryMerchantGateways(
          merchants,
          query,
          {
            timeout: config.federation.timeoutMs,
            retries: config.federation.retries,
          }
        )
      : Promise.resolve([]),
  ]);

  results.centralized = centralizedResults;
  results.federated = federatedResults;

  // STEP 3: Merge & deduplicate
  const merged = mergeAndDeduplicate(results, {
    preferCentralized: true, // Centralized = more accurate inventory/price
    resolveToProductMaster: true,
  });

  // STEP 4: Rank
  const ranked = await rankOffers(merged, {
    userLocation: context.userLocation,
    query,
  });

  return {
    offers: ranked,
    sources: {
      centralized: results.centralized.length,
      federated: results.federated.length,
      merchants: merchants.length,
    },
    timing: {
      totalMs: Date.now() - startTime,
    },
  };
}
```

### 2.3 Deduplication Strategy

**Rule:** When same vendor + product appears in both sources, prefer centralized.

```typescript
function mergeAndDeduplicate(
  results: { centralized: NormalizedOffer[]; federated: NormalizedOffer[] },
  options: { preferCentralized: boolean; resolveToProductMaster: boolean }
): NormalizedOffer[] {
  const seen = new Map<string, NormalizedOffer>();

  // Key: `${vendorOrgId}:${productMasterId || platformProductId}`
  function getKey(offer: NormalizedOffer): string {
    if (offer.productMasterId) {
      return `${offer.vendorOrgId}:${offer.productMasterId}`;
    }
    return `${offer.vendorOrgId}:${offer.platformProductId}`;
  }

  // Process federated first (will be overwritten by centralized if preferCentralized)
  if (!options.preferCentralized) {
    for (const offer of results.federated) {
      const key = getKey(offer);
      if (!seen.has(key)) {
        seen.set(key, offer);
      }
    }
  }

  // Process centralized (preferred when preferCentralized = true)
  for (const offer of results.centralized) {
    const key = getKey(offer);
    if (!seen.has(key) || options.preferCentralized) {
      seen.set(key, offer);
    }
  }

  // Add remaining federated offers (not in centralized)
  if (options.preferCentralized) {
    for (const offer of results.federated) {
      const key = getKey(offer);
      if (!seen.has(key)) {
        seen.set(key, offer);
      }
    }
  }

  return Array.from(seen.values());
}
```

---

## 3. Data Contract: Normalized Offer

### 3.1 Offer Schema

```typescript
interface NormalizedOffer {
  // Identity
  id: string;                    // Unique offer ID (listingId or federated offer ID)
  source: 'centralized' | 'federated'; // Which source provided this
  productMasterId?: string;      // Resolved ProductMaster ID (if GTIN match)
  
  // Product Info
  name: string;
  brand?: string;
  description?: string;
  gtin?: string;                 // For ProductMaster resolution
  category?: string;
  images?: string[];
  
  // Pricing
  price: {
    amount: number;
    currency: string;
  };
  compareAtPrice?: {
    amount: number;
    currency: string;
  };
  
  // Inventory
  inStock: boolean;
  availableQuantity?: number;
  
  // Vendor
  vendor: {
    id: string;                  // vendorOrgId
    name: string;
    domain?: string;              // From FederatedMerchant
    rating?: number;
    tier?: 'VERIFIED' | 'REGISTERED' | 'DISCOVERED';
  };
  
  // Platform Context
  platform?: string;             // 'square', 'shopify', 'federated'
  platformProductId?: string;
  platformVariantId?: string;
  
  // Location (for distance ranking)
  location?: {
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Trust & Quality Signals
  authenticated: boolean;        // Signal Tag verified
  trustScore?: number;           // ML ranking score
  freshness: 'real-time' | 'snapshot' | 'stale'; // Data freshness indicator
  
  // Metadata
  metadata?: Record<string, unknown>;
  cachedAt?: Date;               // If cached from federation
  ttl?: number;                  // Cache TTL in seconds
}
```

### 3.2 Centralized → NormalizedOffer Mapping

```typescript
function mapCentralizedListingToOffer(
  listing: MarketplaceSearchIndex,
  productMaster: ProductMaster
): NormalizedOffer {
  return {
    id: listing.listingId,
    source: 'centralized',
    productMasterId: listing.productMasterId,
    name: listing.productName,
    brand: listing.brand,
    description: listing.description || undefined,
    gtin: listing.gtin || undefined,
    category: listing.category,
    images: [], // TODO: Load from ProductListing
    
    price: {
      amount: Number(listing.price),
      currency: listing.currency,
    },
    
    inStock: listing.inStock,
    availableQuantity: null, // TODO: Load from ProductListing
    
    vendor: {
      id: listing.vendorOrgId,
      name: listing.vendorName,
      rating: listing.vendorRating ? Number(listing.vendorRating) : undefined,
    },
    
    platform: listing.platform || undefined,
    platformProductId: listing.platformProductId || undefined,
    platformVariantId: listing.platformVariantId || undefined,
    
    location: listing.locationLat && listing.locationLng
      ? {
          lat: Number(listing.locationLat),
          lng: Number(listing.locationLng),
          city: listing.city || undefined,
          state: listing.state || undefined,
          country: listing.country,
        }
      : undefined,
    
    authenticated: listing.authenticated,
    freshness: 'snapshot', // Centralized = synced snapshot
  };
}
```

### 3.3 Federated → NormalizedOffer Mapping

```typescript
function mapFederatedResultToOffer(
  result: FederatedSearchResult,
  merchant: DiscoveredMerchant
): NormalizedOffer[] {
  if (result.status !== 'ok' || !result.data?.products) {
    return [];
  }

  return result.data.products.map((product) => ({
    id: `federated:${merchant.domain}:${product.id}`,
    source: 'federated',
    productMasterId: undefined, // Resolve via GTIN match later
    name: product.name,
    brand: product.brand,
    description: product.description,
    gtin: product.gtin, // For ProductMaster resolution
    category: product.category,
    images: product.images || [],
    
    price: product.price, // Already normalized in gateway protocol
    compareAtPrice: product.compareAtPrice,
    
    inStock: product.inStock ?? true,
    availableQuantity: product.availableQuantity,
    
    vendor: {
      id: merchant.domain, // Use domain as ID until resolved
      name: merchant.name,
      domain: merchant.domain,
      tier: merchant.tier,
    },
    
    platform: 'federated',
    platformProductId: product.id,
    
    authenticated: false, // Federated offers not authenticated by default
    freshness: 'real-time', // Gateway query = real-time
    
    metadata: product.metadata,
  }));
}
```

### 3.4 ProductMaster Resolution

```typescript
async function resolveOffersToProductMaster(
  offers: NormalizedOffer[],
  prisma: PrismaClient
): Promise<NormalizedOffer[]> {
  // Extract all GTINs from offers
  const gtins = offers
    .map((o) => o.gtin)
    .filter((gtin): gtin is string => Boolean(gtin));

  if (gtins.length === 0) {
    return offers; // No GTINs to resolve
  }

  // Batch query ProductMaster by GTIN
  const masters = await prisma.productMaster.findMany({
    where: {
      gtin: { in: gtins },
    },
    select: {
      id: true,
      gtin: true,
      brandName: true,
      productName: true,
    },
  });

  // Build GTIN → ProductMaster map
  const masterMap = new Map<string, ProductMaster>();
  for (const master of masters) {
    if (master.gtin) {
      masterMap.set(master.gtin, master);
    }
  }

  // Resolve offers
  return offers.map((offer) => {
    if (offer.gtin && masterMap.has(offer.gtin)) {
      const master = masterMap.get(offer.gtin)!;
      return {
        ...offer,
        productMasterId: master.id,
        // Optionally enrich with canonical data
        brand: offer.brand || master.brandName,
        name: offer.name || master.productName,
      };
    }
    return offer;
  });
}
```

---

## 4. Optional Caching Strategy

### 4.1 Federation Snapshot Caching

**Purpose:** Cache federated offers into `MarketplaceSearchIndex` for faster subsequent searches (while preserving real-time freshness indicator).

**Activation:** Optional feature flag `ENABLE_FEDERATION_CACHE`

```typescript
interface FederationCacheConfig {
  enabled: boolean;
  ttl: number;              // Default: 300 seconds (5 minutes)
  maxEntries: number;       // Default: 1000 per merchant
  condition: 'always' | 'on_miss'; // Cache always or only on cache miss
}
```

### 4.2 Caching Logic

```typescript
async function cacheFederatedOffer(
  offer: NormalizedOffer,
  config: FederationCacheConfig,
  prisma: PrismaClient
): Promise<void> {
  if (!config.enabled || offer.source !== 'federated') {
    return;
  }

  // Only cache if ProductMaster resolved (otherwise can't create listing)
  if (!offer.productMasterId) {
    return; // Unresolved offers stay ephemeral
  }

  // Create temporary ProductListing with snapshot flag
  const listing = await prisma.productListing.upsert({
    where: {
      vendorOrgId_platform_merchantId: {
        vendorOrgId: offer.vendor.id,
        platform: 'federated',
        merchantId: offer.platformProductId || offer.id,
      },
    },
    create: {
      productMasterId: offer.productMasterId,
      vendorOrgId: offer.vendor.id,
      vendorSku: offer.platformProductId || offer.id,
      price: offer.price.amount.toString(),
      currency: offer.price.currency,
      inStock: offer.inStock,
      availableQuantity: offer.availableQuantity ?? null,
      active: true,
      authenticated: false,
      metadata: {
        ...offer.metadata,
        cachedFromFederation: true,
        cachedAt: new Date().toISOString(),
        ttl: config.ttl,
      },
    },
    update: {
      price: offer.price.amount.toString(),
      inStock: offer.inStock,
      availableQuantity: offer.availableQuantity ?? null,
      metadata: {
        ...offer.metadata,
        cachedFromFederation: true,
        cachedAt: new Date().toISOString(),
        ttl: config.ttl,
      },
    },
  });

  // Update search index
  await updateSearchIndex(prisma, listing.id);
}

// Cleanup expired cache entries (run via cron)
async function cleanupExpiredFederationCache(prisma: PrismaClient): Promise<void> {
  const expiredListings = await prisma.productListing.findMany({
    where: {
      platform: 'federated',
      metadata: {
        path: ['cachedFromFederation'],
        equals: true,
      },
    },
  });

  const now = Date.now();
  for (const listing of expiredListings) {
    const metadata = listing.metadata as any;
    const cachedAt = new Date(metadata.cachedAt).getTime();
    const ttl = metadata.ttl || 300; // 5 minutes default

    if (now - cachedAt > ttl * 1000) {
      // Mark as inactive (soft delete)
      await prisma.productListing.update({
        where: { id: listing.id },
        data: { active: false },
      });
    }
  }
}
```

---

## 5. UI Toggles & Default Behavior

### 5.1 Search Settings UI

```typescript
interface MarketplaceSearchSettings {
  // Source Toggles
  sources: {
    federation: {
      enabled: boolean;
      maxMerchants: number;      // Slider: 1-10
      timeoutMs: number;         // Slider: 1000-10000ms
    };
    centralized: {
      enabled: boolean;
      scope: 'my_org' | 'all';   // Radio button
    };
  };

  // Results Preferences
  preferences: {
    preferFreshness: 'real-time' | 'accuracy'; // Radio: Prioritize real-time vs accurate inventory
    showUnresolved: boolean;     // Checkbox: Show offers without ProductMaster match
    maxResults: number;          // Input: 10-100
  };
}
```

### 5.2 Default Configuration

```typescript
const DEFAULT_SEARCH_SETTINGS: MarketplaceSearchSettings = {
  sources: {
    federation: {
      enabled: true,              // Always ON by default
      maxMerchants: 5,
      timeoutMs: 3000,
    },
    centralized: {
      enabled: true,              // Auto-enabled when platform connected
      scope: 'my_org',            // Only vendors connected to this tenant
    },
  },
  preferences: {
    preferFreshness: 'accuracy',  // Default: Prefer accurate inventory (centralized)
    showUnresolved: true,         // Show federated offers even without ProductMaster
    maxResults: 20,
  },
};
```

### 5.3 Settings Storage

```typescript
// Store per-organization in database
model MarketplaceSearchSettings {
  id             String   @id @default(cuid())
  organizationId String   @unique
  settings       Json     // MarketplaceSearchSettings
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  @@map("marketplace_search_settings")
}
```

### 5.4 User-Facing Indicators

```typescript
interface SearchResultIndicators {
  // Source badges
  showSourceBadge: boolean;       // "Imported" vs "Live" badge
  showFreshnessIndicator: boolean; // "Updated 2 min ago" vs "Real-time"
  
  // Trust signals
  showVerificationBadge: boolean; // "✓ Verified" for authenticated listings
  showTierBadge: boolean;         // "VERIFIED", "REGISTERED" tier badges
  
  // Performance
  showResponseTime: boolean;      // "Found in 234ms"
  showResultCounts: boolean;      // "12 from imports, 8 from network"
}
```

---

## 6. API Endpoint Specification

### 6.1 Hybrid Search Endpoint

```typescript
// POST /api/marketplace/search
interface HybridSearchRequest {
  query: string;
  filters?: {
    brand?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    inStockOnly?: boolean;
    authenticatedOnly?: boolean;
  };
  userLocation?: {
    lat: number;
    lng: number;
  };
  limit?: number;                 // Default: 20
  sources?: {
    federation?: { enabled?: boolean; maxMerchants?: number };
    centralized?: { enabled?: boolean; scope?: 'my_org' | 'all' };
  };
  preferences?: {
    preferFreshness?: 'real-time' | 'accuracy';
    showUnresolved?: boolean;
  };
}

interface HybridSearchResponse {
  offers: NormalizedOffer[];
  sources: {
    centralized: number;
    federated: number;
    merchants: number;
  };
  timing: {
    totalMs: number;
    federationMs?: number;
    centralizedMs?: number;
  };
  settings: MarketplaceSearchSettings; // Active settings used
}
```

### 6.2 Implementation

```typescript
// apps/scm/app/api/marketplace/search/route.ts
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as HybridSearchRequest;
  const organizationId = session.user.organizationId;

  // Load organization-specific settings (or use defaults)
  const settings = await loadSearchSettings(organizationId) || DEFAULT_SEARCH_SETTINGS;

  // Merge request overrides with settings
  const activeConfig = mergeSettings(settings, body);

  // Execute hybrid search
  const result = await hybridSearch(body.query, {
    organizationId,
    userLocation: body.userLocation,
    filters: body.filters,
  }, activeConfig);

  return NextResponse.json(result);
}
```

---

## 7. Product Identity & Resolution

### 7.1 Resolution Rules

1. **GTIN Match** (Primary)
   - If offer has `gtin` → Query `ProductMaster` by GTIN
   - If match found → Set `offer.productMasterId`

2. **SKU/Platform ID Match** (Secondary)
   - If no GTIN → Try fuzzy match on `vendorSku` + `vendorOrgId`
   - Low confidence match → Flag for manual review

3. **Unresolved Offers** (Accepted)
   - If no ProductMaster match → Still return offer
   - Set `productMasterId: undefined`
   - UI shows "unresolved" indicator
   - Offer still purchasable via merchant link

### 7.2 Resolution Implementation

```typescript
async function resolveOfferToProductMaster(
  offer: NormalizedOffer,
  prisma: PrismaClient
): Promise<NormalizedOffer> {
  // Rule 1: GTIN match
  if (offer.gtin) {
    const master = await prisma.productMaster.findFirst({
      where: { gtin: offer.gtin },
    });
    if (master) {
      return {
        ...offer,
        productMasterId: master.id,
      };
    }
  }

  // Rule 2: Fuzzy match (if no GTIN)
  if (!offer.gtin && offer.vendor.id) {
    // Try brand + name fuzzy match
    const candidates = await prisma.productMaster.findMany({
      where: {
        brandName: { contains: offer.brand || '' },
        productName: { contains: offer.name },
      },
      take: 5,
    });

    // Score similarity
    for (const candidate of candidates) {
      const similarity = calculateNameSimilarity(
        offer.name,
        candidate.productName
      );
      if (similarity >= 0.85) {
        // High confidence match
        return {
          ...offer,
          productMasterId: candidate.id,
        };
      }
    }
  }

  // Rule 3: Unresolved (return as-is)
  return offer;
}
```

---

## 8. Implementation Checklist

### 8.1 Phase 1: Core Hybrid Search
- [ ] Create `HybridSearchService` class
- [ ] Implement `hybridSearch()` function
- [ ] Add `NormalizedOffer` type definitions
- [ ] Implement mapping functions (centralized → offer, federated → offer)
- [ ] Create `/api/marketplace/search` endpoint
- [ ] Add merge & deduplication logic
- [ ] Integrate with existing `RankingService`

### 8.2 Phase 2: ProductMaster Resolution
- [ ] Implement `resolveOffersToProductMaster()` batch function
- [ ] Add GTIN-based resolution
- [ ] Add fuzzy match fallback
- [ ] Handle unresolved offers gracefully
- [ ] Update UI to show resolution status

### 8.3 Phase 3: Settings & UI
- [ ] Create `MarketplaceSearchSettings` model (or use JSON in Organization)
- [ ] Build settings UI component
- [ ] Add source toggles (federation, centralized)
- [ ] Add preference controls (freshness, scope)
- [ ] Implement settings persistence
- [ ] Add result indicators (badges, freshness, source)

### 8.4 Phase 4: Optional Caching (vNext)
- [ ] Add `ENABLE_FEDERATION_CACHE` feature flag
- [ ] Implement `cacheFederatedOffer()` function
- [ ] Create cleanup cron job for expired cache
- [ ] Add cache metrics (hit rate, stale entries)
- [ ] Document cache TTL strategy

### 8.5 Phase 5: Testing & Optimization
- [ ] End-to-end test: Federation + Centralized merge
- [ ] Performance test: Parallel gateway queries
- [ ] Load test: Search endpoint under high traffic
- [ ] Monitor: Response times, cache hit rates, resolution rates
- [ ] Optimize: Timeout tuning, batch size, deduplication speed

---

## 9. Migration & Rollout

### 9.1 Feature Flags

```typescript
// Enable hybrid search per organization
FEATURE_HYBRID_MARKETPLACE_SEARCH: boolean = false; // Default: false (launch)

// Enable federation caching
FEATURE_FEDERATION_CACHE: boolean = false; // Default: false (vNext)
```

### 9.2 Rollout Plan

1. **Week 1:** Deploy hybrid search (flag OFF)
2. **Week 2:** Enable for 10% of orgs (beta testers)
3. **Week 3:** Enable for 50% of orgs
4. **Week 4:** Enable for 100% of orgs (GA)
5. **vNext:** Add federation caching (optional optimization)

---

## 10. Success Metrics

- **Search Response Time:** < 500ms (p95) for hybrid search
- **Result Quality:** > 80% of offers resolve to ProductMaster
- **Federation Success Rate:** > 90% of gateway queries succeed
- **User Satisfaction:** > 4.0/5.0 rating for search relevance
- **Cache Hit Rate** (if enabled): > 30% of federated offers cached

---

## Appendix: Example Search Flow

### User Query: "Nike Air Max 97"

1. **Discovery:** Finds 3 merchants (nike.com, footlocker.com, finishline.com)
2. **Centralized:** Finds 2 listings from vendors with Square/Shopify connected
3. **Federation:** Queries 3 gateways in parallel (all succeed)
4. **Merge:**
   - nike.com listing (centralized) + nike.com gateway result → Prefer centralized
   - footlocker.com gateway result → Include
   - finishline.com gateway result → Include
5. **Resolution:**
   - All 4 offers match ProductMaster via GTIN
6. **Ranking:** Sorted by price + vendor rating + distance
7. **Return:** 4 normalized offers with source attribution

---

**Status:** Ready for Implementation
**Version:** 1.0
**Last Updated:** 2024-01-XX
