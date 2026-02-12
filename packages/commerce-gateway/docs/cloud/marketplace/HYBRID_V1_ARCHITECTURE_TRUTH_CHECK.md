# Hybrid v1 Architecture Truth Check

**Date:** 2024-01-XX  
**Purpose:** Audit current Hybrid v1 codebase to confirm architecture before v1.1 hardening

---

## ✅ What is Authoritative (Source of Truth)

### 1. ProductMaster
**Status:** ✅ Canonical path established  
**Location:** `packages/database/src/services/product-import-service.ts`

**Canonical Function:** `importOrUpdateProductMaster()`

**Responsibilities:**
- Creates/updates ProductMaster records
- Enforces version snapshots (audit trail)
- Tracks source system and managedBy rules
- Creates ProductTenant linkage (vendor org → ProductMaster)
- Matching logic: GTIN, NDC, externalId (sourceSystem + sourceReference)

**Used By:**
- ✅ Square manual import (`apps/scm/app/api/integrations/square/import/route.ts`)
- ✅ ProductMasterResolver (`apps/scm/app/services/catalog/product-master-resolver.ts`)
- ✅ ProductMatcher.createProductMaster (`apps/scm/app/services/catalog/product-matcher.ts`)

### 2. Inventory Truth (SCM Operational)
**Status:** ✅ Separate from Marketplace  
**Models:** `InventoryItem`, `Inventory`, `InventoryLevel`

**Key Separation:**
- `InventoryItem` = Physical stock (operational truth for SCM)
- `ProductListing` = Marketplace offer (what vendor is selling)
- **No direct link** between `InventoryItem` and `ProductListing`
- Both can link to same `ProductMaster` (via `productMasterId`)

**Authority:** SCM inventory is authoritative for operational stock; Marketplace listings are offers.

### 3. Marketplace Search Index
**Status:** ✅ Denormalized cache  
**Model:** `MarketplaceSearchIndex`

**Purpose:**
- Fast full-text search across vendor listings
- Denormalized from `ProductListing` + `ProductMaster` + `VendorProfile`
- Updated on `ProductListing` upsert (via `updateSearchIndex()`)
- **Not authoritative** - rebuilt from authoritative sources

---

## 🔄 What is Cached (Derived Data)

### 1. MarketplaceSearchIndex
**Type:** Denormalized search cache  
**Source:** `ProductListing` + `ProductMaster` + `VendorProfile`  
**Update:** On `ProductListing` create/update  
**TTL:** None (synced immediately)  
**Freshness:** Snapshot (reflects last import time)

### 2. Federation Search Results (Optional)
**Type:** Network query cache (optional in v1)  
**Location:** `apps/scm/app/services/catalog/federation-cache.ts`  
**Storage:** Redis (preferred) or in-memory fallback  
**TTL:** 5 minutes (configurable)  
**Status:** ✅ Implemented but disabled by default

---

## ⚠️ What is Optional (Not Required)

### 1. Centralized Listings
**Status:** ✅ Optional feature  
**Activation:** Only when `VendorPlatformAccount` exists AND `isActive === true`  
**Default:** Federation is primary; centralized is opt-in

**Flow:**
- Vendor connects Square → Creates `VendorPlatformAccount`
- User clicks "Run Import" → Fetches Square products → Creates `ProductListing`
- Search enables centralized source → Queries `MarketplaceSearchIndex`
- Results merged with federation (prefer centralized when duplicate)

### 2. Federation Gateway Queries
**Status:** ⚠️ MVP Placeholder (returns empty array)  
**Location:** `apps/scm/app/services/catalog/hybrid-search-service.ts:queryMerchantGateways()`  
**Note:** Federation discovery exists (`/api/federation/discover`), but gateway queries not yet implemented

**Current Behavior:**
- `discoverMerchants()` → Returns empty array (TODO)
- `queryMerchantGateways()` → Returns empty array (TODO)
- **Federation search is NOT working end-to-end in Hybrid v1**

