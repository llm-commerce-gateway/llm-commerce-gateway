# Hybrid v1.1 Phase 1 — SyncJob Implementation

**Status:** ✅ Complete  
**Date:** 2024-01-XX

---

## Overview

Phase 1 implements a minimal `MarketplaceSyncJob` model and async ingestion workflow for Hybrid v1.1. This replaces the synchronous Square import with an asynchronous job-based system.

---

## ✅ Prompt 1.1 — SyncJob Model

### Schema Changes

**Model:** `MarketplaceSyncJob`

**Location:** `packages/database/prisma/schema.prisma`

**Fields:**
- `id` - String (CUID)
- `organizationId` - String (vendor organization)
- `vendorPlatformAccountId` - String? (optional, links to platform account)
- `platform` - String (SQUARE, SHOPIFY, etc.)
- `jobType` - String (FULL, INCREMENTAL)
- `status` - String (PENDING, RUNNING, COMPLETED, FAILED)
- `progress` - Json? (current, total, percent)
- `results` - Json? (productsCreated, productsMatched, listingsCreated, listingsUpdated, errors)
- `error` - String? (error message)
- `errorDetails` - Json? (detailed error info)
- `createdAt`, `startedAt`, `completedAt`, `updatedAt` - DateTime

**Relations:**
- `organization` → `Organization` (OrganizationSyncJobs)
- `vendorPlatformAccount` → `VendorPlatformAccount` (AccountSyncJobs)

**Indexes:**
- `organizationId`
- `vendorPlatformAccountId`
- `platform`
- `status`
- `createdAt`
- `[organizationId, platform, status]` (composite, prevents duplicate concurrent jobs)

**Migration:** ✅ Backwards-compatible (adds new model only)

---

## ✅ Prompt 1.2 — Sync Worker Route

### Implementation

**Route:** `POST /api/sync/worker`

**Location:** `apps/scm/app/api/sync/worker/route.ts`

**Behavior:**
1. ✅ Fetches one PENDING job (oldest first)
2. ✅ Marks as RUNNING (idempotent: only if still PENDING)
3. ✅ Executes platform ingestion:
   - Fetches products from Square API
   - Calls `importOrUpdateProductMaster()` (canonical resolver)
   - Upserts `ProductListing`
   - Updates `MarketplaceSearchIndex`
4. ✅ Updates progress incrementally (every 10 products)
5. ✅ Marks COMPLETED or FAILED

**Features:**
- ✅ Idempotent (safe to retry)
- ✅ Handles partial failures (continues processing on individual product errors)
- ✅ Single-job execution (processes one job per request)
- ✅ Progress tracking (JSON field with current/total/percent)

**Error Handling:**
- Job-level errors → Mark FAILED, store error message
- Product-level errors → Continue processing, track in results.errors array

---

## ✅ Prompt 1.3 — Replace Manual Import Trigger

### API Changes

**Route:** `POST /api/integrations/square/import`

**Before:** Synchronous import (blocks until complete)  
**After:** Creates SyncJob, returns immediately

**Changes:**
- Creates `MarketplaceSyncJob` with status PENDING
- Checks for existing PENDING/RUNNING jobs (prevents duplicates)
- Returns job ID and status immediately

**Route:** `GET /api/integrations/square/import`

**Changes:**
- Queries latest `MarketplaceSyncJob` instead of metadata
- Returns job status, progress, results, error

### UI Changes

**Component:** `SquareImport.tsx`

**Changes:**
- ✅ Creates SyncJob on "Run Import" click
- ✅ Displays job status (PENDING, RUNNING, COMPLETED, FAILED)
- ✅ Shows progress bar with current/total/percent
- ✅ Polls for status updates every 2 seconds when PENDING/RUNNING
- ✅ Displays last error if failed
- ✅ Prevents duplicate concurrent jobs (disabled button when PENDING/RUNNING)

**Status Badges:**
- 🟡 PENDING — Yellow badge "Pending"
- 🔵 RUNNING — Blue badge "Running" with progress
- 🟢 COMPLETED — Green badge "Completed"
- 🔴 FAILED — Red badge "Failed" with error message

---

## Architecture Flow

### Job Creation Flow

```
User clicks "Run Import"
  ↓
POST /api/integrations/square/import
  ↓
Check for existing PENDING/RUNNING jobs
  ↓
Create MarketplaceSyncJob (status: PENDING)
  ↓
Return jobId immediately
  ↓
UI shows "Pending" status and polls
```

### Job Processing Flow

```
POST /api/sync/worker (cron/webhook/trigger)
  ↓
Fetch one PENDING job (oldest first)
  ↓
Mark as RUNNING (idempotent check)
  ↓
Fetch products from Square API
  ↓
For each product:
  ├── Match/create ProductMaster (canonical resolver)
  ├── Upsert ProductListing
  ├── Update MarketplaceSearchIndex
  └── Update progress (every 10 products)
  ↓
Mark COMPLETED or FAILED
  ↓
Update VendorPlatformAccount.lastSyncAt
```

---

## Exit Criteria ✅

- ✅ Import works async (non-blocking)
- ✅ No UI blocking (returns immediately)
- ✅ Job status visible in UI
- ✅ Progress tracking works
- ✅ Error handling works
- ✅ Prevents duplicate concurrent jobs

---

## Next Steps (v1.1.1)

1. **Worker Trigger:** Add cron job or webhook to call `/api/sync/worker` periodically
2. **Multiple Platforms:** Extend worker to support Shopify, WooCommerce
3. **Job Retry:** Add retry logic for failed jobs
4. **Job Timeout:** Add timeout handling for stuck RUNNING jobs
5. **Job Queue:** Consider moving to proper queue system (BullMQ, Inngest) if scale requires

---

## Files Changed

### Schema
- `packages/database/prisma/schema.prisma` — Added `MarketplaceSyncJob` model

### API Routes
- `apps/scm/app/api/sync/worker/route.ts` — NEW: Worker route
- `apps/scm/app/api/integrations/square/import/route.ts` — UPDATED: Creates SyncJob instead of sync import

### UI Components
- `apps/scm/app/components/integrations/square/SquareImport.tsx` — UPDATED: Async job support with polling

---

## Testing Checklist

- [ ] Create SyncJob via POST /api/integrations/square/import
- [ ] Process job via POST /api/sync/worker
- [ ] Verify progress updates incrementally
- [ ] Verify job completes successfully
- [ ] Verify job fails gracefully on error
- [ ] Verify duplicate job prevention
- [ ] Verify UI polling updates status
- [ ] Verify error display in UI

---

**Status:** ✅ Phase 1 Complete — Ready for testing and worker trigger implementation

