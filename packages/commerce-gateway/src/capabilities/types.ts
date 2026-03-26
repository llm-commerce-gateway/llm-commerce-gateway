/**
 * @betterdata/commerce-gateway - Gateway Capabilities Schema
 *
 * Runtime capability discovery for federated gateways.
 * Enables clients to query what features a gateway supports and gracefully degrade.
 *
 * @example
 * ```typescript
 * import type { GatewayCapabilities, CapabilityProvider } from '@betterdata/commerce-gateway';
 *
 * // Check capabilities at runtime
 * const caps = await hub.getCapabilities();
 *
 * if (caps.features.discovery.rankedResults) {
 *   // Use ranked discovery
 * } else {
 *   console.warn('Ranked results not supported; using default sort');
 * }
 * ```
 *
 * @license Apache-2.0
 */

// ============================================================================
// Capability Schema (Versioned)
// ============================================================================

/**
 * Gateway capabilities schema.
 *
 * This schema is versioned via `specVersion` to allow safe evolution.
 * Clients should check `specVersion` and handle unknown versions gracefully.
 *
 * ## Version History
 *
 * - `2025-12-22`: Initial release
 *
 * @example
 * ```typescript
 * const caps: GatewayCapabilities = {
 *   specVersion: '2025-12-22',
 *   gatewayVersion: '1.1.0',
 *   features: {
 *     registry: {
 *       merchantWrite: true,
 *       verificationAutomation: false,
 *       supportsPrivateHubs: false,
 *     },
 *     discovery: {
 *       rankedResults: false,
 *       supportsFilters: true,
 *       supportsPagination: true,
 *       supportsTagSearch: true,
 *     },
 *     analytics: {
 *       events: ['search', 'click'],
 *       realtime: false,
 *     },
 *     verification: {
 *       dnsTxt: true,
 *       metaTag: true,
 *       callbackChallenge: true,
 *       manualReview: false,
 *     },
 *   },
 * };
 * ```
 */
export interface GatewayCapabilities {
  /**
   * Schema version for the capabilities format.
   * Clients should check this before parsing features.
   *
   * Format: YYYY-MM-DD (date of schema introduction)
   */
  specVersion: '2025-12-22';

  /**
   * Version of the @betterdata/commerce-gateway package.
   * Follows semver (e.g., "1.1.0").
   */
  gatewayVersion: string;

  /**
   * Feature flags organized by domain.
   */
  features: {
    /**
     * Merchant registry capabilities.
     */
    registry: {
      /** Can register/update merchants (vs read-only) */
      merchantWrite: boolean;

      /** Supports automated DNS/meta verification */
      verificationAutomation: boolean;

      /** Supports private customer hubs (not just global) */
      supportsPrivateHubs: boolean;
    };

    /**
     * Discovery and search capabilities.
     */
    discovery: {
      /** Returns ranked/scored results (vs simple list) */
      rankedResults: boolean;

      /** Supports filter parameters (price, category, etc.) */
      supportsFilters: boolean;

      /** Supports pagination (limit/offset) */
      supportsPagination: boolean;

      /** Supports tag-based search */
      supportsTagSearch: boolean;
    };

    /**
     * Analytics and event tracking capabilities.
     */
    analytics: {
      /**
       * List of supported event types.
       * Empty array means no analytics support.
       *
       * Common events: "search", "click", "add_to_cart", "checkout", "verify"
       */
      events: string[];

      /** Supports realtime event streaming (vs batch) */
      realtime: boolean;
    };

    /**
     * Merchant verification capabilities.
     */
    verification: {
      /** Supports DNS TXT record verification */
      dnsTxt: boolean;

      /** Supports HTML meta tag verification */
      metaTag: boolean;

      /** Supports callback challenge verification */
      callbackChallenge: boolean;

      /** Supports manual review verification */
      manualReview: boolean;
    };
  };
}

// ============================================================================
// Default Capabilities (Conservative)
// ============================================================================

/**
 * Create default capabilities with conservative defaults.
 *
 * Use this when a provider doesn't implement capability discovery.
 * Most features are disabled to prevent clients from assuming
 * features that don't exist.
 *
 * @param gatewayVersion - The gateway version string
 * @returns GatewayCapabilities with conservative defaults
 *
 * @example
 * ```typescript
 * const caps = defaultCapabilities('1.1.0');
 * // caps.features.discovery.rankedResults === false
 * ```
 */