---

## 🔍 Architecture Flow Verification

### Square Manual Import Flow
**Status:** ✅ Verified working

**Path:**
1. `POST /api/integrations/square/import`
2. Fetch products via `SquareFetcher.fetchProductsFromAccount()`
3. For each product:
   - `ProductMatcher.matchOrCreateProduct()` →
     - Tries GTIN match
     - Tries fuzzy brand+name match
     - Creates via `createProductMaster()` →
       - Uses `ProductMasterResolver.resolveProductMaster()` →
         - Calls `importOrUpdateProductMaster()` ✅ **CANONICAL PATH**
4. `createProductListing()` → Upserts `ProductListing`
5. `updateSearchIndex()` → Upserts `MarketplaceSearchIndex`

**ProductMaster Resolution:** ✅ Uses canonical `importOrUpdateProductMaster()`

### Marketplace Search Flow
**Status:** ⚠️ Partial (centralized works, federation placeholder)

**Path:**
1. `POST /api/marketplace/search`
2. `HybridSearchService.search()`
3. Parallel queries:
   - **Centralized:** `searchCentralized()` → Queries `MarketplaceSearchIndex` ✅
   - **Federation:** `queryMerchantGateways()` → Returns empty array ⚠️
4. `mergeAndDeduplicate()` → Prefers centralized when duplicate ✅
5. `resolveOffersToProductMaster()` → GTIN-based resolution ✅
6. `rankOffers()` → Boosts imported listings ✅

**Federation:** ⚠️ Not working (returns empty array)

---

## 🚨 Logic Duplication (Must Eliminate in v1.1)

### 1. ProductMaster Creation Bypasses

**❌ Duplicate Path 1:** `/apps/scm/lib/matching/product-matcher.ts`
- **Location:** Line 256-283
- **Issue:** Creates `ProductMaster` directly via `prisma.productMaster.create()`
- **Bypasses:** `importOrUpdateProductMaster()` canonical path
- **Impact:** No version snapshots, no source tracking, no ProductTenant creation
- **Used By:** `IngestionPipeline` (`lib/ingestion-advanced/pipeline.ts`)

**❌ Duplicate Path 2:** `/apps/scm/app/api/products/route.ts`
- **Location:** Line 238-261
- **Issue:** Creates `ProductMaster` directly via `tx.productMaster.create()`
- **Bypasses:** Canonical resolver
- **Impact:** Manual product creation bypasses canonical path
- **Used By:** Manual product creation API

**❌ Duplicate Path 3:** `/apps/scm/app/app/api/products/route.ts`
- **Location:** Line 334-343
- **Issue:** Creates `ProductMaster` directly
- **Bypasses:** Canonical resolver
- **Impact:** Legacy API still bypasses canonical path

### 2. Product Matching Logic Duplication

**⚠️ Duplicate Matchers:**
- `apps/scm/app/services/catalog/product-matcher.ts` → ✅ Uses canonical resolver
- `apps/scm/lib/matching/product-matcher.ts` → ❌ Creates ProductMaster directly

**Difference:**
- Catalog matcher (`app/services/catalog/`) → ✅ Good (uses resolver)
- Ingestion matcher (`lib/matching/`) → ❌ Bad (direct create)

**Recommendation:** Consolidate to single `ProductMatcher` that always uses canonical resolver.

---

## 📊 Data Model Separation

### Marketplace vs SCM Inventory

**✅ Clear Separation Confirmed:**

```
ProductMaster (canonical)
├── ProductListing (marketplace offer)
│   ├── vendorOrgId
│   ├── price, inStock, availableQuantity
│   ├── vendorPlatformAccountId
│   └── NO link to InventoryItem
│
└── InventoryItem (SCM operational stock)
    ├── organizationId (same or different from vendorOrgId)
    ├── qtyOnHand, qtyAvailable
    ├── locationId, binId, lotId
    └── NO link to ProductListing
```

