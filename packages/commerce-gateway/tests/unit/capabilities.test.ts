/**
 * @betterdata/llm-gateway - Capability Discovery Tests
 *
 * Tests for:
 * - Default capabilities when no providers implement getCapabilities()
 * - Capability merging from multiple providers
 * - Caching behavior
 * - Type guards and utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FederationHub } from '../../src/federation/hub';
import { MemoryMerchantRegistry } from '../../src/federation/registry/memory';
import { StaticDiscoveryProvider } from '../../src/federation/discovery/static';
import { TagBasedDiscoveryProvider } from '../../src/federation/discovery/tag-based';
import { NoopAnalyticsSink } from '../../src/federation/analytics/noop';
import {
  hasCapabilities,
  isValidCapabilities,
  mergeCapabilities,
  defaultCapabilities,
  DEFAULT_CAPABILITIES,
  OSS_CAPABILITIES,
  type GatewayCapabilities,
  type CapabilityProvider,
} from '../../src/capabilities';

// ============================================================================
// Type Guards Tests
// ============================================================================

describe('hasCapabilities', () => {
  it('returns true for objects with getCapabilities method', () => {
    const provider = {
      getCapabilities: async () => DEFAULT_CAPABILITIES,
    };
    expect(hasCapabilities(provider)).toBe(true);
  });

  it('returns false for objects without getCapabilities', () => {
    const notProvider = { someOtherMethod: () => {} };
    expect(hasCapabilities(notProvider)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasCapabilities(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasCapabilities(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(hasCapabilities('string')).toBe(false);
    expect(hasCapabilities(123)).toBe(false);
    expect(hasCapabilities(true)).toBe(false);
  });
});

describe('isValidCapabilities', () => {
  it('returns true for valid capabilities object', () => {
    expect(isValidCapabilities(DEFAULT_CAPABILITIES)).toBe(true);
    expect(isValidCapabilities(OSS_CAPABILITIES)).toBe(true);
  });

  it('returns false for missing specVersion', () => {
    const invalid = { ...DEFAULT_CAPABILITIES };
    delete (invalid as any).specVersion;
    expect(isValidCapabilities(invalid)).toBe(false);
  });

  it('returns false for missing features', () => {
    const invalid = { ...DEFAULT_CAPABILITIES };
    delete (invalid as any).features;
    expect(isValidCapabilities(invalid)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidCapabilities(null)).toBe(false);
  });
});

// ============================================================================
// defaultCapabilities Tests
// ============================================================================

describe('defaultCapabilities', () => {
  it('returns capabilities with specified version', () => {
    const caps = defaultCapabilities('2.0.0');
    expect(caps.gatewayVersion).toBe('2.0.0');
    expect(caps.specVersion).toBe('2025-12-22');
  });

  it('has conservative defaults (most features disabled)', () => {
    const caps = defaultCapabilities('1.0.0');
    expect(caps.features.registry.merchantWrite).toBe(false);
    expect(caps.features.registry.verificationAutomation).toBe(false);
    expect(caps.features.discovery.rankedResults).toBe(false);
    expect(caps.features.analytics.events).toEqual([]);
    expect(caps.features.analytics.realtime).toBe(false);
  });

  it('has basic filtering enabled', () => {
    const caps = defaultCapabilities('1.0.0');
    expect(caps.features.discovery.supportsFilters).toBe(true);
    expect(caps.features.discovery.supportsPagination).toBe(true);
  });
});

// ============================================================================
// mergeCapabilities Tests
// ============================================================================

describe('mergeCapabilities', () => {
  it('returns defaults for empty array', () => {
    const merged = mergeCapabilities([]);
    expect(merged).toEqual(DEFAULT_CAPABILITIES);
  });

  it('returns single source unchanged', () => {
    const source = OSS_CAPABILITIES;
    const merged = mergeCapabilities([source]);
    expect(merged).toEqual(source);
  });

  it('uses AND logic for boolean capabilities', () => {
    const source1: GatewayCapabilities = {
      ...DEFAULT_CAPABILITIES,
      features: {
        ...DEFAULT_CAPABILITIES.features,
        registry: {
          merchantWrite: true,
          verificationAutomation: true,
          supportsPrivateHubs: false,
        },
      },
    };
    const source2: GatewayCapabilities = {
      ...DEFAULT_CAPABILITIES,
      features: {
        ...DEFAULT_CAPABILITIES.features,
        registry: {
          merchantWrite: true,
          verificationAutomation: false, // This one is false
          supportsPrivateHubs: true,
        },
      },
    };

    const merged = mergeCapabilities([source1, source2]);

    // AND logic: true only if both are true
    expect(merged.features.registry.merchantWrite).toBe(true);
    expect(merged.features.registry.verificationAutomation).toBe(false);
    expect(merged.features.registry.supportsPrivateHubs).toBe(false);
  });

  it('uses intersection for event arrays', () => {
    const source1: GatewayCapabilities = {
      ...DEFAULT_CAPABILITIES,
      features: {
        ...DEFAULT_CAPABILITIES.features,
        analytics: {
          events: ['search', 'click', 'checkout'],
          realtime: true,
        },
      },
    };
    const source2: GatewayCapabilities = {
      ...DEFAULT_CAPABILITIES,
      features: {
        ...DEFAULT_CAPABILITIES.features,
        analytics: {
          events: ['search', 'add_to_cart'],
          realtime: false,
        },
      },
    };

    const merged = mergeCapabilities([source1, source2]);

    // Intersection: only 'search' is in both
    expect(merged.features.analytics.events).toEqual(['search']);
    expect(merged.features.analytics.realtime).toBe(false);
  });
});

// ============================================================================
// OSS Provider Capability Tests
// ============================================================================

describe('MemoryMerchantRegistry capabilities', () => {
  it('implements CapabilityProvider', () => {
    const registry = new MemoryMerchantRegistry();
    expect(hasCapabilities(registry)).toBe(true);
  });

  it('returns accurate capabilities', async () => {
    const registry = new MemoryMerchantRegistry();
    const caps = await registry.getCapabilities();

    expect(caps.specVersion).toBe('2025-12-22');
    expect(caps.features.registry.merchantWrite).toBe(true);
    expect(caps.features.registry.verificationAutomation).toBe(false);
    expect(caps.features.discovery.rankedResults).toBe(false);
  });
});

describe('StaticDiscoveryProvider capabilities', () => {
  it('implements CapabilityProvider', () => {
    const registry = new MemoryMerchantRegistry();
    const provider = new StaticDiscoveryProvider(registry);
    expect(hasCapabilities(provider)).toBe(true);
  });

  it('returns accurate capabilities', async () => {
    const registry = new MemoryMerchantRegistry();
    const provider = new StaticDiscoveryProvider(registry);
    const caps = await provider.getCapabilities();

    expect(caps.features.discovery.rankedResults).toBe(false);
    expect(caps.features.discovery.supportsFilters).toBe(true);
    expect(caps.features.discovery.supportsTagSearch).toBe(false);
  });
});

describe('TagBasedDiscoveryProvider capabilities', () => {
  it('implements CapabilityProvider', () => {
    const registry = new MemoryMerchantRegistry();
    const provider = new TagBasedDiscoveryProvider(registry);
    expect(hasCapabilities(provider)).toBe(true);
  });

  it('returns accurate capabilities', async () => {
    const registry = new MemoryMerchantRegistry();
    const provider = new TagBasedDiscoveryProvider(registry);
    const caps = await provider.getCapabilities();

    expect(caps.features.discovery.rankedResults).toBe(false);
    expect(caps.features.discovery.supportsFilters).toBe(true);
    expect(caps.features.discovery.supportsTagSearch).toBe(true);
  });
});

describe('NoopAnalyticsSink capabilities', () => {
  it('implements CapabilityProvider', () => {
    const sink = new NoopAnalyticsSink();
    expect(hasCapabilities(sink)).toBe(true);
  });

  it('returns accurate capabilities (empty events)', async () => {
    const sink = new NoopAnalyticsSink();
    const caps = await sink.getCapabilities();

    expect(caps.features.analytics.events).toEqual([]);
    expect(caps.features.analytics.realtime).toBe(false);
  });
});

// ============================================================================
// FederationHub.getCapabilities Tests
// ============================================================================

describe('FederationHub.getCapabilities', () => {
  it('returns defaults when no providers implement getCapabilities', async () => {
    // Create a mock registry that doesn't implement getCapabilities
    const mockRegistry = {
      get: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),
      findByAlias: vi.fn(),
      findByCategory: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      search: vi.fn(),
      updateTier: vi.fn(),
      has: vi.fn(),
      count: vi.fn(),
      // No getCapabilities method!
    };

    const hub = await FederationHub.create({
      registry: mockRegistry as any,
      discovery: { type: 'static' },
    });

    const caps = await hub.getCapabilities();

    expect(caps.specVersion).toBe('2025-12-22');
    expect(isValidCapabilities(caps)).toBe(true);
  });

  it('merges capabilities from registry + discovery', async () => {
    const registry = new MemoryMerchantRegistry();
    const discovery = new TagBasedDiscoveryProvider(registry);

    const hub = await FederationHub.create({
      registry,
      discovery,
    });

    const caps = await hub.getCapabilities();

    // Both have rankedResults: false
    expect(caps.features.discovery.rankedResults).toBe(false);
    // Both have supportsFilters: true
    expect(caps.features.discovery.supportsFilters).toBe(true);
    // Both have supportsPagination: true
    expect(caps.features.discovery.supportsPagination).toBe(true);
    // Merged: TagBased has supportsTagSearch: true, Registry has true
    expect(caps.features.discovery.supportsTagSearch).toBe(true);
    // Merged: Registry has merchantWrite: true, but Discovery has false
    // AND logic means result is false (most restrictive)
    // This is correct behavior - discovery shouldn't grant registry writes
    expect(caps.features.registry.merchantWrite).toBe(false);
  });

  it('caches capabilities (second call does not call providers again)', async () => {
    const registry = new MemoryMerchantRegistry();
    const getCapsSpy = vi.spyOn(registry, 'getCapabilities');

    const hub = await FederationHub.create({
      registry,
      discovery: { type: 'static' },
    });

    // First call
    await hub.getCachedCapabilities();
    expect(getCapsSpy).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    await hub.getCachedCapabilities();
    expect(getCapsSpy).toHaveBeenCalledTimes(1); // Still 1!

    // Clear cache
    hub.clearCapabilitiesCache();

    // Third call - should fetch again
    await hub.getCachedCapabilities();
    expect(getCapsSpy).toHaveBeenCalledTimes(2);
  });

  it('includes gateway version', async () => {
    const hub = await FederationHub.create({
      registry: { type: 'memory' },
      discovery: { type: 'static' },
    });

    const caps = await hub.getCapabilities();

    expect(caps.gatewayVersion).toBeDefined();
    expect(typeof caps.gatewayVersion).toBe('string');
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Capability Constants', () => {
  it('DEFAULT_CAPABILITIES is valid', () => {
    expect(isValidCapabilities(DEFAULT_CAPABILITIES)).toBe(true);
    expect(DEFAULT_CAPABILITIES.specVersion).toBe('2025-12-22');
  });

  it('OSS_CAPABILITIES is valid', () => {
    expect(isValidCapabilities(OSS_CAPABILITIES)).toBe(true);
    expect(OSS_CAPABILITIES.specVersion).toBe('2025-12-22');
  });

  it('OSS_CAPABILITIES has merchantWrite enabled', () => {
    expect(OSS_CAPABILITIES.features.registry.merchantWrite).toBe(true);
  });

  it('OSS_CAPABILITIES has basic analytics events', () => {
    expect(OSS_CAPABILITIES.features.analytics.events).toContain('search');
    expect(OSS_CAPABILITIES.features.analytics.events).toContain('click');
  });
});

