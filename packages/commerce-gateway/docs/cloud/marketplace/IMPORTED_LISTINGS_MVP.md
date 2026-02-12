# Imported Listings MVP (Square-only, Synchronous)

## Overview

This document describes the MVP implementation for Square product imports in Hybrid v1.
**Key Design Decision:** No background worker required - synchronous import via "Run Import" button.

## Deliverables

### ✅ Prompt 2A: Canonical ProductMaster Resolver

**File:** `apps/scm/app/services/catalog/product-master-resolver.ts`

**Purpose:** Unified resolver for creating/updating ProductMaster records using the DB import engine (`importOrUpdateProductMaster`).

**Key Features:**
- ✅ Uses `importOrUpdateProductMaster` for consistent product identity
- ✅ Handles version snapshots for audit trail
- ✅ Source tracking (which platform imported it)
- ✅ ProductTenant creation (links to vendor organization)
- ✅ Consistent matching logic (GTIN, external ID)

**Usage:**
```typescript
import { resolveProductMaster, toResolverInput } from './product-master-resolver';

const result = await resolveProductMaster(
  resolverInput,
  {
    vendorOrgId: 'org-123',
    platform: 'SQUARE',
    platformProductId: 'item-456',
  },
  prisma
);
```

**Integration:**
- ✅ Updated `ProductMatcher.createProductMaster()` to use canonical resolver
- ✅ Removed direct Prisma `create()` calls in favor of resolver

---

### ✅ Prompt 2B: Square Import MVP

#### 1. Synchronous Import Endpoint

**File:** `apps/scm/app/api/integrations/square/import/route.ts`

**Endpoints:**
- `POST /api/integrations/square/import` - Run import synchronously
- `GET /api/integrations/square/import` - Check import status

**Flow:**
1. Fetch products from Square API (using `SquareFetcher`)
2. For each product:
   - Resolve/create ProductMaster via canonical resolver
   - Upsert ProductListing
   - Update MarketplaceSearchIndex
3. Store import status in `VendorPlatformAccount.metadata`

**Response:**
```typescript
{
  success: true,
  accountId: 'vpa-123',
  results: {
    total: 150,
    productsCreated: 120,
    productsMatched: 30,
    listingsCreated: 140,
    listingsUpdated: 10,
    errors: 0,
    durationMs: 45000,
  },
  message: 'Imported 150 products: 140 new, 10 updated',
}
```

**Status Storage (metadata):**
```typescript
{
  importStatus: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'NOT_STARTED',
  lastImportedAt: '2024-01-15T10:30:00Z',
  importStartedAt: '2024-01-15T10:29:15Z',
  importCompletedAt: '2024-01-15T10:30:00Z',
  importDurationMs: 45000,
  importResults: {
    total: 150,
    productsCreated: 120,
    productsMatched: 30,
    listingsCreated: 140,
    listingsUpdated: 10,
    errors: 0,
  },
  importError: null, // If failed
}
```

#### 2. Import UI Component

**File:** `apps/scm/app/components/integrations/square/SquareImport.tsx`

**Features:**
- ✅ "Run Import" button (synchronous, blocks UI during import)
- ✅ Real-time status display (NOT_STARTED, RUNNING, COMPLETED, FAILED)
- ✅ Results summary (total, new, updated, errors)
- ✅ Last import timestamp
- ✅ Active listing count
- ✅ Error handling

**Usage:**
```tsx
import { SquareImport } from '@/components/integrations/square/SquareImport';

<SquareImport
  accountId="vpa-123" // Optional
  onComplete={() => console.log('Import complete!')}
/>
```

#### 3. OAuth Callback Update

**File:** `apps/scm/app/api/integrations/square/callback/route.ts`

**Changes:**
- ✅ Removed `SyncJob.create()` call (no background worker yet)
- ✅ Stores import status in `VendorPlatformAccount.metadata`
- ✅ Sets `importStatus: 'NOT_STARTED'` after OAuth connection

**Future:** Will be replaced with SyncJob worker in vNext.

---

## Architecture Decisions

### Why Synchronous?

**Constraint:** No background worker system yet (SyncJob model exists but worker not implemented).

**Solution:** Synchronous endpoint that:
- ✅ Blocks request until import completes
- ✅ Returns results immediately
- ✅ Stores status in metadata (no separate table needed)
- ✅ Simple UI: just click "Run Import" button

**Trade-offs:**
- ⚠️ **User Experience:** UI blocks during import (2-5 minutes for large catalogs)
- ✅ **Simplicity:** No worker infrastructure needed
- ✅ **Reliability:** Immediate feedback (success/failure)
- ✅ **MVP-Suitable:** Sufficient for Hybrid v1 launch

### Why Metadata Storage?

**Constraint:** `VendorPlatformAccount` schema may change; avoid premature optimization.

**Solution:** Store import state in `metadata` JSON field:
- ✅ No schema migration required
- ✅ Flexible (can add fields without migration)
- ✅ Sufficient for MVP needs

**Future:** Will migrate to `SyncJob` model when worker system is ready.

---

## Testing

### Manual Testing Flow

1. **Connect Square:**
   ```
   GET /api/integrations/square/authorize
   → Redirects to Square OAuth
   → Callback creates VendorPlatformAccount
   → Sets importStatus: 'NOT_STARTED' in metadata
   ```

2. **Run Import:**
   ```
   POST /api/integrations/square/import
   → Fetches products from Square
   → Resolves/creates ProductMaster (via canonical resolver)
   → Creates/updates ProductListing
   → Updates MarketplaceSearchIndex
   → Returns results + stores status in metadata
   ```

3. **Check Status:**
   ```
   GET /api/integrations/square/import
   → Returns importStatus, lastImportedAt, listingCount
   ```

### Test Data

**Square Sandbox:**
- Use Square Sandbox environment for testing
- Test with small catalog (10-20 products) first
- Verify ProductMaster resolution (GTIN match)

**Verification:**
- ✅ Products appear in `MarketplaceSearchIndex`
- ✅ ProductMaster records created with correct source tracking
- ✅ ProductListing records linked to VendorPlatformAccount
- ✅ Import status stored in metadata

---

## Future Enhancements (vNext)

### Background Worker System
- Replace synchronous endpoint with worker
- Use `SyncJob` model for job tracking
- Enable async imports (no UI blocking)

### Multi-Platform Support
- Add Shopify import (same pattern)
- Add Google Merchant Center import
- Add WooCommerce import

### Incremental Sync
- Track `lastSyncAt` timestamp
- Only fetch products updated since last sync
- Reduce import time for large catalogs

### Error Handling
- Better error messages (product-level errors)
- Retry logic for failed products
- Manual review queue for mismatched products

---

## Summary

**✅ Prompt 2A Completed:**
- Canonical ProductMaster resolver using `importOrUpdateProductMaster`
- Updated ProductMatcher to use resolver

**✅ Prompt 2B Completed:**
- Synchronous Square import endpoint
- Import UI component with "Run Import" button
- Status storage in metadata (no SyncJob worker yet)
- OAuth callback updated to skip SyncJob creation

**Key Achievement:** Hybrid v1 can now import Square products without requiring a full background worker system.

---

**Status:** ✅ Ready for Testing
**Version:** 1.0 (MVP)
**Last Updated:** 2024-01-XX

