# Hybrid v1.1 Phase 6 — Guardrails & Metrics

**Status:** ✅ Complete  
**Date:** 2024-01-XX

---

## Overview

Phase 6 implements ingestion safety guardrails and marketplace metrics tracking.

---

## ✅ Prompt 6.1 — Ingestion Safety

### ProductMaster Versioning Enforcement

**Location:** `apps/scm/app/lib/guardrails/ingestion-safety.ts`

**Guardrail Functions:**

1. **`ensureProductMasterVersioned()`**
   - Wrapper around `updateProductMasterWithVersion`
   - Ensures all updates create version snapshots
   - Returns success/error status

2. **`auditProductMasterVersioning()`**
   - Audit function to detect unversioned updates
   - Checks for ProductMasters without version snapshots
   - Returns audit results

**Implementation:**

✅ **All ProductMaster updates use canonical resolver:**
- `product-master-resolver.ts` → calls `importOrUpdateProductMaster`
- `importOrUpdateProductMaster` → uses `updateProductMasterWithVersion` for updates
- `updateProductMasterWithVersion` → creates `ProductMasterVersion` snapshot

✅ **Version snapshots created for:**
- New ProductMasters (initial version)
- Updated ProductMasters (incremented version)

**Audit Check:**
```typescript
const audit = await auditProductMasterVersioning(productMasterId, prisma);
// Returns: { hasVersions, latestVersion, lastUpdatedAt }
```

### Listing Soft-Delete Enforcement

**Function:** `softDeleteMissingListings()`

**Implementation:**
- ✅ Integrated into sync worker after import
- ✅ Marks listings as `active: false` when not in current import
- ✅ Preserves history (no hard deletes)
- ✅ Updates `inStock: false` for deactivated listings

**Usage in Sync Worker:**
```typescript
const currentSkus = new Set(vendorProducts.map((p) => p.vendorSku));
const result = await softDeleteMissingListings(
  organizationId,
  account.id,
  currentSkus,
  prisma
);
// Returns: { success, listingsDeactivated }
```

**Existing Implementation:**
- ✅ `IngestionPipeline.handleDeletedProducts()` already soft-deletes
- ✅ `WebhookHandler.handleProductDelete()` soft-deletes on webhooks
- ✅ Sync worker now also soft-deletes missing listings

### Federation Mutation Guardrail

**Functions:**

1. **`isFederationOperation()`**
   - Detects if operation is from federation context
   - Checks source, sourceSystem, and metadata flags

2. **`guardAgainstFederationMutation()`**
   - Blocks federation from mutating SCM data
   - Allows federation cache entries (with metadata flag)
   - Throws error if federation tries to update ProductMaster/ProductTenant/Inventory

3. **`validateFederationListing()`**
   - Validates ProductListing is federation cache before operations
   - Checks for `cachedFromFederation` metadata flag

4. **`withFederationGuard()`**
   - Wrapper for Prisma operations with guard checks

**Rules:**

✅ **Federation CAN:**
- Create temporary ProductListing cache entries (`cachedFromFederation: true`)
- Read ProductMaster (for matching/resolution)
- Query/search operations

❌ **Federation CANNOT:**
- Update ProductMaster or ProductTenant
- Mutate inventory data
- Create permanent ProductListing entries (must have federation metadata)

**Implementation in Search Index:**
```typescript
// Guardrail in updateSearchIndex
if (metadata.cachedFromFederation === true) {
  if (!listing.vendorPlatformAccountId) {
    // Skip search index update for pure federation cache
    return;
  }
}
```

---

## ✅ Prompt 6.2 — Metrics

### Marketplace Metrics Service

**Location:** `apps/scm/app/lib/metrics/marketplace-metrics.ts`

**Metrics Tracked:**

1. **Marketplace-only orgs**
   - Counts orgs with `planTier: 'FREE'`
   - Distinguishes from CCO orgs (PRO/ENTERPRISE)

2. **Imported listing count**
   - Counts listings with `vendorPlatformAccountId` (not null)
   - Tracks per organization and aggregate

3. **Federation-only searches**
   - Tracks searches using federation source only
   - Distinguishes from hybrid and centralized-only

4. **Upgrade CTA impressions**
   - Tracks when upgrade modal/banner shown
   - Includes feature and location context

5. **Upgrade conversions**
   - Tracks when upgrade is completed
   - Records fromTier and toTier

**Storage:**
- Metrics stored in `organization.metadata.marketplaceMetrics`
- Structure:
  ```typescript
  {
    searches: { federation: number, centralized: number, hybrid: number },
    upgradeCtas: number,
    upgradeConversions: number,
    importedListings: number,
    resolvedListings: number,
  }
  ```