export function defaultCapabilities(gatewayVersion: string): GatewayCapabilities {
  return {
    specVersion: '2025-12-22',
    gatewayVersion,
    features: {
      registry: {
        merchantWrite: false,
        verificationAutomation: false,
        supportsPrivateHubs: false,
      },
      discovery: {
        rankedResults: false,
        supportsFilters: true,
        supportsPagination: true,
        supportsTagSearch: true,
      },
      analytics: {
        events: [],
        realtime: false,
      },
      verification: {
        dnsTxt: true,
        metaTag: true,
        callbackChallenge: true,
        manualReview: false,
      },
    },
  };
}

/**
 * Default capabilities returned when a provider doesn't implement capability discovery.
 *
 * These are intentionally conservative (most features disabled) to prevent
 * clients from assuming features that don't exist.
 */
export const DEFAULT_CAPABILITIES: GatewayCapabilities = {
  specVersion: '2025-12-22',
  gatewayVersion: '1.0.0', // Will be overwritten at runtime
  features: {
    registry: {
      merchantWrite: false,
      verificationAutomation: false,
      supportsPrivateHubs: false,
    },
    discovery: {
      rankedResults: false,
      supportsFilters: true, // Basic filtering is supported in OSS
      supportsPagination: true, // Basic pagination is supported in OSS
      supportsTagSearch: true, // Tag-based is the default OSS discovery
    },
    analytics: {
      events: [], // No analytics in OSS by default
      realtime: false,
    },
    verification: {
      dnsTxt: true, // All OSS gateways can do DNS checks
      metaTag: true, // All OSS gateways can do meta tag checks
      callbackChallenge: true, // All OSS gateways can do callback challenge
      manualReview: false, // Manual review requires cloud
    },
  },
};

// ============================================================================
// OSS Capabilities (Full OSS Feature Set)
// ============================================================================

/**
 * Capabilities for a fully-featured OSS gateway.
 *
 * Use this as a starting point when implementing your own CapabilityProvider.
 */
export const OSS_CAPABILITIES: GatewayCapabilities = {
  specVersion: '2025-12-22',
  gatewayVersion: '1.0.0', // Will be overwritten at runtime
  features: {
    registry: {
      merchantWrite: true, // Can register merchants locally
      verificationAutomation: false, // Requires cloud for automation
      supportsPrivateHubs: false, // Private hubs require cloud
    },
    discovery: {
      rankedResults: false, // ML ranking requires cloud
      supportsFilters: true,
      supportsPagination: true,
      supportsTagSearch: true,
    },
    analytics: {
      events: ['search', 'click'], // Basic events
      realtime: false, // Realtime requires cloud
    },
    verification: {
      dnsTxt: true,
      metaTag: true,
      callbackChallenge: true,
      manualReview: false,
    },
  },
};

// ============================================================================
// Capability Provider Interface
// ============================================================================

/**
 * Interface for providers that can report their capabilities.
 *
 * Implementing this interface is **optional**. If a provider doesn't implement it,
 * the gateway will return conservative defaults.
 *
 * ## Implementation Guidelines
 *
 * 1. Only report capabilities your provider actually supports
 * 2. Return consistent results (don't change capabilities at runtime)
 * 3. Use the correct `specVersion` for the schema you're implementing
 *
 * @example
 * ```typescript
 * import type { CapabilityProvider, GatewayCapabilities } from '@betterdata/commerce-gateway';
 *
 * class MyCloudRegistry implements MerchantRegistry, CapabilityProvider {
 *   async getCapabilities(): Promise<GatewayCapabilities> {
 *     return {
 *       specVersion: '2025-12-22',
 *       gatewayVersion: '1.1.0',
 *       features: {
 *         registry: {
 *           merchantWrite: true,
 *           verificationAutomation: true, // Cloud feature
 *           supportsPrivateHubs: true,    // Cloud feature
 *         },
 *         discovery: {
 *           rankedResults: true,          // Cloud feature
 *           supportsFilters: true,
 *           supportsPagination: true,
 *           supportsTagSearch: true,
 *         },
 *         analytics: {
 *           events: ['search', 'click', 'add_to_cart', 'checkout', 'verify'],
 *           realtime: true,               // Cloud feature
 *         },
 *         verification: {
 *           dnsTxt: true,
 *           metaTag: true,
 *           callbackChallenge: true,
 *           manualReview: true,           // Cloud feature
 *         },
 *       },
 *     };
 *   }
 * }
 * ```
 */
