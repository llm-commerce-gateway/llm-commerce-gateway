# Upgrade Flow + Entitlements (Hybrid v1)

## Overview

Updated upgrade flow messaging to reflect Hybrid v1 positioning:
- **Marketplace:** Discover + Connect (Hybrid v1)
- **CCO:** Plan + Execute + Govern + Improve

**Key Change:** All upgrade CTAs now consistently use "Upgrade to CCO" language.

---

## Messaging Framework

### Marketplace Tier (FREE)

**Tagline:** "Marketplace: Discover + Connect (Hybrid v1)"

**Description:**
- Marketplace discovery
- Connect Square/Shopify
- View shared inventory
- ASN management
- Email notifications

**Upgrade Prompt:** "Upgrade to CCO to unlock Plan + Execute + Govern + Improve"

---

### CCO Tier (PRO/ENTERPRISE)

**Tagline:** "CCO: Plan + Execute + Govern + Improve"

**Description:**
- **Plan:** Forecasting & replenishment
- **Execute:** Purchase orders, shipments, inventory management
- **Govern:** Multi-location, lot & expiry tracking, alerts
- **Improve:** Analytics, reporting, optimization

**Upgrade Prompt:** "Upgrade to Enterprise CCO for unlimited scale"

---

## Upgrade Triggers

### When "Upgrade to CCO" Appears

1. **User clicks disabled nav item:**
   - Forecasting/Replenishment features
   - Multi-location features
   - Lot/Expiry tracking features
   - Alert management features

2. **User wants forecasting/replenishment:**
   - `Feature.FORECASTING_BASIC`
   - `Feature.FORECASTING_ADVANCED`
   - Replenishment recommendations

3. **User wants multi-location/lot/expiry/alerts:**
   - Multi-location inventory management
   - Lot tracking
   - Expiry tracking
   - Alert configuration

**CTA:** "Upgrade to CCO" (consistently used across all prompts)

---

## Updated Components

### 1. UpgradeModal

**File:** `apps/scm/app/components/UpgradeModal.tsx`

**Changes:**
- ✅ Button text: "Upgrade Now" → "Upgrade to CCO"
- ✅ Title: "Upgrade Required" → "Upgrade to CCO Required"
- ✅ Description: References "CCO (Plan + Execute + Govern + Improve)"

**Usage:**
```tsx
<UpgradeModal
  isOpen={true}
  onClose={() => setShowModal(false)}
  feature={Feature.FORECASTING_BASIC}
  currentTier={currentTier}
  suggestedTier="PRO"
/>
```

### 2. Upgrade Page

**File:** `apps/scm/app/(authenticated)/upgrade/page.tsx`

**Changes:**
- ✅ Hero: "Marketplace: Discover + Connect (Hybrid v1) • CCO: Plan + Execute + Govern + Improve"
- ✅ FREE tier: "Marketplace: Discover + Connect (Hybrid v1)"
- ✅ PRO tier: "CCO: Plan + Execute + Govern + Improve"
- ✅ ENTERPRISE tier: "CCO: Advanced Plan + Execute + Govern + Improve"

### 3. Pricing Card

**File:** `apps/scm/app/(authenticated)/upgrade/components/pricing-card.tsx`

**Changes:**
- ✅ Button text: "Upgrade to PRO" → "Upgrade to CCO"
- ✅ Dialog title: "Upgrade to PRO" → "Upgrade to CCO"
- ✅ Dialog description: References "CCO (Plan + Execute + Govern + Improve)"

### 4. Feature Limit Badge

**File:** `apps/scm/app/components/FeatureLimitBadge.tsx`

**Changes:**
- ✅ Upgrade button: "Upgrade" → "Upgrade to CCO"

### 5. Feature Limit Alert

**File:** `apps/scm/app/components/FeatureLimitAlert.tsx`

**Changes:**
- ✅ Upgrade button: "Upgrade" → "Upgrade to CCO"

### 6. Disabled Navigation Item

**File:** `apps/scm/app/components/navigation/DisabledNavItem.tsx` (NEW)

**Purpose:** Shows upgrade prompt when user clicks disabled nav item

**Usage:**
```tsx
<DisabledNavItem
  label="Forecasting"
  feature={Feature.FORECASTING_BASIC}
  requiredTier="PRO"
  currentTier={currentTier}
  currentPlanTier={currentPlanTier}
/>
```

---

## Feature Mapping

### Marketplace Features (FREE)

