/**
 * Capability Gate
 *
 * Validates provider creation against gateway entitlements.
 * Rejects unsupported provider creation with clear error messages.
 *
 * OSS mode bypasses all checks - this is Cloud-only enforcement.
 *
 * @example
 * ```typescript
 * const gate = new CapabilityGate({
 *   isCloud: true,
 *   checkEntitlement: async (key) => hasFeature(entitlements, key),
 * });
 *
 * // This will throw if gateway.discovery.ranked is not enabled
 * await gate.requireCapability('rankedDiscovery', 'RankedDiscoveryProvider');
 * ```
 */

import { GATEWAY_ENTITLEMENT_KEYS, type GatewayEntitlementKey } from './capability-discovery';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Capability gate configuration.
 */
export interface CapabilityGateConfig {
  /**
   * Whether this is a Cloud deployment.
   * If false, all capability checks pass (OSS bypass).
   */
  isCloud: boolean;

  /**
   * Function to check if an entitlement is enabled.
   * Only called in Cloud mode.
   */
  checkEntitlement?: (key: string) => Promise<boolean>;

  /**
   * Organization ID for error messages.
   */
  organizationId?: string;

  /**
   * Enable debug logging.
   */
  debug?: boolean;
}

/**
 * Capability check result.
 */
export interface CapabilityCheckResult {
  allowed: boolean;
  capability: string;
  entitlement: string;
  reason: string;
}

/**
 * Error thrown when a capability is not enabled.
 */
export class CapabilityNotEnabledError extends Error {
  public readonly code = 'CAPABILITY_NOT_ENABLED';
  public readonly capability: string;
  public readonly entitlement: string;
  public readonly providerType: string;
  public readonly missingEntitlements: string[];

  constructor(
    capability: string,
    entitlement: string,
    providerType: string,
    missingEntitlements: string[] = []
  ) {
    const message = missingEntitlements.length > 1
      ? `Cannot create ${providerType}: Missing entitlements [${missingEntitlements.join(', ')}]`
      : `Cannot create ${providerType}: Missing entitlement "${entitlement}"`;

    super(message);
    this.name = 'CapabilityNotEnabledError';
    this.capability = capability;
    this.entitlement = entitlement;
    this.providerType = providerType;
    this.missingEntitlements = missingEntitlements.length > 0 ? missingEntitlements : [entitlement];
  }
}

// =============================================================================
// CAPABILITY DEFINITIONS
// =============================================================================

/**
 * Capability to entitlement mapping.
 */
export const CAPABILITY_ENTITLEMENT_MAP: Record<string, GatewayEntitlementKey> = {
  // Registry capabilities
  cloudRegistry: GATEWAY_ENTITLEMENT_KEYS.REGISTRY_CLOUD,

  // Discovery capabilities
  rankedDiscovery: GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED,

  // Verification capabilities
  automatedVerification: GATEWAY_ENTITLEMENT_KEYS.VERIFICATION_AUTOMATED,

  // Analytics capabilities
  analytics: GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED,

  // Federation capabilities
  globalFederation: GATEWAY_ENTITLEMENT_KEYS.FEDERATION_GLOBAL,
  privateFederation: GATEWAY_ENTITLEMENT_KEYS.FEDERATION_PRIVATE,
};

/**
 * Provider type to required capabilities mapping.
 */
export const PROVIDER_REQUIRED_CAPABILITIES: Record<string, string[]> = {
  // Registry providers
  BetterDataRegistry: ['cloudRegistry'],
  CloudMerchantRegistry: ['cloudRegistry'],

  // Discovery providers
  RankedDiscoveryProvider: ['rankedDiscovery'],
  MLDiscoveryProvider: ['rankedDiscovery'],
  BetterDataDiscovery: ['rankedDiscovery'],

  // Verification providers
  AutomatedVerificationProvider: ['automatedVerification'],
  BetterDataVerification: ['automatedVerification'],

  // Analytics providers
  AnalyticsCollector: ['analytics'],
  BetterDataAnalytics: ['analytics'],
  RealtimeAnalytics: ['analytics'],

  // Federation providers
  GlobalFederationHub: ['globalFederation'],
  PrivateFederationHub: ['privateFederation'],
};

// =============================================================================
// CAPABILITY GATE
// =============================================================================

/**
 * Capability Gate
 *
 * Validates provider creation against gateway entitlements.
 */
export class CapabilityGate {
  private config: CapabilityGateConfig;
  private cache = new Map<string, boolean>();