**Key Principle:** Marketplace listings are **offers** (what vendor wants to sell). SCM inventory is **operational truth** (what we physically have). They are independent.

---

## ✅ Architecture Confirmations

### 1. Federation is Primary Search Path
**Status:** ⚠️ Designed as primary, but **not implemented in v1**
- Discovery API exists (`/api/federation/discover`)
- Gateway query client exists (`packages/llm-gateway/src/federation/client/`)
- **But:** `HybridSearchService.queryMerchantGateways()` returns empty array

### 2. Centralized Listings are Optional
**Status:** ✅ Confirmed optional
- Only enabled when `VendorPlatformAccount` exists
- Defaults to federation-first
- Search merges both sources (prefers centralized when duplicate)

### 3. ProductMaster is Canonical
**Status:** ✅ Mostly canonical (see duplication issues above)
- Square import uses canonical path ✅
- Manual product creation bypasses canonical path ❌
- Ingestion pipeline bypasses canonical path ❌

### 4. Marketplace ≠ Inventory Truth
**Status:** ✅ Confirmed separate
- `ProductListing` and `InventoryItem` are independent models
- Both link to `ProductMaster` but not to each other
- Marketplace shows offers; SCM tracks operational stock

---

## 🎯 v1.1 Elimination Targets

### Priority 1: Eliminate ProductMaster Creation Bypasses

**Files to Fix:**
1. `apps/scm/lib/matching/product-matcher.ts` (line 256)
   - Replace `createProductMaster()` with `ProductMasterResolver.resolveProductMaster()`

2. `apps/scm/app/api/products/route.ts` (line 238)
   - Use `importOrUpdateProductMaster()` instead of direct create

3. `apps/scm/app/app/api/products/route.ts` (line 334)
   - Use `importOrUpdateProductMaster()` instead of direct create

### Priority 2: Consolidate Product Matchers

**Action:** Deprecate `lib/matching/product-matcher.ts`, use `app/services/catalog/product-matcher.ts` everywhere

**Impact:**
- Single matching logic
- Single canonical ProductMaster creation path
- Consistent versioning and source tracking

### Priority 3: Implement Federation Gateway Queries

**Action:** Complete `HybridSearchService.queryMerchantGateways()` and `discoverMerchants()`

**Current State:**
- Discovery service exists (`DiscoveryService`)
- Gateway client exists (`GatewayClient`)
- **Missing:** Integration into `HybridSearchService`

---

## 📋 Summary

### ✅ What Works
- Square manual import (canonical ProductMaster path)
- Centralized search (MarketplaceSearchIndex queries)
- ProductMaster canonical resolver (`importOrUpdateProductMaster`)
- Marketplace/Inventory separation (confirmed independent)
- Search merge & deduplication logic
- Ranking with imported boost

### ⚠️ What's Partial
- Federation search (discovery exists, gateway queries not implemented)
- ProductMaster creation (canonical path works, but 3 bypasses exist)

### ❌ What Must Be Fixed
1. **ProductMaster creation bypasses** (3 files bypass canonical path)
2. **Product matcher duplication** (2 matchers, one bypasses canonical path)
3. **Federation gateway queries** (returns empty array - not working)

---

## 🎯 v1.1 Hardening Priorities

### Critical (Must Fix)
1. Eliminate all ProductMaster creation bypasses → Single canonical path
2. Consolidate product matchers → Single matching logic
3. Implement federation gateway queries → Make federation search work end-to-end

### Important (Should Fix)
4. Add error handling for partial failures in import
5. Add transaction rollback for failed imports
6. Implement async job system (replace synchronous Square import)

### Nice to Have (Can Defer)
7. Add federation result caching
8. Add import retry logic
9. Add webhook support for real-time updates

---

**Status:** ✅ Architecture audit complete  
**Next:** Begin v1.1 hardening with elimination of ProductMaster creation bypasses