- ✅ Marketplace discovery (federation + centralized search)
- ✅ Connect Square/Shopify (vendor onboarding)
- ✅ View shared inventory (ASN management)
- ✅ Email notifications

### CCO Features (PRO/ENTERPRISE)

**Plan:**
- Forecasting (basic/advanced)
- Replenishment recommendations
- Scenario planning

**Execute:**
- Purchase orders
- Shipments
- Inventory management (multi-location)

**Govern:**
- Lot tracking
- Expiry tracking
- Multi-location alerts
- Compliance tracking

**Improve:**
- Analytics & reporting
- Performance optimization
- Cost analysis

---

## Upgrade Flow

### Scenario 1: Click Disabled Nav Item

```
User clicks "Forecasting" (disabled) 
→ Shows UpgradeModal
→ Title: "Upgrade to CCO Required"
→ Button: "Upgrade to CCO"
→ Redirects to /upgrade?feature=FORECASTING_BASIC&tier=PRO
```

### Scenario 2: Resource Limit Reached

```
User hits SKU limit (1,000/1,000)
→ FeatureLimitBadge shows warning
→ Button: "Upgrade to CCO"
→ Redirects to /upgrade
```

### Scenario 3: Feature Gate (Forecasting/Replenishment)

```
User tries to create forecast
→ PermissionService.canAccess() returns false
→ Shows UpgradeModal
→ Title: "Upgrade to CCO Required"
→ Button: "Upgrade to CCO"
→ Redirects to /upgrade?feature=FORECASTING_BASIC&tier=PRO
```

### Scenario 4: Feature Gate (Multi-Location/Lot/Expiry/Alerts)

```
User tries to access lot tracking
→ PermissionService.canAccess() returns false
→ Shows UpgradeModal
→ Title: "Upgrade to CCO Required"
→ Button: "Upgrade to CCO"
→ Redirects to /upgrade?feature=LOT_TRACKING&tier=PRO
```

---

## Testing Checklist

### Upgrade Prompt Triggers

- [ ] Click disabled "Forecasting" nav item → Shows "Upgrade to CCO" modal
- [ ] Click disabled "Replenishment" nav item → Shows "Upgrade to CCO" modal
- [ ] Click disabled "Multi-Location" nav item → Shows "Upgrade to CCO" modal
- [ ] Click disabled "Lot Tracking" nav item → Shows "Upgrade to CCO" modal
- [ ] Click disabled "Expiry Tracking" nav item → Shows "Upgrade to CCO" modal
- [ ] Click disabled "Alerts" nav item → Shows "Upgrade to CCO" modal

### Upgrade Modal

- [ ] Modal title: "Upgrade to CCO Required"
- [ ] Button text: "Upgrade to CCO"
- [ ] Description mentions "CCO (Plan + Execute + Govern + Improve)"
- [ ] Redirects to `/upgrade?feature=...&tier=PRO` on click

### Upgrade Page

- [ ] Hero mentions "Marketplace: Discover + Connect (Hybrid v1)"
- [ ] Hero mentions "CCO: Plan + Execute + Govern + Improve"
- [ ] FREE tier description: "Marketplace: Discover + Connect (Hybrid v1)"
- [ ] PRO tier description: "CCO: Plan + Execute + Govern + Improve"
- [ ] ENTERPRISE tier description: "CCO: Advanced Plan + Execute + Govern + Improve"

### Feature Limit Badges/Alerts

- [ ] Badge upgrade button: "Upgrade to CCO"
- [ ] Alert upgrade button: "Upgrade to CCO"
- [ ] Both redirect to `/upgrade`

---

## Summary

**✅ Updated:**
- UpgradeModal: "Upgrade Now" → "Upgrade to CCO"
- Upgrade page: Hybrid v1 messaging (Marketplace vs CCO)
- Pricing cards: CCO tier descriptions
- Feature limit badges/alerts: "Upgrade to CCO"
- Disabled nav items: Show "Upgrade to CCO" on click

**✅ Consistent CTAs:**
- All upgrade prompts use "Upgrade to CCO"
- Clear separation: Marketplace (Discover + Connect) vs CCO (Plan + Execute + Govern + Improve)

**Key Achievement:** Unified upgrade messaging that positions Marketplace as "Discover + Connect" and CCO as "Plan + Execute + Govern + Improve".

---

**Status:** ✅ Ready for Testing
**Version:** 1.0 (Hybrid v1)
**Last Updated:** 2024-01-XX

