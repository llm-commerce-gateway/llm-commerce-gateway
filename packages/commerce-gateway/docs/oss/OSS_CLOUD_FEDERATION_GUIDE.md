# OSS vs Cloud: Federation & Cloud Modules

## Overview

The LLM Gateway includes both OSS-safe features and optional Cloud integrations. This guide explains what's included in the OSS package and what requires Better Data Cloud.

---

## ✅ OSS-Safe Features

### Federation Module (`src/federation/`)

**Status**: ✅ **Fully OSS**

The Federation module enables multi-merchant marketplaces and is completely open source:

- **Merchant Registry** - Store and query merchant registrations
  - `MemoryMerchantRegistry` - In-memory (OSS)
  - `FileMerchantRegistry` - File-based (OSS)
  
- **Discovery Providers** - Find merchants by intent
  - `TagBasedDiscoveryProvider` - Tag-based search (OSS)
  - `StaticDiscoveryProvider` - Static list (OSS)
  
- **Analytics** - Track search and resolution events
  - `NoopAnalyticsSink` - No-op (OSS)
  - `ConsoleAnalyticsSink` - Console logging (OSS)
  
- **Federation Hub** - Orchestrates multi-merchant operations
  - `FederationHub` - Core hub class (OSS)
  - `integrateFederation()` - Gateway integration (OSS)

**Usage**:
```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: { type: 'memory' },
  discovery: { type: 'tag-based' },
  analytics: { type: 'noop' },
});
```

---

### Cloud Modules (`src/cloud/`)

**Status**: ✅ **OSS-Safe with Cloud Mode**

Cloud modules provide entitlement-based feature gating but work in OSS mode:

- **Capability Discovery** - Runtime feature detection
  - OSS mode: Returns static OSS capabilities
  - Cloud mode: Checks entitlements from database
  
- **Capability Gate** - Feature access control
  - OSS mode: All checks pass (bypass mode)
  - Cloud mode: Validates entitlements

**OSS Behavior**:
```typescript
import { createOSSCapabilityProvider } from '@betterdata/commerce-gateway/cloud';

const provider = createOSSCapabilityProvider();
const caps = await provider.getCapabilities();
// Returns OSS capabilities (no entitlements checked)
```

**Cloud Behavior**:
```typescript
import { createCloudCapabilityProvider } from '@betterdata/commerce-gateway/cloud';

const provider = createCloudCapabilityProvider({
  isCloud: true,
  organizationId: 'org_123',
  checkEntitlement: async (orgId, key) => {
    // Check database for entitlement
    return await db.entitlement.exists({ orgId, key });
  },
});
```

---

## ❌ Cloud-Only Features

### Federation Providers (`src/federation/providers/`)

**Status**: ❌ **Better Data Cloud Only**

These providers connect to Better Data Cloud APIs and require API keys:

- `BetterDataRegistryProvider` - Managed merchant registry
- `BetterDataDiscoveryProvider` - ML-powered discovery
- `BetterDataAnalyticsSink` - Centralized analytics

**Access**: Via subpath import (not in main exports)
```typescript
// Only available if Better Data Cloud is configured
import { createBetterDataProviders } from '@betterdata/commerce-gateway/federation/providers';

const providers = createBetterDataProviders({
  apiKey: process.env.BETTERDATA_API_KEY!,
});
```

**OSS Alternative**: Use built-in OSS providers (see above)

---

## Import Strategy

### OSS Package Exports

**Main package** (`@betterdata/commerce-gateway`):
- ✅ Core gateway
- ✅ Federation types and hub
- ✅ Cloud capability discovery (OSS mode)
- ❌ Federation providers (Cloud-only)

**Subpath exports**:
- `@betterdata/commerce-gateway/federation` - Full federation module
- `@betterdata/commerce-gateway/federation/providers` - Cloud providers (requires API key)
- `@betterdata/commerce-gateway/cloud` - Cloud capability modules

### TypeScript Configuration

All packages use standalone `tsconfig.json` files (no `@repo/typescript-config` dependency):

- `packages/llm-gateway/tsconfig.json` - Standalone config
- `packages/llm-gateway-connectors/tsconfig.json` - Standalone config
- `packages/registry-mcp/tsconfig.json` - Standalone config

---

## Migration Guide

### If You're Using Cloud Features

1. **Federation Providers**: Move to separate Cloud package or keep as subpath import
2. **Capability Gates**: Already work in OSS mode (set `isCloud: false`)
3. **Database Entitlements**: Replace with your own entitlement system

### If You're Building OSS-Only

1. Use OSS providers (Memory, File, Tag-based, Noop)
2. Set `isCloud: false` in capability configs
3. Ignore `federation/providers` imports

---

## Summary

| Module | OSS Status | Cloud Required |
|--------|-----------|----------------|
| Federation Hub | ✅ OSS | No |
| Federation Registry (Memory/File) | ✅ OSS | No |
| Federation Discovery (Tag/Static) | ✅ OSS | No |
| Federation Analytics (Noop/Console) | ✅ OSS | No |
| Cloud Capability Discovery | ✅ OSS Mode | Optional |
| Cloud Capability Gate | ✅ OSS Mode | Optional |
| Better Data Registry Provider | ❌ Cloud | Yes |
| Better Data Discovery Provider | ❌ Cloud | Yes |
| Better Data Analytics Sink | ❌ Cloud | Yes |

---

**Last Updated**: After OSS extraction refactoring
