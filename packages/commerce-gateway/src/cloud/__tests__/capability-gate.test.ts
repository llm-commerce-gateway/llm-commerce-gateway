/**
 * Capability Gate Tests
 *
 * Tests for entitlement-based provider instantiation gating.
 *
 * Key scenarios:
 * 1. Missing entitlement → rejection with clear error
 * 2. OSS mode → bypass all checks
 * 3. Cloud mode with entitlement → allow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CapabilityGate,
  CapabilityNotEnabledError,
  createCloudCapabilityGate,
  createOSSCapabilityGate,
  OSS_CAPABILITY_GATE,
  CAPABILITY_ENTITLEMENT_MAP,
  PROVIDER_REQUIRED_CAPABILITIES,
} from '../capability-gate';
import { GATEWAY_ENTITLEMENT_KEYS } from '../capability-discovery';

describe('CapabilityGate', () => {
  // ===========================================================================
  // OSS MODE TESTS
  // ===========================================================================

  describe('OSS Mode', () => {
    it('should allow all capabilities in OSS mode', async () => {
      const gate = createOSSCapabilityGate();

      const result = await gate.checkCapability('rankedDiscovery');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('OSS');
    });

    it('should never throw in OSS mode', async () => {
      const gate = createOSSCapabilityGate();

      await expect(
        gate.requireCapability('rankedDiscovery', 'RankedDiscoveryProvider')
      ).resolves.not.toThrow();
    });

    it('should report isOSSMode correctly', () => {
      const ossGate = createOSSCapabilityGate();
      const cloudGate = createCloudCapabilityGate('org_123', async () => false);

      expect(ossGate.isOSSMode()).toBe(true);
      expect(cloudGate.isOSSMode()).toBe(false);
    });

    it('should have singleton OSS gate', async () => {
      const result = await OSS_CAPABILITY_GATE.checkCapability('cloudRegistry');

      expect(result.allowed).toBe(true);
      expect(OSS_CAPABILITY_GATE.isOSSMode()).toBe(true);
    });

    it('should allow all provider types in OSS mode', async () => {
      const gate = createOSSCapabilityGate();

      for (const providerType of Object.keys(PROVIDER_REQUIRED_CAPABILITIES)) {
        await expect(
          gate.requireProviderCapabilities(providerType)
        ).resolves.not.toThrow();
      }
    });
  });

  // ===========================================================================
  // CLOUD MODE - REJECTION TESTS
  // ===========================================================================

  describe('Cloud Mode - Rejection', () => {
    it('should reject when entitlement is not enabled', async () => {
      const gate = createCloudCapabilityGate(
        'org_123',
        async () => false // All entitlements disabled
      );

      const result = await gate.checkCapability('rankedDiscovery');

      expect(result.allowed).toBe(false);
      expect(result.entitlement).toBe(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED);
    });

    it('should throw CapabilityNotEnabledError when requiring disabled capability', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('rankedDiscovery', 'RankedDiscoveryProvider')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });

    it('should include entitlement key in error message', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      try {
        await gate.requireCapability('rankedDiscovery', 'RankedDiscoveryProvider');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CapabilityNotEnabledError);
        const capError = error as CapabilityNotEnabledError;
        expect(capError.entitlement).toBe(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED);
        expect(capError.providerType).toBe('RankedDiscoveryProvider');
        expect(capError.message).toContain('gateway.discovery.ranked');
        expect(capError.message).toContain('RankedDiscoveryProvider');
      }
    });

    it('should include multiple missing entitlements in error', async () => {
      // Create a provider that requires multiple capabilities
      const gate = createCloudCapabilityGate('org_123', async () => false);

      // Add a custom provider with multiple requirements
      PROVIDER_REQUIRED_CAPABILITIES['TestMultiProvider'] = [
        'rankedDiscovery',
        'analytics',
      ];

      try {
        await gate.requireProviderCapabilities('TestMultiProvider');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CapabilityNotEnabledError);
        const capError = error as CapabilityNotEnabledError;
        expect(capError.missingEntitlements.length).toBeGreaterThanOrEqual(2);
        expect(capError.message).toContain('[');
      } finally {
        // Clean up
        delete PROVIDER_REQUIRED_CAPABILITIES['TestMultiProvider'];
      }
    });

    it('should reject cloud registry without entitlement', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('cloudRegistry', 'BetterDataRegistry')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });

    it('should reject analytics without entitlement', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('analytics', 'AnalyticsCollector')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });

    it('should reject automated verification without entitlement', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('automatedVerification', 'AutomatedVerificationProvider')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });

    it('should reject global federation without entitlement', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('globalFederation', 'GlobalFederationHub')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });

    it('should reject private federation without entitlement', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      await expect(
        gate.requireCapability('privateFederation', 'PrivateFederationHub')
      ).rejects.toThrow(CapabilityNotEnabledError);
    });
  });

  // ===========================================================================
  // CLOUD MODE - ALLOW TESTS
  // ===========================================================================

  describe('Cloud Mode - Allow', () => {
    it('should allow when entitlement is enabled', async () => {
      const gate = createCloudCapabilityGate(
        'org_123',
        async () => true // All entitlements enabled
      );

      const result = await gate.checkCapability('rankedDiscovery');

      expect(result.allowed).toBe(true);
      expect(result.entitlement).toBe(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED);
    });

    it('should not throw when requiring enabled capability', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => true);

      await expect(
        gate.requireCapability('rankedDiscovery', 'RankedDiscoveryProvider')
      ).resolves.not.toThrow();
    });

    it('should check specific entitlements', async () => {
      // Only allow ranked discovery
      const checkEntitlement = vi.fn(async (key: string) => {
        return key === GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED;
      });

      const gate = createCloudCapabilityGate('org_123', checkEntitlement);

      // Ranked discovery should be allowed
      const ranked = await gate.checkCapability('rankedDiscovery');
      expect(ranked.allowed).toBe(true);

      // Analytics should be denied
      const analytics = await gate.checkCapability('analytics');
      expect(analytics.allowed).toBe(false);

      // Verify entitlement checker was called with correct keys
      expect(checkEntitlement).toHaveBeenCalledWith(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED);
      expect(checkEntitlement).toHaveBeenCalledWith(GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED);
    });

    it('should allow unknown capabilities by default', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      const result = await gate.checkCapability('unknownCapability');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Unknown capability');
    });
  });

  // ===========================================================================
  // CACHING TESTS
  // ===========================================================================

  describe('Caching', () => {
    it('should cache entitlement check results', async () => {
      let callCount = 0;
      const checkEntitlement = vi.fn(async () => {
        callCount++;
        return true;
      });

      const gate = createCloudCapabilityGate('org_123', checkEntitlement);

      // First call
      await gate.checkCapability('rankedDiscovery');
      expect(callCount).toBe(1);

      // Second call - should use cache
      await gate.checkCapability('rankedDiscovery');
      expect(callCount).toBe(1);
    });

    it('should clear cache when requested', async () => {
      let callCount = 0;
      const checkEntitlement = vi.fn(async () => {
        callCount++;
        return true;
      });

      const gate = createCloudCapabilityGate('org_123', checkEntitlement);

      await gate.checkCapability('rankedDiscovery');
      expect(callCount).toBe(1);

      // Clear cache
      gate.clearCache();

      // Should call again
      await gate.checkCapability('rankedDiscovery');
      expect(callCount).toBe(2);
    });
  });

  // ===========================================================================
  // PROVIDER VALIDATION TESTS
  // ===========================================================================

  describe('Provider Validation', () => {
    it('should validate all required capabilities for a provider', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      const result = await gate.checkProviderCapabilities('RankedDiscoveryProvider');

      expect(result.allowed).toBe(false);
      expect(result.missingCapabilities).toContain('rankedDiscovery');
      expect(result.missingEntitlements).toContain(GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED);
    });

    it('should allow providers with no requirements', async () => {
      const gate = createCloudCapabilityGate('org_123', async () => false);

      const result = await gate.checkProviderCapabilities('UnknownProvider');

      expect(result.allowed).toBe(true);
      expect(result.missingCapabilities).toHaveLength(0);
    });

    it('should list all known provider types with requirements', () => {
      const providerTypes = Object.keys(PROVIDER_REQUIRED_CAPABILITIES);

      expect(providerTypes).toContain('BetterDataRegistry');
      expect(providerTypes).toContain('RankedDiscoveryProvider');
      expect(providerTypes).toContain('AnalyticsCollector');
      expect(providerTypes).toContain('GlobalFederationHub');
    });
  });

  // ===========================================================================
  // ENTITLEMENT MAPPING TESTS
  // ===========================================================================

  describe('Entitlement Mapping', () => {
    it('should map all capabilities to entitlements', () => {
      expect(CAPABILITY_ENTITLEMENT_MAP.cloudRegistry).toBe(
        GATEWAY_ENTITLEMENT_KEYS.REGISTRY_CLOUD
      );
      expect(CAPABILITY_ENTITLEMENT_MAP.rankedDiscovery).toBe(
        GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED
      );
      expect(CAPABILITY_ENTITLEMENT_MAP.automatedVerification).toBe(
        GATEWAY_ENTITLEMENT_KEYS.VERIFICATION_AUTOMATED
      );
      expect(CAPABILITY_ENTITLEMENT_MAP.analytics).toBe(
        GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED
      );
      expect(CAPABILITY_ENTITLEMENT_MAP.globalFederation).toBe(
        GATEWAY_ENTITLEMENT_KEYS.FEDERATION_GLOBAL
      );
      expect(CAPABILITY_ENTITLEMENT_MAP.privateFederation).toBe(
        GATEWAY_ENTITLEMENT_KEYS.FEDERATION_PRIVATE
      );
    });
  });

  // ===========================================================================
  // ERROR STRUCTURE TESTS
  // ===========================================================================

  describe('Error Structure', () => {
    it('should have correct error code', () => {
      const error = new CapabilityNotEnabledError(
        'rankedDiscovery',
        'gateway.discovery.ranked',
        'RankedDiscoveryProvider'
      );

      expect(error.code).toBe('CAPABILITY_NOT_ENABLED');
      expect(error.name).toBe('CapabilityNotEnabledError');
    });

    it('should include all required fields', () => {
      const error = new CapabilityNotEnabledError(
        'rankedDiscovery',
        'gateway.discovery.ranked',
        'RankedDiscoveryProvider',
        ['gateway.discovery.ranked', 'gateway.analytics.enabled']
      );

      expect(error.capability).toBe('rankedDiscovery');
      expect(error.entitlement).toBe('gateway.discovery.ranked');
      expect(error.providerType).toBe('RankedDiscoveryProvider');
      expect(error.missingEntitlements).toEqual([
        'gateway.discovery.ranked',
        'gateway.analytics.enabled',
      ]);
    });

    it('should format message correctly for single missing entitlement', () => {
      const error = new CapabilityNotEnabledError(
        'analytics',
        'gateway.analytics.enabled',
        'AnalyticsCollector'
      );

      expect(error.message).toContain('AnalyticsCollector');
      expect(error.message).toContain('gateway.analytics.enabled');
      expect(error.message).not.toContain('[');
    });

    it('should format message correctly for multiple missing entitlements', () => {
      const error = new CapabilityNotEnabledError(
        'analytics',
        'gateway.analytics.enabled',
        'CompositeProvider',
        ['gateway.analytics.enabled', 'gateway.discovery.ranked']
      );

      expect(error.message).toContain('CompositeProvider');
      expect(error.message).toContain('[');
      expect(error.message).toContain('gateway.analytics.enabled');
      expect(error.message).toContain('gateway.discovery.ranked');
    });
  });
});

