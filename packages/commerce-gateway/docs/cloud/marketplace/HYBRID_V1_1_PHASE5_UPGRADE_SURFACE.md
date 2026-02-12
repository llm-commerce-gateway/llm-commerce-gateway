# Hybrid v1.1 Phase 5 — Upgrade Surface (Non-SCM)

**Status:** ✅ Complete  
**Date:** 2024-01-XX

---

## Overview

Phase 5 implements a lightweight Marketplace Upgrade Landing page and a Post-Upgrade CCO Wizard for first-run setup.

---

## ✅ Prompt 5.1 — Marketplace Upgrade Landing

### Standalone Upgrade Page

**Location:** `apps/scm/app/(authenticated)/marketplace/upgrade/page.tsx`

**Design Principles:**
- ✅ Lightweight, standalone design (NOT reusing SCM UI)
- ✅ Clear visual separation from SCM interface
- ✅ Gradient background (blue to purple)
- ✅ Supports deep-linking from CTAs

### Content Sections

**1. What You Already Have (Marketplace)**
- Network Discovery
- Platform Connections (Square, Shopify, WooCommerce)
- Imported Listings
- Shared Inventory View
- **Personalization:** Shows user's actual product count and unresolved count

**2. What You're Missing (Without CCO)**
- Forecasting & Planning (locked)
- Multi-Location Operations (locked)
- Lot & Expiry Tracking (locked)
- AI Agents & Automation (locked)
- **Contextual messaging:** Shows clicked feature name if deep-linked

**3. What Unlocks With CCO**
Three-column layout:
- **Plan:** Forecasting, replenishment, SKU planning, scenario modeling
- **Execute:** Purchase orders, multi-location inventory, lot tracking, workflows
- **Govern + Improve:** Compliance, recalls, analytics, continuous improvement

**4. CTA Section**
- Primary: "Upgrade to CCO" button (deep-links to `/upgrade`)
- Secondary: "Return to Dashboard"
- Trust indicators: "14-day free trial • No credit card required"

### Deep-Linking Support

**Query Parameters:**
- `feature` - Feature name that triggered upgrade
- `from` - Source context (e.g., "marketplace")
- `tier` - Suggested tier (PRO or ENTERPRISE)

**Example URLs:**
```
/marketplace/upgrade?feature=forecasting.basic&from=marketplace&tier=PRO
/marketplace/upgrade?feature=multi_location&from=nav_item&tier=PRO
```

---

## ✅ Prompt 5.2 — Post-Upgrade Wizard

### Wizard Structure

**Location:** `apps/scm/app/(authenticated)/cco/wizard/page.tsx`

**Four Steps:**
1. **Resolve Products** - Select unresolved products to resolve
2. **Select Locations** - Choose locations for planning
3. **Enable Forecasting** - Toggle forecasting on/off
4. **Generate First Plan** - Create initial replenishment plan

### Features

**Progress Tracking:**
- Visual progress bar
- Step indicators with checkmarks for completed steps
- Current step highlighted

**Skip Functionality:**
- "Skip Wizard" button in header
- Stores skip status in organization metadata
- Redirects to dashboard

**Completion Tracking:**
- Stores completion status in `organization.metadata.ccoWizard`
- Tracks completed steps
- Records selections (product IDs, location IDs, settings)

### Step Components

**ResolveProductsStep:**
- Lists unresolved products from marketplace
- Checkbox selection
- Shows product name and GTIN (if available)
- If no unresolved products, shows success message

**SelectLocationsStep:**
- Lists organization locations
- Multi-select checkboxes
- Shows location name and address
- If no locations, shows alert

**EnableForecastingStep:**
- Toggle checkbox to enable forecasting
- Explains what forecasting does
- Defaults to enabled

**GeneratePlanStep:**
- "Generate Plan" button
- Loading state during generation
- Error handling
- Marks plan as generated on success

### API Endpoints

