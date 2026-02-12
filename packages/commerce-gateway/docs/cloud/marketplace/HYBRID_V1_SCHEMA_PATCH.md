# Hybrid v1 Minimal Schema Patch

## Overview

**Purpose:** Fix schema drift ONLY to the extent required for Square import MVP.

**Constraint:** No background worker system - synchronous import only.

**Deferred:** SyncJob model (not needed for manual import MVP).

---

## Schema Changes

### ✅ Added: VendorPlatformAccount Model (Minimal)

**Location:** `packages/database/prisma/schema.prisma`

**Purpose:** Store Square OAuth credentials and connection state for synchronous import.

**Fields (MVP-only):**
```prisma
model VendorPlatformAccount {
  id            String   @id @default(cuid())
  vendorOrgId   String
  platform      String   @db.VarChar(50) // 'SQUARE' | 'SHOPIFY' | etc.
  merchantId    String?  @db.VarChar(255) // Platform-specific merchant ID
  domain        String?  @db.VarChar(255) // Platform domain (null for Square)
  locationId    String?  @db.VarChar(255) // Platform location ID (optional)
  accessToken   String?  @db.Text // Encrypted OAuth access token
  refreshToken  String?  @db.Text // Encrypted OAuth refresh token
  tokenExpiresAt DateTime?
  lastSyncAt    DateTime? // Last successful import timestamp
  isActive      Boolean  @default(true)
  metadata      Json? // Import status tracking (no SyncJob table needed)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  vendorOrg     Organization @relation("VendorPlatformAccounts", fields: [vendorOrgId], references: [id], onDelete: Cascade)
  listings      ProductListing[] @relation("ListingPlatformAccount")

  @@unique([vendorOrgId, platform, merchantId])
  @@index([vendorOrgId])
  @@index([platform])
  @@index([isActive])
  @@map("vendor_platform_accounts")
}
```

**Key Design Decisions:**
- ✅ **Minimal fields:** Only what's needed for Square OAuth + synchronous import
- ✅ **Metadata JSON:** Stores import status (no separate SyncJob table needed)
- ✅ **Nullable fields:** `domain`, `locationId` (not all platforms need these)
- ✅ **Relation to ProductListing:** Already exists (`vendorPlatformAccountId`)

### ✅ Updated: ProductListing Relation

**Change:** Added relation to `VendorPlatformAccount` (field already existed, just needed relation definition).

```prisma
model ProductListing {
  // ... existing fields ...
  vendorPlatformAccountId String?
  vendorPlatformAccount   VendorPlatformAccount? @relation("ListingPlatformAccount", fields: [vendorPlatformAccountId], references: [id], onDelete: SetNull)
  // ... rest of model ...
}
```

### ✅ Updated: Organization Relation

**Change:** Added `vendorPlatformAccounts` relation to Organization.

```prisma
model Organization {
  // ... existing fields ...
  vendorPlatformAccounts VendorPlatformAccount[] @relation("VendorPlatformAccounts")
  // ... rest of model ...
}
```

---

## Deferred: SyncJob Model (Hybrid v1.1)

**Status:** ❌ **NOT ADDED** (deferred to Hybrid v1.1)

**Rationale:**
- MVP uses synchronous import (no background worker needed)
- Import status stored in `VendorPlatformAccount.metadata` JSON field
- Background worker system will be implemented in Hybrid v1.1

**Metadata Structure (MVP):**
```typescript
{
  importStatus: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED',
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

**Future (Hybrid v1.1):**
- Add `SyncJob` model for background worker tracking
- Migrate import status from metadata to `SyncJob` records
- Implement worker system for async imports

---

## Migration

### SQL Migration

**File:** `packages/database/prisma/migrations/hybrid_v1_minimal_schema_patch.sql`

**Command:**
```bash
# Generate Prisma migration
npx prisma migrate dev --name hybrid_v1_vendor_platform_account

# Or apply SQL directly
mysql -u user -p database < packages/database/prisma/migrations/hybrid_v1_minimal_schema_patch.sql
```

**What it does:**
1. Creates `vendor_platform_accounts` table
2. Adds indexes for query performance
3. Creates foreign key to `organizations` table
4. No changes to `product_listings` (field already exists)

---

## Code Updates Required

### ✅ No Breaking Changes

**Existing Code:**
- `ProductListing.vendorPlatformAccountId` already exists (no migration needed)
- Code already references `prisma.vendorPlatformAccount` (will now work after migration)

**Updated Files:**
- ✅ `packages/database/prisma/schema.prisma` - Added VendorPlatformAccount model
- ✅ Schema migration SQL created
- ✅ Code already compatible (just needs migration to run)

---

## Verification

### After Migration

**Verify VendorPlatformAccount exists:**
```sql
DESCRIBE vendor_platform_accounts;
SHOW INDEXES FROM vendor_platform_accounts;
```

**Verify relations:**
```sql
-- Check foreign key exists
SELECT 
  CONSTRAINT_NAME, 
  TABLE_NAME, 
  REFERENCED_TABLE_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'your_database' 
  AND REFERENCED_TABLE_NAME = 'organizations';
```

**Test Square OAuth flow:**
1. Connect Square via OAuth
2. Verify `VendorPlatformAccount` record created
3. Run import via `POST /api/integrations/square/import`
4. Verify import status in `metadata` JSON field

---

## Summary

**✅ Added:**
- `VendorPlatformAccount` model (minimal - MVP-only fields)
- Relations to `Organization` and `ProductListing`

**❌ Deferred:**
- `SyncJob` model (not needed for synchronous import MVP)
- Background worker system (Hybrid v1.1)

**Key Achievement:** Minimal schema patch enables Square import MVP without over-engineering.

---

**Status:** ✅ Ready for Migration
**Version:** 1.0 (MVP)
**Last Updated:** 2024-01-XX

