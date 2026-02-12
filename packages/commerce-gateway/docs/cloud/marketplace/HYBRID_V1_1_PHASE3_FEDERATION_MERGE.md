# Hybrid v1.1 Phase 3 — Federation + Centralized Merge

**Status:** ✅ Complete  
**Date:** 2024-01-XX

---

## Overview

Phase 3 implements normalized offer shape and deterministic merge rules for combining federation and centralized search results.

---

## ✅ Prompt 3.1 — Normalize Offer Shape

### NormalizedOffer Interface

**Location:** `apps/scm/app/services/catalog/hybrid-search-service.ts`

**Already exists** and is used as the canonical shape for all search results.

### Normalizer Functions

**Created:** `apps/scm/app/services/catalog/offer-normalizer.ts`

**Functions:**

1. **`normalizeFederationOffer()`**
   - Converts federation product + attribution → `NormalizedOffer`
   - Handles merchant tier, trust scores, freshness
   - Sets `source: 'federated'`, `freshness: 'real-time'`

2. **`normalizeCentralizedListing()`**
   - Converts `MarketplaceSearchIndex` row → `NormalizedOffer`
   - Handles vendor info, platform context, location
   - Sets `source: 'centralized'`, `freshness: 'snapshot'`

3. **`normalizeFederationResults()`**
   - Batch normalizes multiple federation search results
   - Resolves ProductMasterIds via GTIN matching
   - Returns array of `NormalizedOffer[]`

### Trust Score Calculation

**Federation Offers:**
- VERIFIED: 0.9
- REGISTERED: 0.7
- DISCOVERED: 0.5

**Centralized Listings:**
- Base: 0.5
- +0.3 if authenticated
- +0.2 max from vendor rating (normalized to 0-0.2)

---

## ✅ Prompt 3.2 — Deterministic Merge Rules

### Merge Rules

**Location:** `apps/scm/app/services/catalog/offer-merger.ts`

**Rules:**

1. **Imported > Federation for same vendor/product**
   - Centralized offers always preferred when duplicate detected
   - Federation offers skipped if centralized version exists

2. **Federation fills gaps only**
   - Federation offers added only if no centralized duplicate
   - Merged result contains both sources (no gaps)

3. **Never duplicate vendor/product pairs**
   - Deduplication by:
     - ProductMasterId (highest priority)
     - GTIN (global identifier)
     - Platform product ID (vendor-specific)
     - Offer ID (fallback)

### Implementation

**Function:** `mergeOffers(centralized, federated, options)`

**Algorithm:**
1. Process centralized offers first (priority)
2. Add federated offers only if not duplicate
3. Additional fuzzy matching pass for edge cases
4. Return merged offers + stats

**Merge Statistics:**
```typescript
{
  centralized: number;
  federated: number;
  duplicatesRemoved: number;
  centralizedPreferred: number;
  federatedFilled: number;
}
```

### Unit Tests

**Location:** `apps/scm/app/services/catalog/__tests__/offer-merger.test.ts`

**Test Coverage:**

✅ `getOfferKey()` - Key generation for deduplication  
✅ `areOffersSameProduct()` - Product matching logic  
✅ `mergeOffers()` - Merge rules:
  - Prefers centralized over federated
  - Fills gaps with federation
  - Never duplicates vendor/product pairs
  - Handles empty inputs
  - Handles edge cases (multiple duplicates)

**Run Tests:**
```bash
cd apps/scm
npm test offer-merger.test.ts
```

---

## Integration with Hybrid Search

### Updated Hybrid Search Service

**Changes to `hybrid-search-service.ts`:**

1. ✅ Imports normalizer and merger functions
2. ✅ Uses `normalizeCentralizedListing()` for centralized results
3. ✅ Ready for `normalizeFederationResults()` when federation implemented
4. ✅ Uses `mergeOffers()` instead of legacy `mergeAndDeduplicate()`
5. ✅ Uses `resolveOffersToProductMaster()` for GTIN-based resolution

**Flow:**

```
Search Query
  ↓
Parallel Queries:
  ├── searchCentralized() → normalizeCentralizedListing() → NormalizedOffer[]
  └── queryMerchantGateways() → normalizeFederationResults() → NormalizedOffer[]
  ↓
Resolve ProductMasterIds (GTIN match)
  ↓
mergeOffers(centralized, federated, { preferCentralized: true })
  ↓
Rank & Return
```

---

## Files Created

### Core Services
- `apps/scm/app/services/catalog/offer-normalizer.ts` — Normalization functions
- `apps/scm/app/services/catalog/offer-merger.ts` — Merge logic with deterministic rules

### Tests
- `apps/scm/app/services/catalog/__tests__/offer-merger.test.ts` — Unit tests for merge rules

### Updated
- `apps/scm/app/services/catalog/hybrid-search-service.ts` — Uses normalizer and merger

---

## Verification

### Test Results

✅ All merge rules tested and passing:
- Centralized preferred over federated
- Gaps filled with federation
- No duplicates in merged results
- Edge cases handled correctly

### Integration

✅ Hybrid search service updated to use:
- Normalized offer shape
- Deterministic merge rules
- ProductMaster resolution

---

## Next Steps (Future)

1. **Implement Federation Gateway Queries:** Complete `queryMerchantGateways()` to call actual federation endpoints
2. **Add Federation Normalization:** Wire up `normalizeFederationResults()` when federation results available
3. **Performance Optimization:** Cache normalized offers to reduce computation
4. **Analytics:** Track merge statistics (duplicates removed, gaps filled)

---

## Example Usage

```typescript
// Normalize federation result
const federationOffer = normalizeFederationOffer(
  {
    id: 'prod-123',
    name: 'Product Name',
    price: { amount: 100, currency: 'USD' },
    inStock: true,
    gtin: '1234567890',
  },
  {
    merchant: {
      domain: 'example.com',
      name: 'Example Merchant',
      tier: 'VERIFIED',
    },
  }
);

// Normalize centralized listing
const centralizedOffer = normalizeCentralizedListing({
  listingId: 'listing-456',
  productMasterId: 'pm-789',
  productName: 'Product Name',
  price: 100,
  currency: 'USD',
  inStock: true,
  vendorOrgId: 'org-123',
  vendorName: 'Vendor Name',
  authenticated: true,
});

// Merge offers
const result = mergeOffers([centralizedOffer], [federationOffer]);
// Returns: { offers: [centralizedOffer], stats: { ... } }
```

---

**Status:** ✅ Phase 3 Complete — Normalized offer shape and deterministic merge rules implemented with unit tests