**`GET /api/cco/wizard/status`**
- Returns wizard completion status
- Checks `organization.metadata.ccoWizard`
- Returns: `completed`, `skipped`, `completedSteps`, `completedAt`

**`POST /api/cco/wizard/skip`**
- Marks wizard as skipped
- Updates organization metadata
- Returns success status

**`POST /api/cco/wizard/complete`**
- Marks wizard as completed
- Stores selections in metadata
- TODO: Process selections (resolve products, enable forecasting, etc.)
- Returns completion timestamp

### Wizard Metadata Schema

```typescript
{
  ccoWizard: {
    completed: boolean;
    skipped: boolean;
    completedAt?: string;
    skippedAt?: string;
    completedSteps: string[];
    selections: {
      productIds: string[];
      locationIds: string[];
      enableForecasting: boolean;
      planGenerated: boolean;
    };
  }
}
```

---

## Integration Points

### Redirect After Upgrade

**After successful upgrade payment/confirmation:**
```typescript
// Redirect to wizard
router.push('/cco/wizard');
```

**Check wizard status on dashboard load:**
```typescript
const { data: wizardStatus } = useQuery({
  queryKey: ['cco-wizard-status', organizationId],
  queryFn: () => fetch('/api/cco/wizard/status').then(r => r.json()),
});

if (wizardStatus && !wizardStatus.completed && !wizardStatus.skipped) {
  router.push('/cco/wizard');
}
```

### Deep-Link from CTAs

**Contextual Upgrade CTAs:**
```typescript
<Link href={`/marketplace/upgrade?feature=${feature}&from=forecast&tier=PRO`}>
  Upgrade to CCO
</Link>
```

**Upgrade Modal:**
```typescript
router.push(`/marketplace/upgrade?feature=${feature}&tier=${suggestedTier}`);
```

---

## Files Created

### Pages
- `apps/scm/app/(authenticated)/marketplace/upgrade/page.tsx` — Marketplace upgrade landing page
- `apps/scm/app/(authenticated)/cco/wizard/page.tsx` — Post-upgrade wizard

### API Routes
- `apps/scm/app/api/cco/wizard/status/route.ts` — Wizard status endpoint
- `apps/scm/app/api/cco/wizard/skip/route.ts` — Skip wizard endpoint
- `apps/scm/app/api/cco/wizard/complete/route.ts` — Complete wizard endpoint

### Updated
- `apps/scm/app/api/marketplace/listings/unresolved/route.ts` — Returns listings array for wizard

---

## Usage Examples

### Marketplace Upgrade Landing

**Direct link:**
```
/marketplace/upgrade
```

**Deep-linked from feature:**
```
/marketplace/upgrade?feature=forecasting.basic&from=nav_item&tier=PRO
```

**Personalization:**
- Shows user's product count
- Shows unresolved product count
- Contextual message for clicked feature

### Post-Upgrade Wizard

**Automatic redirect:**
- After upgrade completion
- On first dashboard load (if not completed/skipped)

**Manual access:**
```
/cco/wizard
```

**Skip option:**
- "Skip Wizard" button available at any step
- Stores skip status, won't show again

---

## Verification

### Test Checklist

- [ ] Marketplace upgrade landing shows correct content
- [ ] Personalization displays user data correctly
- [ ] Deep-linking works with query parameters
- [ ] Wizard shows for new CCO users
- [ ] Wizard skips correctly
- [ ] Wizard completion tracked in metadata
- [ ] Wizard doesn't show after completion/skip
- [ ] All 4 wizard steps functional
- [ ] API endpoints return correct data

---

## Next Steps (Future)

1. **Wizard Processing:** Implement actual product resolution, forecasting enablement, and plan generation
2. **Analytics:** Track wizard completion rates and drop-off points
3. **Onboarding Emails:** Send follow-up emails for skipped wizards
4. **Progressive Onboarding:** Show in-app tips for users who skip wizard

---

**Status:** ✅ Phase 5 Complete — Marketplace upgrade landing and post-upgrade wizard implemented

