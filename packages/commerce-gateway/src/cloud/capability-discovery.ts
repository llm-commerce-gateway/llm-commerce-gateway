/**
 * Cloud Capability Discovery
 *
 * Provides entitlement-based capability discovery for Better Data Cloud.
 * OSS gateway ignores entitlements entirely - this module is Cloud-only.
 *
 * @see docs/internal/gateway/CAPABILITY_NEGOTIATION.md
 */

import type { GatewayCapabilities, CapabilityProvider } from '../capabilities/types';
import { OSS_CAPABILITIES } from '../capabilities/types';
import { VERSION } from '../version';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Gateway capability entitlement keys (from @repo/database)
 * These are duplicated here to avoid requiring @repo/database as a dependency
 * in the OSS package. Cloud deployments should use the real values.
 */
export const GATEWAY_ENTITLEMENT_KEYS = {
  REGISTRY_CLOUD: 'gateway.registry.cloud',
  DISCOVERY_RANKED: 'gateway.discovery.ranked',
  VERIFICATION_AUTOMATED: 'gateway.verification.automated',
  ANALYTICS_ENABLED: 'gateway.analytics.enabled',
  FEDERATION_GLOBAL: 'gateway.federation.global',
  FEDERATION_PRIVATE: 'gateway.federation.private',
} as const;

export type GatewayEntitlementKey =
  (typeof GATEWAY_ENTITLEMENT_KEYS)[keyof typeof GATEWAY_ENTITLEMENT_KEYS];

/**
 * Entitlement check function type.
 * Cloud deployments provide this from @repo/database.
 */
export type EntitlementChecker = (
  organizationId: string,
  entitlementKey: string
) => Promise<boolean>;

/**
 * Cloud capability configuration.
 */
export interface CloudCapabilityConfig {
  /**
   * Organization ID for entitlement checks.
   */
  organizationId: string;

  /**
   * Function to check if an entitlement is enabled.
   * Provided by the Cloud deployment from @repo/database.
   */
  checkEntitlement: EntitlementChecker;

  /**
   * Whether this is a Cloud deployment (vs OSS).
   * If false, all entitlement checks return false.
   */
  isCloud: boolean;
}

/**
 * Cloud capability discovery result.
 */
export interface CloudCapabilityResult {
  capabilities: GatewayCapabilities;
  entitlements: {
    key: GatewayEntitlementKey;
    enabled: boolean;
    feature: string;
  }[];
  isCloud: boolean;
  organizationId?: string;
}

// =============================================================================
// CLOUD CAPABILITY PROVIDER
// =============================================================================

/**
 * Cloud Capability Provider
 *
 * Provides capabilities based on organization entitlements.
 * Only used in Cloud deployments - OSS uses static capabilities.
 */
export class CloudCapabilityProvider implements CapabilityProvider {
  private config: CloudCapabilityConfig;

  constructor(config: CloudCapabilityConfig) {
    this.config = config;
  }

