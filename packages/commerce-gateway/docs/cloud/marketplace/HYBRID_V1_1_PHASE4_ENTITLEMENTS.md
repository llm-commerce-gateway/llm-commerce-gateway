# Hybrid v1.1 Phase 4 — Entitlements & Upgrade Flow

**Status:** ✅ Complete  
**Date:** 2024-01-XX

---

## Overview

Phase 4 implements explicit capability gates for CCO features and contextual upgrade CTAs that reference user's actual data.

---

## ✅ Prompt 4.1 — Explicit Capability Gates

### Capability Definitions

**Location:** `apps/scm/app/lib/entitlements/capability-gates.ts`

**CCO Entitlements:**
- `FORECASTING` → `features.forecasting`
- `REPLENISHMENT` → `features.inventory.replenishment`
- `MULTI_LOCATION` → `features.multi_location`
- `LOT_TRACKING` → `trust.lots`
- `EXPIRY_TRACKING` → `trust.expiry`
- `AGENTS` → `features.agents`
- `PLANNING` → `features.planning`
- `ATP` → `features.atp`

### Capability Check Functions

**`checkCapability()`**
- Checks if organization has specific capability
- Returns `CapabilityCheckResult` with allowed status, reason, suggested tier

**`checkCapabilities()`**
- Batch check multiple capabilities

**`requireCapability()`**
- Throws `CapabilityNotEnabledError` if not allowed
- For server-side enforcement

**`getCapabilityForAction()`**
- Maps `resource:action` to capability requirement
- Used by navigation and API routes

### Updated Policy Engine

**Location:** `packages/database/src/policy-engine.ts`

**Added entitlement gates for:**
- Forecasting (create, read, update, delete)
- Replenishment (create, read, execute)
- Planning (create, read, update)
- Multi-location (create, manage, inventory operations)
- Lot/Expiry (create, track, recall, manage)
- Agents (create, configure, execute)
- ATP (calculate, view)

### Marketplace User Experience

**Navigation:**
- ✅ All nav items visible (including CCO features)
- ✅ Locked items show disabled state with "CCO Required" badge
- ✅ Clicking disabled item shows upgrade modal

**Action Blocking:**
- ✅ API routes check entitlements via `can()` function
- ✅ Returns 403 with missing entitlement details
- ✅ UI components check capabilities before rendering features

---

## ✅ Prompt 4.2 — Contextual Upgrade Triggers

### Contextual Upgrade Hook

**Location:** `apps/scm/app/lib/entitlements/contextual-upgrade.tsx`

**Hook:** `useContextualUpgrade()`

**Features:**
- Checks capability on mount
- Provides `UpgradeCTA` and `UpgradeBanner` components
- Supports async capability checks
- Returns `isAllowed` status

### Contextual Messages

**Personalized messages based on user data:**

1. **Forecasting:**
   - "You're currently viewing forecasting data. Upgrade to CCO to create and manage forecasts..."
   - References actual forecast count if available

2. **Multi-location:**
   - "You're managing X locations. Multi-location planning requires CCO..."
   - References actual location count

3. **Unresolved Products:**
   - "You have X unresolved products. Upgrade to CCO to resolve product identity..."
   - References actual unresolved count

4. **Stock Signal:**
   - "Stock signal data is not available. Upgrade to CCO to enable real-time inventory signals..."
   - Triggered when ATP/stock signal unavailable

5. **Allocation/ATP:**
   - "Allocation and ATP features require CCO. Upgrade to unlock multi-location allocation..."
   - Triggered when attempting allocation/ATP actions

### Feature-Specific Components

**`ForecastingUpgradeTrigger`**
- Triggered on forecasting pages
- References forecast count in message

**`UnresolvedProductsUpgradeTrigger`**
- Shows when viewing unresolved products
- Displays actual unresolved count

**`StockSignalUpgradeTrigger`**
- Shows when stock signal unavailable
- Contextual to product if provided

### Gate Components

**`ForecastingGate`**
- Wraps forecasting pages
- Checks capability before rendering
- Shows upgrade banner if blocked

**`UnresolvedProductsBanner`**
- Fetches unresolved count from API
- Shows contextual banner with count

