# Cloud (Proprietary) Documentation

This directory contains documentation for Better Data Cloud features and proprietary functionality.

## Overview

These features require Better Data Cloud services and are not part of the open-source package. They include managed marketplace infrastructure, partner portals, and advanced analytics.

## Documentation Structure

### Marketplace Documentation

The Better Data Marketplace enables multi-vendor product search across Claude, ChatGPT, and Grok.

- **[README.md](./marketplace/README.md)** - Marketplace overview and quick start
- **[VENDOR_GUIDE.md](./marketplace/VENDOR_GUIDE.md)** - Vendor onboarding and optimization
- **[API_REFERENCE.md](./marketplace/API_REFERENCE.md)** - Marketplace API documentation
- **[ARCHITECTURE.md](./marketplace/ARCHITECTURE.md)** - Marketplace architecture
- **[LAUNCH_CHECKLIST.md](./marketplace/LAUNCH_CHECKLIST.md)** - Launch preparation checklist
- **[TROUBLESHOOTING.md](./marketplace/TROUBLESHOOTING.md)** - Common issues and solutions

#### Hybrid V1 Documentation

- **[HYBRID_V1_ARCHITECTURE_TRUTH_CHECK.md](./marketplace/HYBRID_V1_ARCHITECTURE_TRUTH_CHECK.md)** - Architecture validation
- **[HYBRID_V1_SEARCH_SPEC.md](./marketplace/HYBRID_V1_SEARCH_SPEC.md)** - Search specification
- **[HYBRID_V1_SCHEMA_PATCH.md](./marketplace/HYBRID_V1_SCHEMA_PATCH.md)** - Schema updates
- **[HYBRID_V1_UI_CHANGES.md](./marketplace/HYBRID_V1_UI_CHANGES.md)** - UI changes
- **[UPGRADE_FLOW_HYBRID_V1.md](./marketplace/UPGRADE_FLOW_HYBRID_V1.md)** - Upgrade process
- **[IMPORTED_LISTINGS_MVP.md](./marketplace/IMPORTED_LISTINGS_MVP.md)** - Imported listings feature

#### Hybrid V1.1 Phase Documentation

- **[HYBRID_V1_1_PHASE1_SYNCJOB.md](./marketplace/HYBRID_V1_1_PHASE1_SYNCJOB.md)** - Phase 1: Sync job
- **[HYBRID_V1_1_PHASE2_CANONICAL_RESOLUTION.md](./marketplace/HYBRID_V1_1_PHASE2_CANONICAL_RESOLUTION.md)** - Phase 2: Canonical resolution
- **[HYBRID_V1_1_PHASE3_FEDERATION_MERGE.md](./marketplace/HYBRID_V1_1_PHASE3_FEDERATION_MERGE.md)** - Phase 3: Federation merge
- **[HYBRID_V1_1_PHASE4_ENTITLEMENTS.md](./marketplace/HYBRID_V1_1_PHASE4_ENTITLEMENTS.md)** - Phase 4: Entitlements
- **[HYBRID_V1_1_PHASE5_UPGRADE_SURFACE.md](./marketplace/HYBRID_V1_1_PHASE5_UPGRADE_SURFACE.md)** - Phase 5: Upgrade surface
- **[HYBRID_V1_1_PHASE6_GUARDRAILS_METRICS.md](./marketplace/HYBRID_V1_1_PHASE6_GUARDRAILS_METRICS.md)** - Phase 6: Guardrails and metrics

### Partner Portal Documentation

- **[PARTNER_PORTAL_GUIDE.md](./partners/PARTNER_PORTAL_GUIDE.md)** - Partner portal access and features

## What's Included in Cloud

✅ **Managed Marketplace** - Multi-vendor marketplace with database  
✅ **Better Data Registry Provider** - Managed merchant registry  
✅ **Better Data Discovery Provider** - ML-powered discovery  
✅ **Better Data Analytics Sink** - Centralized analytics  
✅ **Partner Portal** - Supplier and partner management  
✅ **Vendor Management** - Vendor onboarding and optimization  
✅ **Advanced Analytics** - LLM attribution and performance tracking  

## Accessing Cloud Features

Cloud features require:

1. **Better Data Cloud Account** - Sign up at [betterdata.co](https://betterdata.co)
2. **API Key** - Obtain from your Better Data dashboard
3. **Entitlements** - Required entitlements for specific features

## Integration with OSS Gateway

The OSS gateway can integrate with Cloud services:

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';
import { createBetterDataProviders } from '@betterdata/commerce-gateway/federation/providers';

// Use Better Data Cloud providers
const providers = createBetterDataProviders({
  apiKey: process.env.BETTERDATA_API_KEY!,
});

const hub = await FederationHub.create({
  registry: providers.registry,
  discovery: providers.discovery,
  analytics: providers.analytics,
});
```

## OSS Alternative

For open-source alternatives, see [../oss/README.md](../oss/README.md). The OSS package includes:

- Memory/File-based merchant registry
- Tag-based discovery
- Console/noop analytics
- Federation hub (OSS mode)

## Support

- **Documentation**: [docs.betterdata.dev](https://docs.betterdata.dev)
- **Email**: support@betterdata.dev
- **Status**: [status.betterdata.dev](https://status.betterdata.dev)