  /**
   * Get capabilities based on organization entitlements.
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    if (!this.config.isCloud) {
      // OSS mode - return static OSS capabilities
      return {
        ...OSS_CAPABILITIES,
        gatewayVersion: VERSION,
      };
    }

    // Check all entitlements
    const [
      ,
      hasDiscoveryRanked,
      hasVerificationAutomated,
      hasAnalyticsEnabled,
      ,
      hasFederationPrivate,
    ] = await Promise.all([
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.REGISTRY_CLOUD
      ),
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED
      ),
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.VERIFICATION_AUTOMATED
      ),
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED
      ),
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.FEDERATION_GLOBAL
      ),
      this.config.checkEntitlement(
        this.config.organizationId,
        GATEWAY_ENTITLEMENT_KEYS.FEDERATION_PRIVATE
      ),
    ]);

    return {
      specVersion: '2025-12-22',
      gatewayVersion: VERSION,
      features: {
        registry: {
          merchantWrite: true,
          verificationAutomation: hasVerificationAutomated,
          supportsPrivateHubs: hasFederationPrivate,
        },
        discovery: {
          rankedResults: hasDiscoveryRanked,
          supportsFilters: true,
          supportsPagination: true,
          supportsTagSearch: true,
        },
        analytics: {
          events: hasAnalyticsEnabled
            ? ['search', 'click', 'add_to_cart', 'checkout', 'verify']
            : ['search', 'click'],
          realtime: hasAnalyticsEnabled,
        },
        verification: {
          dnsTxt: true,
          metaTag: true,
          callbackChallenge: true,
          manualReview: hasVerificationAutomated,
        },
      },
    };
  }

  /**
   * Get detailed capability result with entitlement status.
   */
  async getCapabilityResult(): Promise<CloudCapabilityResult> {
    const capabilities = await this.getCapabilities();

    if (!this.config.isCloud) {
      return {
        capabilities,
        entitlements: Object.values(GATEWAY_ENTITLEMENT_KEYS).map((key) => ({
          key,
          enabled: false,
          feature: key.split('.')[1] || 'unknown',
        })),
        isCloud: false,
      };
    }

    // Check all entitlements with detailed results
    const entitlementChecks = await Promise.all(
      Object.entries(GATEWAY_ENTITLEMENT_KEYS).map(async ([_name, key]) => ({
        key,
        enabled: await this.config.checkEntitlement(this.config.organizationId, key),
        feature: key.split('.')[1] || 'unknown',
      }))
    );

    return {
      capabilities,
      entitlements: entitlementChecks,
      isCloud: true,
      organizationId: this.config.organizationId,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a Cloud capability provider for an organization.
 */
export function createCloudCapabilityProvider(
  config: CloudCapabilityConfig
): CloudCapabilityProvider {
  return new CloudCapabilityProvider(config);
}

/**
 * Create an OSS capability provider (ignores entitlements).
 */
export function createOSSCapabilityProvider(): CapabilityProvider {
  return {
    async getCapabilities(): Promise<GatewayCapabilities> {
      return {
        ...OSS_CAPABILITIES,
        gatewayVersion: VERSION,
      };
    },
  };
}

// =============================================================================
// CAPABILITY COMPARISON
// =============================================================================

/**
 * Compare OSS vs Cloud capabilities for documentation/UI.
 */
export function getCapabilityComparison(): {
  feature: string;
  oss: boolean;
  cloud: boolean;
  entitlement: string;
  tier: string;
}[] {
  return [
    {
      feature: 'Basic Ingestion (CSV, JSON)',
      oss: true,
      cloud: true,
      entitlement: 'N/A',
      tier: 'free',
    },
    {
      feature: 'In-Memory Catalog',
      oss: true,
      cloud: true,
      entitlement: 'N/A',
      tier: 'free',
    },
    {
      feature: 'MCP Tools (search, details)',
      oss: true,
      cloud: true,
      entitlement: 'N/A',
      tier: 'free',
    },
    {
      feature: 'Tag-Based Discovery',
      oss: true,
      cloud: true,
      entitlement: 'N/A',
      tier: 'free',
    },
    {
      feature: 'Basic Verification (DNS, Meta)',
      oss: true,
      cloud: true,
      entitlement: 'N/A',
      tier: 'free',
    },
    {
      feature: 'Cloud Product Registry',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.REGISTRY_CLOUD,
      tier: 'pro',
    },
    {
      feature: 'Ranked Discovery (ML)',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.DISCOVERY_RANKED,
      tier: 'pro',
    },
    {
      feature: 'Automated Verification',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.VERIFICATION_AUTOMATED,
      tier: 'enterprise',
    },
    {
      feature: 'Gateway Analytics',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.ANALYTICS_ENABLED,
      tier: 'starter',
    },
    {
      feature: 'Global Federation',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.FEDERATION_GLOBAL,
      tier: 'enterprise',
    },
    {
      feature: 'Private Federation',
      oss: false,
      cloud: true,
      entitlement: GATEWAY_ENTITLEMENT_KEYS.FEDERATION_PRIVATE,
      tier: 'pro',
    },
  ];
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  type GatewayCapabilities,
  type CapabilityProvider,
  OSS_CAPABILITIES,
} from '../capabilities/types';

