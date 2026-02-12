# Cloud & Federation OSS Analysis

## Summary

**Federation**: ✅ **OSS-Safe** - Core feature, should remain in OSS
**Cloud Modules**: ✅ **OSS-Safe** - Already has OSS mode, should remain
**Federation Providers**: ❌ **Proprietary** - Better Data specific, should be excluded from OSS

## Analysis

### 1. Federation Module (`src/federation/`)

**Status**: OSS-safe core feature

**What it does**:
- Merchant registry and discovery
- Multi-merchant search and routing
- Well-known gateway discovery
- JWT-based authentication
- Intent parsing

**OSS Value**: High - enables multi-vendor marketplaces

**Dependencies**:
- Imports `CapabilityGate` from cloud (but works in OSS mode)
- No direct database dependencies
- Uses interfaces that can be implemented by users

**Decision**: ✅ **Keep in OSS**

---

### 2. Cloud Modules (`src/cloud/`)

**Status**: OSS-safe with Cloud mode

**What it does**:
- `capability-discovery.ts` - Entitlement-based capability discovery
- `capability-gate.ts` - Feature gating based on entitlements

**OSS Behavior**:
- Already has `isCloud: false` mode
- Returns OSS capabilities when not in cloud mode
- All entitlement checks return false in OSS mode

**Dependencies**:
- No `@repo/database` imports (entitlement keys are duplicated)
- Used by Federation Hub (but works in OSS mode)

**Decision**: ✅ **Keep in OSS** (already designed for this)

---

### 3. Federation Providers (`src/federation/providers/`)

**Status**: ❌ **Proprietary** - Better Data Cloud specific

**What it does**:
- `BetterDataRegistryProvider` - Connects to Better Data Cloud registry
- `BetterDataDiscoveryProvider` - Uses Better Data Cloud discovery API
- `BetterDataAnalyticsSink` - Sends analytics to Better Data Cloud

**OSS Value**: None - these are Better Data Cloud integrations

**Dependencies**:
- Calls `https://api.betterdata.com/federation`
- Requires Better Data API keys
- Proprietary endpoints

**Decision**: ❌ **Exclude from OSS exports**

---

## Import Graph

```
src/index.ts
  └─> exports federation/types, FederationHub, integrateFederation
      └─> federation/hub.ts
          └─> imports cloud/capability-gate.ts (✅ OSS-safe)
          └─> uses federation/providers (❌ should be optional)

src/federation/providers/index.ts
  └─> Better Data Cloud implementations (❌ proprietary)
```

---

## Implementation Plan

### Option: Make Providers Optional (Recommended)

1. **Keep Federation in OSS** - It's a core feature
2. **Keep Cloud modules in OSS** - They already work in OSS mode
3. **Exclude Providers from main exports** - Only export from `federation/providers` subpath
4. **Update TypeScript configs** - Standalone configs, exclude providers from OSS build

### Changes Needed

1. ✅ Create standalone `tsconfig.json` files
2. ✅ Update `src/index.ts` to NOT export providers
3. ✅ Ensure `federation/providers` can be imported separately if needed
4. ✅ Add note in docs that providers are Cloud-only

---

## Files to Modify

1. `packages/llm-gateway/tsconfig.json` - Standalone config
2. `packages/llm-gateway-connectors/tsconfig.json` - Create standalone config
3. `packages/registry-mcp/tsconfig.json` - Standalone config
4. `packages/llm-gateway/src/index.ts` - Remove provider exports (if any)

---

**Decision**: Keep Federation and Cloud modules, exclude Providers from main OSS package