  constructor(config: CapabilityGateConfig) {
    this.config = config;
  }

  /**
   * Check if a capability is enabled.
   */
  async checkCapability(capability: string): Promise<CapabilityCheckResult> {
    const entitlement = CAPABILITY_ENTITLEMENT_MAP[capability];

    if (!entitlement) {
      return {
        allowed: true,
        capability,
        entitlement: 'N/A',
        reason: 'Unknown capability, allowing by default',
      };
    }

    // OSS bypass - all capabilities allowed
    if (!this.config.isCloud) {
      if (this.config.debug) {
        console.log(`[CapabilityGate] OSS mode: bypassing check for ${capability}`);
      }
      return {
        allowed: true,
        capability,
        entitlement,
        reason: 'OSS mode - all capabilities allowed',
      };
    }

    // Check cache
    const cacheKey = `${this.config.organizationId}:${entitlement}`;
    if (this.cache.has(cacheKey)) {
      const allowed = this.cache.get(cacheKey)!;
      return {
        allowed,
        capability,
        entitlement,
        reason: allowed ? 'Entitlement enabled (cached)' : 'Entitlement not enabled (cached)',
      };
    }

    // Check entitlement
    if (!this.config.checkEntitlement) {
      return {
        allowed: false,
        capability,
        entitlement,
        reason: 'No entitlement checker configured',
      };
    }

    const allowed = await this.config.checkEntitlement(entitlement);
    this.cache.set(cacheKey, allowed);

    if (this.config.debug) {
      console.log(
        `[CapabilityGate] ${capability} (${entitlement}): ${allowed ? 'ALLOWED' : 'DENIED'}`
      );
    }

    return {
      allowed,
      capability,
      entitlement,
      reason: allowed ? 'Entitlement enabled' : 'Entitlement not enabled',
    };
  }

  /**
   * Require a capability to be enabled.
   * Throws CapabilityNotEnabledError if not enabled.
   */
  async requireCapability(capability: string, providerType: string): Promise<void> {
    const result = await this.checkCapability(capability);

    if (!result.allowed) {
      throw new CapabilityNotEnabledError(
        capability,
        result.entitlement,
        providerType
      );
    }
  }

  /**
   * Check if all required capabilities for a provider are enabled.
   */
  async checkProviderCapabilities(providerType: string): Promise<{
    allowed: boolean;
    missingCapabilities: string[];
    missingEntitlements: string[];
  }> {
    const requiredCapabilities = PROVIDER_REQUIRED_CAPABILITIES[providerType] || [];

    if (requiredCapabilities.length === 0) {
      return { allowed: true, missingCapabilities: [], missingEntitlements: [] };
    }

    const results = await Promise.all(
      requiredCapabilities.map(async (cap) => ({
        capability: cap,
        result: await this.checkCapability(cap),
      }))
    );

    const missing = results.filter((r) => !r.result.allowed);

    return {
      allowed: missing.length === 0,
      missingCapabilities: missing.map((m) => m.capability),
      missingEntitlements: missing.map((m) => m.result.entitlement),
    };
  }

  /**
   * Require all capabilities for a provider.
   * Throws CapabilityNotEnabledError with all missing entitlements.
   */
  async requireProviderCapabilities(providerType: string): Promise<void> {
    const result = await this.checkProviderCapabilities(providerType);

    if (!result.allowed) {
      throw new CapabilityNotEnabledError(
        result.missingCapabilities[0] || 'unknown',
        result.missingEntitlements[0] || 'unknown',
        providerType,
        result.missingEntitlements
      );
    }
  }

  /**
   * Clear the entitlement cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if running in OSS mode.
   */
  isOSSMode(): boolean {
    return !this.config.isCloud;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a capability gate for Cloud deployments.
 */
export function createCloudCapabilityGate(
  organizationId: string,
  checkEntitlement: (key: string) => Promise<boolean>,
  options?: { debug?: boolean }
): CapabilityGate {
  return new CapabilityGate({
    isCloud: true,
    organizationId,
    checkEntitlement,
    debug: options?.debug,
  });
}

/**
 * Create a capability gate for OSS deployments (bypasses all checks).
 */
export function createOSSCapabilityGate(options?: { debug?: boolean }): CapabilityGate {
  return new CapabilityGate({
    isCloud: false,
    debug: options?.debug,
  });
}

/**
 * Default OSS gate instance (singleton for convenience).
 */
export const OSS_CAPABILITY_GATE = new CapabilityGate({ isCloud: false });

