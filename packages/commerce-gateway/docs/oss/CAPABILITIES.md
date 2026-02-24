# Gateway Capability Discovery

> **Version**: 1.0.0  
> **Spec Version**: `2025-12-22`  
> **Applies to**: `@betterdata/commerce-gateway` v1.1.0+

## Overview

Capability discovery allows clients and federation hubs to query what features a gateway or provider supports at runtime. This enables:

- **Graceful degradation** when features aren't available
- **Feature detection** before attempting operations
- **Clear OSS vs Cloud separation** for feature tiers
- **Safe evolution** via versioned capability schemas

---

## Quick Start

### Check Hub Capabilities

```typescript
import { FederationHub } from '@betterdata/commerce-gateway/federation';

const hub = await FederationHub.create({
  registry: { type: 'memory' },
  discovery: { type: 'tag-based' },
});

// Get capabilities
const caps = await hub.getCapabilities();

// Check specific features
if (caps.features.discovery.rankedResults) {
  // Use ML-powered ranked discovery (Cloud feature)
} else {
  console.warn('Using default sort order (ranked results require Cloud)');
}

if (!caps.features.verification.manualReview) {
  console.log('Manual verification review requires Better Data Cloud');
}
```

### Implement CapabilityProvider (Optional)

```typescript
import type { 
  CapabilityProvider, 
  GatewayCapabilities 
} from '@betterdata/commerce-gateway/capabilities';
import type { MerchantRegistry } from '@betterdata/commerce-gateway/federation';

class MyCloudRegistry implements MerchantRegistry, CapabilityProvider {
  // ... MerchantRegistry methods ...

  async getCapabilities(): Promise<GatewayCapabilities> {
    return {
      specVersion: '2025-12-22',
      gatewayVersion: '1.1.0',
      features: {
        registry: {
          merchantWrite: true,
          verificationAutomation: true,  // Cloud feature
          supportsPrivateHubs: true,     // Cloud feature
        },
        discovery: {
          rankedResults: true,           // Cloud feature
          supportsFilters: true,
          supportsPagination: true,
          supportsTagSearch: true,
        },
        analytics: {
          events: ['search', 'click', 'add_to_cart', 'checkout', 'verify'],
          realtime: true,                // Cloud feature
        },
        verification: {
          dnsTxt: true,
          metaTag: true,
          callbackChallenge: true,
          manualReview: true,            // Cloud feature
        },
      },
    };
  }
}
```

---

## The Capability Handshake

### How It Works

```
┌─────────────────┐     getCapabilities()    ┌──────────────────┐
│                 │ ─────────────────────────▶│                  │
│  Federation     │                           │   Registry       │
│  Hub            │◀───────────────────────── │   Provider       │
│                 │     GatewayCapabilities   │                  │
└─────────────────┘                           └──────────────────┘
        │
        │ getCapabilities()
        ▼
┌─────────────────┐
│                 │
│   Discovery     │ ──▶ GatewayCapabilities
│   Provider      │
│                 │
└─────────────────┘
        │
        │ mergeCapabilities()
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Aggregated Capabilities                        │
│  (Intersection of all provider capabilities)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step

1. **Client calls `hub.getCapabilities()`**
2. **Hub checks each provider** for `CapabilityProvider` interface
3. **Providers that implement it** return their capabilities
4. **Providers that don't** are treated as having defaults (conservative)
5. **Hub merges capabilities** using intersection (AND logic)
6. **Client receives aggregated result**

### Merging Logic

When multiple providers report capabilities, the hub uses intersection:

| Capability Type | Merge Rule |
|-----------------|------------|
| Boolean flags | `true` only if ALL providers are `true` |
| String arrays | Intersection of all arrays |
| Version fields | Latest `specVersion`, actual `gatewayVersion` |

```typescript
import { mergeCapabilities } from '@betterdata/commerce-gateway/capabilities';

const merged = mergeCapabilities([
  providerA.getCapabilities(),
  providerB.getCapabilities(),
]);

// If providerA has rankedResults=true and providerB has rankedResults=false
// merged.features.discovery.rankedResults === false
```

---

## Capability Schema

### GatewayCapabilities

```typescript
interface GatewayCapabilities {
  /**
   * Schema version (YYYY-MM-DD format).
   * Check this before parsing to handle schema evolution.
   */
  specVersion: '2025-12-22';

  /**
   * Package version of @betterdata/commerce-gateway.
   */
  gatewayVersion: string;

