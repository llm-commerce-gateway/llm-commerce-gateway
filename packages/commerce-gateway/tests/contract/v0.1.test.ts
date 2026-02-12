/**
 * LLM Gateway Release Contract Tests (v0 + v0.1)
 *
 * These tests verify that the release contract requirements are met.
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Extension interfaces and OSS defaults
import {
  TenantContext,
  TenantContextResolver,
  KeyDeriver,
  EntitlementsChecker,
  GATEWAY_ENTITLEMENT_KEYS,
} from '../../src/extensions/interfaces';

import {
  OSSTenantContextResolver,
  OSSKeyDeriver,
  OSSEntitlementsChecker,
  OSS_DEFAULT_ORG_ID,
  OSS_KEY_PREFIX,
  OSS_TENANT_CONTEXT,
  createOSSTenantContextResolver,
  createOSSKeyDeriver,
  createOSSEntitlementsChecker,
} from '../../src/extensions/oss-defaults';

// Feature flags
import {
  featureFlags,
  isFeatureEnabled,
  isCloudOnlyFeature,
  isExperimentalFeature,
  FEATURE_FLAGS,
  validateOSSFeatureFlags,
} from '../../src/feature-flags';

// SessionManager (to verify KeyDeriver integration)
import {
  SessionManager,
  RedisSessionStore,
  SessionManagerConfig,
} from '../../src/session/SessionManager';

// ============================================================================
// Section 5: Extension Interfaces
// ============================================================================

describe('Extension Interfaces (v0.1 Contract)', () => {
  describe('TenantContextResolver', () => {
    it('OSS resolver returns single-tenant context', async () => {
      const resolver = createOSSTenantContextResolver();
      const request = new Request('http://localhost/test');

      const context = await resolver.resolve(request);

      expect(context.organizationId).toBe(OSS_DEFAULT_ORG_ID);
      expect(context.isCloud).toBe(false);
    });

    it('OSS resolver ignores organizationId in fromKnown', () => {
      const resolver = createOSSTenantContextResolver();

      const context = resolver.fromKnown('some-org-id', 'user-123');

      // Should still return default org
      expect(context.organizationId).toBe(OSS_DEFAULT_ORG_ID);
      expect(context.userId).toBe('user-123');
      expect(context.isCloud).toBe(false);
    });

    it('OSS_TENANT_CONTEXT is immutable single-tenant', () => {
      expect(OSS_TENANT_CONTEXT.organizationId).toBe(OSS_DEFAULT_ORG_ID);
      expect(OSS_TENANT_CONTEXT.isCloud).toBe(false);
    });
  });

  describe('KeyDeriver', () => {
    it('OSS deriver returns global keys (no tenant namespace)', () => {
      const deriver = createOSSKeyDeriver();

      const sessionKey = deriver.deriveSessionKey('sess_123');
      const cartKey = deriver.deriveCartKey('cart_456');
      const rateLimitKey = deriver.deriveRateLimitKey('ip_127.0.0.1');
      const cacheKey = deriver.deriveCacheKey('products', 'search:query');

      // Keys should have global prefix, NOT tenant-namespaced
      expect(sessionKey).toBe('llm-gateway:session:sess_123');
      expect(cartKey).toBe('llm-gateway:cart:cart_456');
      expect(rateLimitKey).toBe('llm-gateway:ratelimit:ip_127.0.0.1');
      expect(cacheKey).toBe('llm-gateway:cache:products:search:query');

      // Should NOT have org: prefix (that's Cloud-only)
      expect(sessionKey).not.toContain('org:');
      expect(cartKey).not.toContain('org:');
    });

    it('OSS deriver getTenantContext returns undefined', () => {
      const deriver = createOSSKeyDeriver();
      expect(deriver.getTenantContext()).toBeUndefined();
    });

    it('OSS deriver can have custom prefix', () => {
      const deriver = createOSSKeyDeriver('custom-prefix');

      const sessionKey = deriver.deriveSessionKey('sess_123');
      expect(sessionKey).toBe('custom-prefix:session:sess_123');
    });
  });

  describe('EntitlementsChecker', () => {
    it('OSS checker returns false for all entitlements', async () => {
      const checker = createOSSEntitlementsChecker();

      // Check individual entitlements
      for (const key of Object.values(GATEWAY_ENTITLEMENT_KEYS)) {
        const hasEntitlement = await checker.check('any-org', key);
        expect(hasEntitlement).toBe(false);
      }
    });

    it('OSS checker checkMany returns all false', async () => {
      const checker = createOSSEntitlementsChecker();
      const keys = Object.values(GATEWAY_ENTITLEMENT_KEYS);

      const results = await checker.checkMany('any-org', keys);

      for (const key of keys) {
        expect(results.get(key)).toBe(false);
      }
    });

    it('OSS checker isOSS returns true', () => {
      const checker = createOSSEntitlementsChecker();
      expect(checker.isOSS()).toBe(true);
    });
  });
});

// ============================================================================
// Section 4: Feature Flags
// ============================================================================

describe('Feature Flags (v0.1 Contract)', () => {
  beforeEach(() => {
    // Reset feature flags to default state
    featureFlags.clearAllOverrides();
    featureFlags.setCloudMode(false);
  });

  describe('Cloud-only flags (🔴)', () => {
    const cloudOnlyFlags = [
      'ENABLE_FEDERATION_WRITE',
      'ENABLE_SMART_ROUTING',
      'ENABLE_SEMANTIC_CACHING',
      'ENABLE_SCM_TOOLS',
      'ENABLE_REALTIME_ANALYTICS',
      'ENABLE_MULTI_TENANT',
    ] as const;

    it('Cloud-only flags default to false', () => {
      for (const flag of cloudOnlyFlags) {
        expect(isFeatureEnabled(flag)).toBe(false);
      }
    });

    it('Cloud-only flags are classified as cloud-only', () => {
      for (const flag of cloudOnlyFlags) {
        expect(isCloudOnlyFeature(flag)).toBe(true);
      }
    });

    it('Cannot enable Cloud-only flags in OSS mode', () => {
      featureFlags.setCloudMode(false);

      for (const flag of cloudOnlyFlags) {
        expect(() => {
          featureFlags.setOverride(flag, true);
        }).toThrow(/Cannot enable Cloud-only feature/);
      }
    });

    it('Can enable Cloud-only flags in Cloud mode', () => {
      featureFlags.setCloudMode(true);

      for (const flag of cloudOnlyFlags) {
        featureFlags.setOverride(flag, true);
        expect(isFeatureEnabled(flag)).toBe(true);
        featureFlags.clearOverride(flag);
      }
    });
  });

  describe('Experimental flags (🟡)', () => {
    const experimentalFlags = [
      'ENABLE_LOT_EXPIRY',
      'ENABLE_MCP_STDIO',
      'ENABLE_FEDERATION',
    ] as const;

    it('Experimental flags default to false', () => {
      for (const flag of experimentalFlags) {
        expect(isFeatureEnabled(flag)).toBe(false);
      }
    });

    it('Experimental flags are classified as experimental', () => {
      for (const flag of experimentalFlags) {
        expect(isExperimentalFeature(flag)).toBe(true);
      }
    });

    it('Can enable experimental flags in OSS mode', () => {
      featureFlags.setCloudMode(false);

      for (const flag of experimentalFlags) {
        featureFlags.setOverride(flag, true);
        expect(isFeatureEnabled(flag)).toBe(true);
        featureFlags.clearOverride(flag);
      }
    });
  });

  describe('Stable flags (✅)', () => {
    it('ENABLE_ANALYTICS defaults to true', () => {
      expect(isFeatureEnabled('ENABLE_ANALYTICS')).toBe(true);
    });
  });

  describe('validateOSSFeatureFlags', () => {
    it('Passes when no Cloud-only flags are enabled', () => {
      featureFlags.setCloudMode(false);
      expect(() => validateOSSFeatureFlags()).not.toThrow();
    });

    it('Skips validation in Cloud mode', () => {
      featureFlags.setCloudMode(true);
      featureFlags.setOverride('ENABLE_SMART_ROUTING', true);
      expect(() => validateOSSFeatureFlags()).not.toThrow();
    });
  });
});

// ============================================================================
// Section 4.4: KeyDeriver Integration
// ============================================================================

describe('KeyDeriver Integration (v0.1 Contract)', () => {
  describe('SessionManager uses KeyDeriver', () => {
    it('SessionManager accepts KeyDeriver in config', () => {
      const customDeriver = createOSSKeyDeriver('test-prefix');

      // This should not throw - verifying the interface is correctly implemented
      const config: SessionManagerConfig = {
        redis: { url: '' },
        keyDeriver: customDeriver,
      };

      expect(config.keyDeriver).toBeDefined();
      expect(config.keyDeriver?.deriveSessionKey('test')).toBe(
        'test-prefix:session:test'
      );
    });

    it('SessionManager getKeyDeriver returns the deriver', () => {
      const manager = new SessionManager({
        redis: { url: '' },
      });

      const deriver = manager.getKeyDeriver();

      // Should return the OSS default deriver
      expect(deriver).toBeDefined();
      expect(deriver.deriveSessionKey('test')).toContain('session:test');
    });
  });
});

// ============================================================================
// Section 5.1: Hard Rules
// ============================================================================

describe('Hard Rules (v0.1 Contract)', () => {
  it('OSS defaults do not claim multi-tenant isolation', () => {
    const context = OSS_TENANT_CONTEXT;

    // isCloud must be false
    expect(context.isCloud).toBe(false);

    // organizationId should be 'default', indicating single-tenant
    expect(context.organizationId).toBe('default');
  });

  it('Required extension interfaces exist', () => {
    // These should be importable without errors
    const resolver: TenantContextResolver = createOSSTenantContextResolver();
    const deriver: KeyDeriver = createOSSKeyDeriver();
    const checker: EntitlementsChecker = createOSSEntitlementsChecker();

    expect(resolver).toBeDefined();
    expect(deriver).toBeDefined();
    expect(checker).toBeDefined();

    // Verify they have the required methods
    expect(typeof resolver.resolve).toBe('function');
    expect(typeof resolver.fromKnown).toBe('function');
    expect(typeof deriver.deriveSessionKey).toBe('function');
    expect(typeof deriver.deriveCartKey).toBe('function');
    expect(typeof deriver.deriveRateLimitKey).toBe('function');
    expect(typeof deriver.deriveCacheKey).toBe('function');
    expect(typeof checker.check).toBe('function');
    expect(typeof checker.checkMany).toBe('function');
    expect(typeof checker.isOSS).toBe('function');
  });
});

// ============================================================================
// Section 4.2: Tool Gating
// ============================================================================

describe('Tool Gating (v0.1 Contract)', () => {
  describe('check_inventory lot/expiry', () => {
    it('ENABLE_LOT_EXPIRY is experimental and default-off', () => {
      expect(isFeatureEnabled('ENABLE_LOT_EXPIRY')).toBe(false);
      expect(isExperimentalFeature('ENABLE_LOT_EXPIRY')).toBe(true);
    });
  });
});

// ============================================================================
// Section 4.7: Federation
// ============================================================================

describe('Federation Gating (v0.1 Contract)', () => {
  it('ENABLE_FEDERATION is experimental and default-off', () => {
    expect(isFeatureEnabled('ENABLE_FEDERATION')).toBe(false);
    expect(isExperimentalFeature('ENABLE_FEDERATION')).toBe(true);
  });

  it('ENABLE_FEDERATION_WRITE is Cloud-only', () => {
    expect(isFeatureEnabled('ENABLE_FEDERATION_WRITE')).toBe(false);
    expect(isCloudOnlyFeature('ENABLE_FEDERATION_WRITE')).toBe(true);
  });
});

// ============================================================================
// Section 4.6: Multi-tenancy
// ============================================================================

describe('Multi-tenancy Gating (v0.1 Contract)', () => {
  it('ENABLE_MULTI_TENANT is Cloud-only', () => {
    expect(isFeatureEnabled('ENABLE_MULTI_TENANT')).toBe(false);
    expect(isCloudOnlyFeature('ENABLE_MULTI_TENANT')).toBe(true);
  });

  it('OSS is explicitly single-tenant', () => {
    const context = OSS_TENANT_CONTEXT;
    expect(context.isCloud).toBe(false);
    expect(context.metadata?.mode).toBe('oss');
  });
});

// ============================================================================
// Gateway Entitlement Keys
// ============================================================================

describe('Gateway Entitlement Keys', () => {
  it('All expected entitlement keys are defined', () => {
    expect(GATEWAY_ENTITLEMENT_KEYS.REGISTRY_CLOUD).toBe('gateway.registry.cloud');
    expect(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED).toBe('gateway.discovery.ranked');
    expect(GATEWAY_ENTITLEMENT_KEYS.VERIFICATION_AUTOMATED).toBe(
      'gateway.verification.automated'
    );
    expect(GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED).toBe('gateway.analytics.enabled');
    expect(GATEWAY_ENTITLEMENT_KEYS.FEDERATION_GLOBAL).toBe('gateway.federation.global');
    expect(GATEWAY_ENTITLEMENT_KEYS.FEDERATION_PRIVATE).toBe('gateway.federation.private');
    expect(GATEWAY_ENTITLEMENT_KEYS.SEMANTIC_CACHING).toBe('gateway.caching.semantic');
    expect(GATEWAY_ENTITLEMENT_KEYS.SMART_ROUTING).toBe('gateway.routing.smart');
    expect(GATEWAY_ENTITLEMENT_KEYS.SCM_TOOLS).toBe('gateway.tools.scm');
  });
});