### API Endpoints

**`POST /api/metrics/marketplace/track`**
- Tracks marketplace metric events
- Accepts: `search`, `upgrade_cta`, `upgrade_conversion`, `listing_imported`, `listing_resolved`

**`GET /api/metrics/marketplace/aggregate`**
- Returns aggregate metrics (admin only)
- Includes marketplace-only orgs, listing counts, search breakdown, conversion rates

### Integration Points

**Search Tracking:**
- ✅ Integrated into `HybridSearchService.search()`
- ✅ Tracks source type (federation/centralized/hybrid)
- ✅ Async, non-blocking

**Upgrade CTA Tracking:**
- ✅ Integrated into `UpgradeModal` component
- ✅ Tracks on modal open
- ✅ Includes feature and location

**Upgrade Conversion Tracking:**
- ✅ New endpoint: `POST /api/upgrade/complete`
- ✅ Should be called after successful payment/subscription upgrade

**Listing Import Tracking:**
- ✅ Integrated into sync worker
- ✅ Tracks count of imported listings per job

---

## Files Created

### Guardrails
- `apps/scm/app/lib/guardrails/ingestion-safety.ts` — Ingestion safety guardrails

### Metrics
- `apps/scm/app/lib/metrics/marketplace-metrics.ts` — Marketplace metrics service
- `apps/scm/app/api/metrics/marketplace/track/route.ts` — Metrics tracking endpoint
- `apps/scm/app/api/metrics/marketplace/aggregate/route.ts` — Aggregate metrics endpoint
- `apps/scm/app/api/upgrade/complete/route.ts` — Upgrade conversion tracking

### Updated
- `apps/scm/app/api/sync/worker/route.ts` — Added soft-delete and metrics tracking
- `apps/scm/app/services/catalog/hybrid-search-service.ts` — Added search metrics tracking
- `apps/scm/app/services/catalog/product-matcher.ts` — Added federation guardrail to search index update
- `apps/scm/app/components/UpgradeModal.tsx` — Added upgrade CTA tracking
- `apps/scm/app/api/marketplace/search/route.ts` — Pass organizationId for metrics

---

## Verification

### Guardrails Verification

**ProductMaster Versioning:**
- [ ] Audit all ProductMaster update paths
- [ ] Verify all use `updateProductMasterWithVersion` or `importOrUpdateProductMaster`
- [ ] Run audit function to check for unversioned updates

**Listing Soft-Delete:**
- [ ] Verify listings are soft-deleted in sync worker
- [ ] Check that hard deletes are never used
- [ ] Verify deactivated listings preserve history

**Federation Guard:**
- [ ] Verify federation cache entries have metadata flag
- [ ] Check that federation never updates ProductMaster
- [ ] Ensure federation listings are temporary (TTL-based)

### Metrics Verification

- [ ] Search events tracked correctly
- [ ] Upgrade CTA impressions logged
- [ ] Upgrade conversions tracked on payment completion
- [ ] Listing import counts accurate
- [ ] Aggregate metrics API returns correct data

---

## Usage Examples

### Track Search

```typescript
import { trackMarketplaceSearch } from '@/lib/metrics/marketplace-metrics';

await trackMarketplaceSearch(prisma, organizationId, 'hybrid');
```

### Track Upgrade CTA

```typescript
import { trackUpgradeCta } from '@/lib/metrics/marketplace-metrics';

await trackUpgradeCta(prisma, organizationId, 'forecasting.basic', 'nav_item');
```

### Track Upgrade Conversion

```typescript
import { trackUpgradeConversion } from '@/lib/metrics/marketplace-metrics';

await trackUpgradeConversion(prisma, organizationId, 'FREE', 'PRO');
```

### Get Metrics

```typescript
const service = new MarketplaceMetricsService(prisma);
const metrics = await service.getOrganizationMetrics(organizationId);
// Returns: { isMarketplaceOnly, importedListingCount, federationSearches, ... }

const aggregate = await service.getAggregateMetrics();
// Returns: { marketplaceOnlyOrgs, ccoOrgs, upgradeConversionRate, ... }
```

---

## Next Steps (Future)

1. **Audit Dashboard:** UI to view guardrail violations and metrics
2. **Alerting:** Alert on guardrail violations
3. **Metrics Dashboard:** Admin dashboard for marketplace metrics
4. **Export:** Export metrics data for analysis

---

**Status:** ✅ Phase 6 Complete — Ingestion safety guardrails and marketplace metrics tracking implemented