**`StockSignalGate`**
- Shows upgrade CTA when stock signal unavailable
- Can be contextual to specific product

---

## Implementation Details

### API Endpoints

**`GET /api/entitlements/check`**
- Checks if organization has entitlement
- Used by client-side hooks
- Requires authentication

**`GET /api/marketplace/listings/unresolved`**
- Returns count of unresolved listings
- Used by `UnresolvedProductsBanner`
- Filters by organization

### Navigation Integration

**`NavigationEntitlementWrapper`**
- Wraps navigation items with entitlement checks
- Shows `DisabledNavItem` if capability not enabled
- Maps capabilities to Feature enum for upgrade modal

### Page Integration

**Forecasting Page:**
```tsx
<ForecastingGate>
  <ForecastingDashboard />
</ForecastingGate>
```

**Unresolved Products:**
```tsx
<UnresolvedProductsBanner productListingIds={listings.map(l => l.id)} />
```

**Stock Signal:**
```tsx
{stockSignalUnavailable && (
  <StockSignalGate productId={product.id} />
)}
```

---

## Files Created

### Core Services
- `apps/scm/app/lib/entitlements/capability-gates.ts` — Capability definitions and checks
- `apps/scm/app/lib/entitlements/contextual-upgrade.tsx` — Contextual upgrade hook and components
- `apps/scm/app/lib/entitlements/use-capability-check.ts` — Client-side capability check hook

### Components
- `apps/scm/app/components/entitlements/ForecastingGate.tsx` — Forecasting page gate
- `apps/scm/app/components/entitlements/UnresolvedProductsBanner.tsx` — Unresolved products banner
- `apps/scm/app/components/entitlements/StockSignalGate.tsx` — Stock signal gate
- `apps/scm/app/components/entitlements/NavigationEntitlementWrapper.tsx` — Navigation wrapper

### API Routes
- `apps/scm/app/api/entitlements/check/route.ts` — Entitlement check endpoint
- `apps/scm/app/api/marketplace/listings/unresolved/route.ts` — Unresolved listings count

### Updated
- `packages/database/src/policy-engine.ts` — Added CCO entitlement gates

---

## Usage Examples

### Check Capability (Server-Side)

```typescript
import { checkCapabilityWithDatabase } from '@/lib/entitlements/capability-gates';

const result = await checkCapabilityWithDatabase(organizationId, 'FORECASTING');

if (!result.allowed) {
  throw new Error('Forecasting not enabled');
}
```

### Check Capability (Client-Side)

```typescript
import { useCapabilityCheck } from '@/lib/entitlements/use-capability-check';

const { isAllowed, isLoading } = useCapabilityCheck({
  capability: 'FORECASTING',
  entitlementKey: 'features.forecasting',
});

if (!isAllowed) {
  return <UpgradeCTA />;
}
```

### Contextual Upgrade

```typescript
import { useContextualUpgrade } from '@/lib/entitlements/contextual-upgrade';

const { isAllowed, UpgradeBanner, UpgradeCTA } = useContextualUpgrade({
  organizationId,
  requiredFeature: Feature.FORECASTING_BASIC,
  suggestedTier: 'PRO',
  currentTier,
  currentPlanTier,
  context: {
    forecastCount: 5,
    locationCount: 3,
  },
});
```

---

## Verification

### Test Checklist

- [ ] Forecasting gate blocks access without entitlement
- [ ] Unresolved products banner shows correct count
- [ ] Stock signal gate appears when signal unavailable
- [ ] Navigation items show disabled state correctly
- [ ] Upgrade modals show contextual messages
- [ ] API routes return 403 with entitlement details
- [ ] Contextual messages reference user's actual data

---

## Next Steps (Future)

1. **Add More Triggers:** Expand to other CCO features (agents, ATP, etc.)
2. **Analytics:** Track upgrade triggers and conversion rates
3. **A/B Testing:** Test different CTA messages and placements
4. **Progressive Disclosure:** Show feature previews before upgrade

---

**Status:** ✅ Phase 4 Complete — Explicit capability gates and contextual upgrade triggers implemented

