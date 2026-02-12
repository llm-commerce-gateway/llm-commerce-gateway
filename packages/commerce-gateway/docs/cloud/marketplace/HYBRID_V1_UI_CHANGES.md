# Hybrid v1 Marketplace UI Changes

## Overview

UI updates for Hybrid v1 marketplace search, including source toggles, result badges, ranking boosts, and optional caching.

---

## 1. Source Toggle Component

**Location:** `apps/scm/app/components/marketplace/MarketplaceSearch.tsx`

**Features:**
- ✅ Network (Federation) toggle - default ON
- ✅ Imported (Centralized) toggle - default ON
- ✅ Real-time result counts per source
- ✅ Search timing display

**Implementation:**
```tsx
<div className="mb-6 flex items-center space-x-4">
  <label className="flex items-center space-x-2">
    <input
      type="checkbox"
      checked={sources.federation.enabled}
      onChange={() => toggleSource('federation')}
    />
    <span>Network</span>
  </label>
  <label className="flex items-center space-x-2">
    <input
      type="checkbox"
      checked={sources.centralized.enabled}
      onChange={() => toggleSource('centralized')}
    />
    <span>Imported</span>
  </label>
</div>
```

---

## 2. Result Labeling & Badges

### Source Badge

**Display:** "📦 Imported" or "🌐 Network" badge on each result

**Styling:**
- Imported: Blue background (`bg-blue-100 text-blue-800`)
- Network: Purple background (`bg-purple-100 text-purple-800`)

### Vendor Information

**For Network Results:**
- Merchant domain (if available)
- Trust tier badge (VERIFIED, REGISTERED, DISCOVERED)
- Vendor rating (if available)

**For Imported Results:**
- Vendor profile name
- Stock signal (In Stock / Out of Stock with quantity)
- Authentication badge (✓ Verified if authenticated)

**Implementation:**
```tsx
function SourceBadge({ source }: { source: 'centralized' | 'federated' }) {
  return (
    <span className={source === 'centralized' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-purple-100 text-purple-800'}>
      {source === 'centralized' ? '📦 Imported' : '🌐 Network'}
    </span>
  );
}
```

---

## 3. Ranking Logic

### Imported Listing Boost

**Rule:** When same vendor/product appears in both sources, boost imported listing by 1.5x.

**Implementation:**
```typescript
// In HybridSearchService.rankOffers()
const sameProduct = byProduct.get(offer.productMasterId || offer.id) || [];
const hasImported = sameProduct.some((o) => o.source === 'centralized');
const isImported = offer.source === 'centralized';

// Boost imported listings
const boost = isImported && hasImported ? 1.5 : 1.0;
trustScore = (offer.trustScore || 0) * boost;
```

### Default Ranking Factors

When no boost applies, use existing ranking logic:
1. **Trust Score** (authentication, vendor rating)
2. **Price** (lower is better)
3. **Distance** (if user location provided)

---

## 4. Optional Caching (v1)

### Cache Strategy

**When to Cache:**
- Network responses are slow (> 2 seconds)
- Same query within TTL window (5 minutes default)

**Storage Options:**
1. **Redis** (if available) - preferred for performance
2. **Database snapshot** - fallback (store in `MarketplaceSearchIndex` with `cachedFromFederation: true`)

### Cache Implementation

**Location:** `apps/scm/app/services/catalog/hybrid-search-service.ts`

```typescript
// Optional: Add caching layer
private async getCachedOrFetch(
  query: string,
  fetcher: () => Promise<NormalizedOffer[]>
): Promise<NormalizedOffer[]> {
  // Check Redis cache
  if (redisClient) {
    const cached = await redisClient.get(`marketplace:search:${query}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Fetch fresh results
  const results = await fetcher();

  // Cache for 5 minutes
  if (redisClient) {
    await redisClient.setex(
      `marketplace:search:${query}`,
      300, // 5 minutes
      JSON.stringify(results)
    );
  }

  return results;
}
```

**Note:** Caching is optional for v1. Can be added if performance issues arise.

---

## 5. Service Functions

### HybridSearchService

**File:** `apps/scm/app/services/catalog/hybrid-search-service.ts`

**Key Methods:**
- `search()` - Main entry point for hybrid search
- `searchCentralized()` - Query MarketplaceSearchIndex
- `queryMerchantGateways()` - Query federation gateways (TODO: v1.1)
- `mergeAndDeduplicate()` - Merge results, prefer imported
- `resolveOffersToProductMaster()` - GTIN-based resolution
- `rankOffers()` - Apply ranking with imported boost

### API Endpoint

**File:** `apps/scm/app/api/marketplace/search/route.ts`

**Endpoint:** `POST /api/marketplace/search`

**Request:**
```typescript
{
  query: string;
  filters?: {
    brand?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    inStockOnly?: boolean;
    authenticatedOnly?: boolean;
  };
  userLocation?: { lat: number; lng: number };
  limit?: number;
  sources?: {
    federation?: { enabled?: boolean; maxMerchants?: number };
    centralized?: { enabled?: boolean; scope?: 'my_org' | 'all' };
  };
}
```

**Response:**
```typescript
{
  success: true;
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
}
```

---

## 6. UI Component Structure

```
MarketplaceSearch
├── SearchBar (debounced input)
├── SourceToggles (Network / Imported checkboxes)
├── LoadingState (spinner)
├── ErrorState (error message)
└── Results
    └── OfferCard[] (for each offer)
        ├── SourceBadge
        ├── ProductInfo (name, brand, description)
        ├── VendorInfo (name, domain, rating, tier)
        ├── Price
        ├── StockStatus
        └── AuthenticationBadge
```

---

## 7. Testing

### Manual Testing

1. **Source Toggle:**
   - Toggle Network OFF → Only imported results
   - Toggle Imported OFF → Only network results
   - Both ON → Merged results

2. **Result Badges:**
   - Verify "📦 Imported" badge on centralized results
   - Verify "🌐 Network" badge on federated results
   - Verify vendor info displays correctly

3. **Ranking:**
   - Search for product with both imported + network results
   - Verify imported listing appears first (boosted)
   - Verify ranking by price/distance when no boost

4. **Caching (if implemented):**
   - Search same query twice
   - Verify second search is faster (cached)
   - Verify cache expires after TTL

---

## Summary

**✅ Completed:**
- Source toggle UI (Network / Imported)
- Result badges (source, vendor, stock, authentication)
- Ranking boost for imported listings
- Hybrid search service (merges federation + centralized)
- API endpoint (`/api/marketplace/search`)
- UI component (`MarketplaceSearch.tsx`)

**⏸️ Deferred (v1.1):**
- Federation gateway queries (placeholder in code)
- Redis caching (optional, can add if needed)
- Advanced ranking factors (distance, shipping options)

**Key Achievement:** UI supports hybrid search with clear source attribution and ranking preferences.

---

**Status:** ✅ Ready for Testing
**Version:** 1.0 (MVP)
**Last Updated:** 2024-01-XX

