# Interface Stability Policy

> **Version**: 1.0.0  
> **Effective Date**: 2025-12-22  
> **Applies to**: `@betterdata/llm-gateway` (MIT-licensed OSS package)

## Overview

This document defines the interface stability guarantees for the `@betterdata/llm-gateway` package. 
These commitments enable downstream consumers to upgrade confidently and build stable integrations.

---

## Semantic Versioning Commitment

We follow [Semantic Versioning 2.0.0](https://semver.org/) strictly for all public APIs.

### Version Semantics

| Version Bump | Allowed Changes | Examples |
|--------------|----------------|----------|
| **Patch** (x.x.1) | Bug fixes only, no signature changes | Fix null handling, correct typos in error messages |
| **Minor** (x.1.0) | Additive only: new optional fields, new interfaces, new providers | Add `timeout` option to `GatewayConfig`, new `CapabilityProvider` interface |
| **Major** (2.0.0) | Breaking changes allowed | Change `searchProducts()` return type, rename `LLMGateway` to `Gateway` |

---

## What Counts as "Breaking"

A change is considered **breaking** if it can cause compilation or runtime errors in existing consumer code.

### Breaking Changes (Require Major Bump)

| Category | Examples |
|----------|----------|
| **Interface method signatures** | Adding required parameters, changing parameter types, removing methods |
| **Return types** | Changing `Promise<Product[]>` to `Promise<ProductSearchResult>` |
| **Required fields** | Adding required fields to exported types |
| **Type renames** | Renaming `LLMGateway` to `Gateway` without alias |
| **Export removals** | Removing an exported function, type, or class |
| **Semantic changes** | Changing behavior in a way that breaks documented contracts |

### Non-Breaking Changes (Minor or Patch)

| Category | Examples |
|----------|----------|
| **New optional fields** | Adding `metadata?: Record<string, unknown>` to `Product` |
| **New interfaces** | Adding `CapabilityProvider` interface |
| **New exports** | Adding new functions, classes, or types |
| **New optional parameters** | Adding `options?: { timeout?: number }` to existing method |
| **Documentation** | Improving JSDoc, README, or examples |
| **Internal refactors** | Changing implementation without affecting public API |

---

## Deprecation Policy

We never remove public APIs without warning. Deprecated APIs follow this lifecycle:

### Deprecation Process

1. **Mark as Deprecated**
   - Add `@deprecated` JSDoc tag with migration guidance
   - Add console warning on first use (development mode only)
   - Document in CHANGELOG

2. **Deprecation Window**
   - Minimum: **One minor release cycle**
   - Recommended: **Two minor release cycles** for widely-used APIs

3. **Removal**
   - Only in **major versions**
   - Clear migration guide in CHANGELOG
   - Codemod provided for complex migrations (when feasible)

### Example Deprecation

```typescript
/**
 * @deprecated Use `FederationHub.getCapabilities()` instead.
 * Will be removed in v2.0.0.
 * 
 * @example Migration:
 * ```typescript
 * // Before
 * const caps = await hub.discoverCapabilities(url);
 * 
 * // After
 * const caps = await hub.getCapabilities();
 * ```
 */
export async function discoverCapabilities(
  gatewayUrl: string
): Promise<MerchantCapabilities | null> {
  console.warn(
    '[DEPRECATED] discoverCapabilities() is deprecated. ' +
    'Use FederationHub.getCapabilities() instead.'
  );
  // ... implementation
}
```

---

## Public API Surface

The public API consists of all exports from the package entry points:

### Core Exports (Highest Stability)

| Entry Point | Description | Stability |
|-------------|-------------|-----------|
| `@betterdata/llm-gateway` | Main entry point | 🟢 Stable |
| `@betterdata/llm-gateway/backends` | Backend interfaces | 🟢 Stable |
| `@betterdata/llm-gateway/federation` | Federation hub | 🟢 Stable |
| `@betterdata/llm-gateway/mcp` | MCP server | 🟢 Stable |

### Extension Points (Stable but Extensible)

| Entry Point | Description | Stability |
|-------------|-------------|-----------|
| `@betterdata/llm-gateway/catalog` | Search/cart services | 🟡 Extensible |
| `@betterdata/llm-gateway/ingestion` | Product import | 🟡 Extensible |
| `@betterdata/llm-gateway/providers` | Capability providers | 🟡 Extensible |

### Internal APIs (Not Covered)

| Pattern | Description |
|---------|-------------|
| `@betterdata/llm-gateway/*/internal/*` | Internal implementation details |
| Unexported types | Types not in `index.ts` exports |
| Private class members | `private` or `#` prefixed members |

---

## Capability Discovery

Starting in v1.1.0, the gateway supports runtime capability discovery:

```typescript
import type { GatewayCapabilities } from '@betterdata/llm-gateway';

// Check what features a gateway supports
const caps = await hub.getCapabilities();

if (!caps.features.discovery.rankedResults) {
  console.warn('Ranked results not available, using default sort');
}
```

The `GatewayCapabilities` schema is versioned separately via `specVersion` field:

- Schema changes increment `specVersion`
- New optional fields are additive (minor schema bump)
- Removing or renaming fields requires major bump

---

## CI Enforcement

We enforce interface stability through automated checks:

### 1. API Surface Diffing

Every PR is checked for breaking changes:

```yaml
# .github/workflows/api-check.yml
- name: Check API Surface
  run: |
    pnpm build
    pnpm api-extractor run --local
    git diff --exit-code api-report.md
```

### 2. Breaking Change Detection

If breaking changes are detected:

- **Minor/Patch PR**: ❌ CI fails with instructions
- **Major PR**: ✅ CI passes (explicit opt-in)

### 3. Deprecation Linting

ESLint warns on deprecated API usage:

```json
{
  "rules": {
    "@typescript-eslint/no-deprecated": "warn"
  }
}
```

---

## Consumer Guidelines

### For Library Consumers

1. **Pin minor versions** for stability: `"@betterdata/llm-gateway": "~1.2.0"`
2. **Read CHANGELOG** before upgrading major versions
3. **Run type checking** after upgrades: `tsc --noEmit`
4. **Address deprecation warnings** before next major release

### For Contributors

1. **Check API surface** before submitting PR
2. **Add `@deprecated` tags** when replacing APIs
3. **Update CHANGELOG** for all public API changes
4. **Consider additive alternatives** before breaking changes

---

## Exceptions

### Experimental APIs

APIs marked with `@experimental` or `@beta` JSDoc tags are exempt from stability guarantees:

```typescript
/**
 * @experimental This API may change without notice.
 */
export function experimentalFeature(): void;
```

### Security Fixes

Critical security vulnerabilities may require breaking changes in patch releases. 
These will be clearly documented in security advisories.

---

## Contact

For questions about API stability:

- **GitHub Issues**: [betterdata/llm-gateway](https://github.com/betterdata/llm-gateway/issues)
- **Email**: api-stability@betterdata.dev

---

*This policy is effective as of v1.0.0 and applies to all subsequent releases.*