export interface CapabilityProvider {
  /**
   * Get the capabilities supported by this provider.
   *
   * @returns Promise resolving to the provider's capabilities
   */
  getCapabilities(): Promise<GatewayCapabilities>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an object implements the CapabilityProvider interface.
 *
 * Use this to safely check if a provider supports capability discovery
 * before calling `getCapabilities()`.
 *
 * @param x - Object to check
 * @returns true if the object has a getCapabilities method
 *
 * @example
 * ```typescript
 * if (hasCapabilities(registry)) {
 *   const caps = await registry.getCapabilities();
 *   console.log('Registry supports:', caps.features.registry);
 * } else {
 *   console.log('Registry does not support capability discovery');
 * }
 * ```
 */
export function hasCapabilities(x: unknown): x is CapabilityProvider {
  return (
    x !== null &&
    typeof x === 'object' &&
    'getCapabilities' in x &&
    typeof (x as Record<string, unknown>).getCapabilities === 'function'
  );
}

/**
 * Validate that a capabilities object matches the expected schema.
 *
 * @param caps - Capabilities object to validate
 * @returns true if valid, false otherwise
 */
export function isValidCapabilities(caps: unknown): caps is GatewayCapabilities {
  if (!caps || typeof caps !== 'object') return false;

  const c = caps as Record<string, unknown>;

  // Check required top-level fields
  if (typeof c.specVersion !== 'string') return false;
  if (typeof c.gatewayVersion !== 'string') return false;
  if (!c.features || typeof c.features !== 'object') return false;

  const features = c.features as Record<string, unknown>;

  // Check required feature groups
  const requiredGroups = ['registry', 'discovery', 'analytics', 'verification'];
  for (const group of requiredGroups) {
    if (!features[group] || typeof features[group] !== 'object') return false;
  }

  return true;
}

// ============================================================================
// Capability Merging
// ============================================================================

/**
 * Merge multiple capability objects, taking the intersection.
 *
 * For boolean capabilities: result is true only if ALL sources are true.
 * For array capabilities: result is intersection of all sources.
 *
 * Use this when aggregating capabilities from multiple providers.
 *
 * @param sources - Array of capability objects to merge
 * @returns Merged capabilities
 */
export function mergeCapabilities(
  sources: GatewayCapabilities[]
): GatewayCapabilities {
  if (sources.length === 0) {
    return { ...DEFAULT_CAPABILITIES };
  }

  if (sources.length === 1) {
    return sources[0]!;
  }

  // Start with the first source
  const result: GatewayCapabilities = JSON.parse(JSON.stringify(sources[0]));

  // Merge remaining sources (intersection)
  for (let i = 1; i < sources.length; i++) {
    const source = sources[i]!;

    // Registry
    result.features.registry.merchantWrite =
      result.features.registry.merchantWrite && source.features.registry.merchantWrite;
    result.features.registry.verificationAutomation =
      result.features.registry.verificationAutomation && source.features.registry.verificationAutomation;
    result.features.registry.supportsPrivateHubs =
      result.features.registry.supportsPrivateHubs && source.features.registry.supportsPrivateHubs;

    // Discovery
    result.features.discovery.rankedResults =
      result.features.discovery.rankedResults && source.features.discovery.rankedResults;
    result.features.discovery.supportsFilters =
      result.features.discovery.supportsFilters && source.features.discovery.supportsFilters;
    result.features.discovery.supportsPagination =
      result.features.discovery.supportsPagination && source.features.discovery.supportsPagination;
    result.features.discovery.supportsTagSearch =
      result.features.discovery.supportsTagSearch && source.features.discovery.supportsTagSearch;

    // Analytics (intersection of events)
    result.features.analytics.events = result.features.analytics.events.filter(
      (event) => source.features.analytics.events.includes(event)
    );
    result.features.analytics.realtime =
      result.features.analytics.realtime && source.features.analytics.realtime;

    // Verification
    result.features.verification.dnsTxt =
      result.features.verification.dnsTxt && source.features.verification.dnsTxt;
    result.features.verification.metaTag =
      result.features.verification.metaTag && source.features.verification.metaTag;
    result.features.verification.callbackChallenge =
      result.features.verification.callbackChallenge && source.features.verification.callbackChallenge;
    result.features.verification.manualReview =
      result.features.verification.manualReview && source.features.verification.manualReview;
  }

  return result;
}