  features: {
    /**
     * Merchant registry capabilities.
     */
    registry: {
      /** Can register/update merchants (vs read-only) */
      merchantWrite: boolean;
      
      /** Supports automated DNS/meta verification */
      verificationAutomation: boolean;
      
      /** Supports private customer hubs */
      supportsPrivateHubs: boolean;
    };

    /**
     * Discovery and search capabilities.
     */
    discovery: {
      /** Returns ML-ranked/scored results */
      rankedResults: boolean;
      
      /** Supports filter parameters */
      supportsFilters: boolean;
      
      /** Supports pagination */
      supportsPagination: boolean;
      
      /** Supports tag-based search */
      supportsTagSearch: boolean;
    };

    /**
     * Analytics capabilities.
     */
    analytics: {
      /** Supported event types (empty = no analytics) */
      events: string[];
      
      /** Supports realtime streaming */
      realtime: boolean;
    };

    /**
     * Verification capabilities.
     */
    verification: {
      /** DNS TXT record verification */
      dnsTxt: boolean;
      
      /** HTML meta tag verification */
      metaTag: boolean;
      
      /** Callback challenge verification */
      callbackChallenge: boolean;
      
      /** Manual review verification */
      manualReview: boolean;
    };
  };
}
```

### Schema Versioning

The `specVersion` field enables safe schema evolution:

| Version | Changes |
|---------|---------|
| `2025-12-22` | Initial release |

**Evolution Rules:**
- New optional fields → same `specVersion`
- New required fields → new `specVersion`
- Removed/renamed fields → new `specVersion`

**Client Handling:**

```typescript
const caps = await hub.getCapabilities();

if (caps.specVersion !== '2025-12-22') {
  console.warn(`Unknown capability schema: ${caps.specVersion}`);
  // Fall back to conservative assumptions
}
```

---

## Presets

### DEFAULT_CAPABILITIES

Conservative defaults used when a provider doesn't implement capability discovery:

```typescript
import { DEFAULT_CAPABILITIES } from '@betterdata/commerce-gateway/capabilities';

// All Cloud features disabled
// Basic OSS features enabled
```

| Feature | Default |
|---------|---------|
| `registry.merchantWrite` | `false` |
| `registry.verificationAutomation` | `false` |
| `registry.supportsPrivateHubs` | `false` |
| `discovery.rankedResults` | `false` |
| `discovery.supportsFilters` | `true` |
| `discovery.supportsPagination` | `true` |
| `discovery.supportsTagSearch` | `true` |
| `analytics.events` | `[]` |
| `analytics.realtime` | `false` |
| `verification.dnsTxt` | `true` |
| `verification.metaTag` | `true` |
| `verification.callbackChallenge` | `true` |
| `verification.manualReview` | `false` |

### OSS_CAPABILITIES

Full OSS feature set (no Cloud features):

```typescript
import { OSS_CAPABILITIES } from '@betterdata/commerce-gateway/capabilities';

// merchantWrite: true (can register locally)
// Basic analytics events: ['search', 'click']
// All verification except manualReview
```

---

## Type Guards & Utilities

### hasCapabilities()

Check if an object implements `CapabilityProvider`:

```typescript
import { hasCapabilities } from '@betterdata/commerce-gateway/capabilities';

function setupRegistry(registry: MerchantRegistry) {
  if (hasCapabilities(registry)) {
    const caps = await registry.getCapabilities();
    console.log('Registry capabilities:', caps.features.registry);
  } else {
    console.log('Registry does not support capability discovery');
  }
}
```

### isValidCapabilities()

Validate a capabilities object:

```typescript
import { isValidCapabilities } from '@betterdata/commerce-gateway/capabilities';

const response = await fetch('/api/capabilities');
const data = await response.json();

if (isValidCapabilities(data)) {
  // Safe to use as GatewayCapabilities
} else {
  console.error('Invalid capabilities response');
}
```

### mergeCapabilities()

Aggregate capabilities from multiple sources:

```typescript
import { mergeCapabilities } from '@betterdata/commerce-gateway/capabilities';

const caps = mergeCapabilities([
  await registryProvider.getCapabilities(),
  await discoveryProvider.getCapabilities(),
  await analyticsProvider.getCapabilities(),
]);
```

---

## OSS vs Cloud Capabilities

### Tenancy Model

**OSS deployments are single-tenant by design.**

The OSS version of `@betterdata/commerce-gateway` is explicitly designed for single-tenant deployments:

- **No tenant isolation** - All data is stored in a single, global namespace
- **No multi-tenant RBAC** - Permission enforcement requires Better Data Cloud
- **Global Redis keyspace** - Session and cache keys are not tenant-namespaced
- **No entitlements checking** - All OSS features are available without organization-based gating

If you need multi-tenant isolation, RBAC, or per-organization entitlements, see [Better Data Cloud](https://betterdata.dev/cloud).

```typescript
import { OSS_TENANT_CONTEXT } from '@betterdata/commerce-gateway/extensions';

// OSS is always single-tenant
console.log(OSS_TENANT_CONTEXT.organizationId); // 'default'
console.log(OSS_TENANT_CONTEXT.isCloud);        // false
```

### Feature Matrix

| Feature | OSS | Cloud (Free) | Cloud (Pro) |
|---------|-----|--------------|-------------|
| **Registry** ||||
| Merchant registration | ✅ | ✅ | ✅ |
| Verification automation | ❌ | ✅ | ✅ |
| Private hubs | ❌ | ❌ | ✅ |
| **Discovery** ||||
| Basic search | ✅ | ✅ | ✅ |
| Filters & pagination | ✅ | ✅ | ✅ |
| ML-ranked results | ❌ | ❌ | ✅ |
| **Analytics** ||||
| Basic events | ✅ | ✅ | ✅ |
| Full event suite | ❌ | ✅ | ✅ |
| Realtime streaming | ❌ | ❌ | ✅ |
| **Verification** ||||
| DNS/Meta/Callback | ✅ | ✅ | ✅ |
| Manual review | ❌ | ✅ | ✅ |

### Client UI Example

```tsx
function FeatureGate({ 
  feature, 
  children, 
  fallback 
}: { 
  feature: keyof GatewayCapabilities['features']['discovery'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const caps = useCapabilities(); // Custom hook

  if (caps.features.discovery[feature]) {
    return <>{children}</>;
  }

  return fallback ? (
    <>{fallback}</>
  ) : (
    <CloudUpgradePrompt feature={feature} />
  );
}

// Usage
<FeatureGate feature="rankedResults">
  <RankedResultsToggle />
</FeatureGate>
```

---

## Caching

For performance, use cached capabilities:

```typescript
const hub = await FederationHub.create({ ... });

// First call fetches from providers
const caps1 = await hub.getCachedCapabilities();

// Subsequent calls return cached value
const caps2 = await hub.getCachedCapabilities(); // Instant

// Clear cache if providers change
hub.clearCapabilitiesCache();
```

---

## Best Practices

### For Provider Implementers

1. **Only report what you support** - Don't claim capabilities you can't deliver
2. **Be consistent** - Don't change capabilities at runtime
3. **Use correct specVersion** - Match the schema you're implementing
4. **Test your capabilities** - Verify the returned object is valid

### For Client Developers

1. **Check capabilities early** - At app initialization, not per-request
2. **Use caching** - Call `getCachedCapabilities()` for repeated checks
3. **Handle unknown versions** - Fall back gracefully for new `specVersion`
4. **Show upgrade paths** - When Cloud features are needed, guide users

### For OSS Contributors

1. **Don't break the schema** - Follow [INTERFACE_STABILITY.md](./INTERFACE_STABILITY.md)
2. **Add new features as optional** - Existing providers shouldn't break
3. **Document capability implications** - Update this file when adding features
4. **Test with defaults** - Ensure code works when features are disabled

---

## API Reference

### FederationHub Methods

| Method | Description |
|--------|-------------|
| `getCapabilities()` | Get aggregated capabilities (async) |
| `getCachedCapabilities()` | Get cached capabilities |
| `clearCapabilitiesCache()` | Clear the cache |

### Exports from `@betterdata/commerce-gateway/capabilities`

| Export | Type | Description |
|--------|------|-------------|
| `GatewayCapabilities` | Type | Main capability schema |
| `CapabilityProvider` | Interface | Optional provider interface |
| `DEFAULT_CAPABILITIES` | Const | Conservative defaults |
| `OSS_CAPABILITIES` | Const | Full OSS feature set |
| `hasCapabilities()` | Function | Type guard |
| `isValidCapabilities()` | Function | Schema validator |
| `mergeCapabilities()` | Function | Aggregate capabilities |

---

## Changelog

### 2025-12-22 (specVersion: 2025-12-22)

- Initial capability discovery implementation
- `GatewayCapabilities` schema with registry, discovery, analytics, verification domains
- `CapabilityProvider` optional interface
- `FederationHub.getCapabilities()` aggregation
- Caching support

---

*For questions about capability discovery, see the [GitHub discussions](https://github.com/betterdataco/llm-commerce-gateway/discussions).*

