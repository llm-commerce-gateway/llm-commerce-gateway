/**
 * @betterdata/commerce-gateway - Feature Flags
 *
 * Runtime feature flags for gating experimental and Cloud-only capabilities.
 *
 * ## Contract (v0.1) Classification
 *
 * Legend:
 * - 🔴 Cloud-only: MUST NOT be enabled in OSS runtime
 * - 🟡 Experimental: Feature-flagged, default-off
 * - ✅ Stable: Enabled by default
 *
 * ## Usage
 *
 * ```typescript
 * import { featureFlags, isFeatureEnabled } from '@betterdata/commerce-gateway';
 *
 * if (isFeatureEnabled('ENABLE_LOT_EXPIRY')) {
 *   // Include lot/expiry fields in inventory response
 * }
 * ```
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 * @license MIT
 */

// ============================================================================
// Feature Flag Definitions
// ============================================================================

/**
 * Feature flag configuration.
 */
export interface FeatureFlagConfig {
  /** Flag identifier */
  key: string;

  /** Human-readable description */
  description: string;

  /** Default value (usually false for 🟡 flags) */
  defaultValue: boolean;

  /** Owning team or surface */
  owner: string;

  /** Optional deprecation date (ISO) */
  expiresOn?: string;

  /** Where this flag is enforced */
  authority?: 'server' | 'ui-hint' | 'both';

  /**
   * Contract classification:
   * - 'stable': ✅ Enabled by default, fully supported in OSS
   * - 'experimental': 🟡 Default-off, may change without notice
   * - 'cloud-only': 🔴 Must not be enabled in OSS runtime
   */
  classification: 'stable' | 'experimental' | 'cloud-only';

  /** Environment variable to override this flag */
  envVar?: string;
}

/**
 * All feature flags for the LLM Gateway.
 */
export const FEATURE_FLAGS: Record<string, FeatureFlagConfig> = {
  // ============================================================================
  // Inventory Tool Flags
  // ============================================================================

  /**
   * 🟡 Enable lot/expiry fields in check_inventory response.
   *
   * When enabled, check_inventory will include:
   * - lotNumber: The lot/batch number
   * - expiryDate: Product expiration date
   * - manufacturingDate: When the product was manufactured
   *
   * Default: false (not included in OSS by default)
   */
  ENABLE_LOT_EXPIRY: {
    key: 'ENABLE_LOT_EXPIRY',
    description: 'Include lot/expiry fields in check_inventory response',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'experimental',
    envVar: 'LLM_GATEWAY_ENABLE_LOT_EXPIRY',
  },

  // ============================================================================
  // MCP Flags
  // ============================================================================

  /**
   * 🟡 Enable MCP stdio transport.
   *
   * The stdio transport is primarily for development and Claude Desktop integration.
   * Should be disabled in production/server deployments.
   *
   * Default: false (disabled in production)
   */
  ENABLE_MCP_STDIO: {
    key: 'ENABLE_MCP_STDIO',
    description: 'Enable MCP server stdio transport (dev/local only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'experimental',
    envVar: 'LLM_GATEWAY_ENABLE_MCP_STDIO',
  },

  // ============================================================================
  // Federation Flags
  // ============================================================================

  /**
   * 🟡 Enable federation (experimental read-only).
   *
   * Federation allows querying products across multiple merchant gateways.
   * In OSS, this is read-only and experimental.
   *
   * Default: false (disabled by default)
   */
  ENABLE_FEDERATION: {
    key: 'ENABLE_FEDERATION',
    description: 'Enable federation hub (experimental, read-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'experimental',
    envVar: 'LLM_GATEWAY_ENABLE_FEDERATION',
  },

  /**
   * 🔴 Enable federation write operations.
   *
   * Write operations (merchant registration, verification) are Cloud-only.
   * This flag MUST NOT be enabled in OSS runtime.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_FEDERATION_WRITE: {
    key: 'ENABLE_FEDERATION_WRITE',
    description: 'Enable federation write operations (Cloud-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_FEDERATION_WRITE',
  },

  // ============================================================================
  // Routing Flags
  // ============================================================================

  /**
   * 🔴 Enable smart routing.
   *
   * Smart routing optimizes LLM provider selection based on cost/latency.
   * This is a Cloud-only feature requiring analytics data.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_SMART_ROUTING: {
    key: 'ENABLE_SMART_ROUTING',
    description: 'Enable smart provider routing (Cloud-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_SMART_ROUTING',
  },

  // ============================================================================
  // Caching Flags
  // ============================================================================

  /**
   * 🔴 Enable semantic caching.
   *
   * Semantic caching uses embeddings to cache similar queries.
   * This is a Cloud-only feature requiring vector database.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_SEMANTIC_CACHING: {
    key: 'ENABLE_SEMANTIC_CACHING',
    description: 'Enable semantic caching (Cloud-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_SEMANTIC_CACHING',
  },

  // ============================================================================
  // Tool Flags
  // ============================================================================

  /**
   * 🔴 Enable SCM tools.
   *
   * SCM tools (PO, shipment, forecast) are Cloud-only features
   * that require the @betterdata/scm package.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_SCM_TOOLS: {
    key: 'ENABLE_SCM_TOOLS',
    description: 'Enable SCM tools (PO, shipment, forecast) - Cloud-only',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_SCM_TOOLS',
  },

  // ============================================================================
  // Analytics Flags
  // ============================================================================

  /**
   * ✅ Enable basic analytics events.
   *
   * Basic analytics (search, click) are available in OSS.
   *
   * Default: true
   */
  ENABLE_ANALYTICS: {
    key: 'ENABLE_ANALYTICS',
    description: 'Enable basic analytics events',
    defaultValue: true,
    owner: 'gateway',
    authority: 'server',
    classification: 'stable',
    envVar: 'LLM_GATEWAY_ENABLE_ANALYTICS',
  },

  /**
   * 🔴 Enable realtime analytics.
   *
   * Realtime analytics streaming is a Cloud-only feature.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_REALTIME_ANALYTICS: {
    key: 'ENABLE_REALTIME_ANALYTICS',
    description: 'Enable realtime analytics streaming (Cloud-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_REALTIME_ANALYTICS',
  },

  // ============================================================================
  // Multi-tenancy Flags
  // ============================================================================

  /**
   * 🔴 Enable multi-tenant isolation.
   *
   * Multi-tenant isolation is a Cloud-only feature.
   * OSS is explicitly single-tenant.
   *
   * Default: false (Cloud-only)
   */
  ENABLE_MULTI_TENANT: {
    key: 'ENABLE_MULTI_TENANT',
    description: 'Enable multi-tenant isolation (Cloud-only)',
    defaultValue: false,
    owner: 'gateway',
    authority: 'server',
    classification: 'cloud-only',
    envVar: 'LLM_GATEWAY_ENABLE_MULTI_TENANT',
  },
} as const;

// ============================================================================
// Feature Flag Types
// ============================================================================

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

// ============================================================================
// Feature Flag State
// ============================================================================

/**
 * Runtime feature flag state.
 * Can be overridden via environment variables or programmatically.
 */
class FeatureFlagState {
  private overrides: Map<string, boolean> = new Map();
  private isCloudMode: boolean = false;

  /**
   * Set whether this is a Cloud deployment.
   * Cloud mode allows Cloud-only flags to be enabled.
   */
  setCloudMode(isCloud: boolean): void {
    this.isCloudMode = isCloud;
  }

  /**
   * Check if Cloud mode is enabled.
   */
  isCloud(): boolean {
    return this.isCloudMode;
  }

  /**
   * Override a feature flag value programmatically.
   */
  setOverride(key: FeatureFlagKey, value: boolean): void {
    const config = FEATURE_FLAGS[key];
    if (!config) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    // Prevent enabling Cloud-only flags in OSS mode
    if (config.classification === 'cloud-only' && value && !this.isCloudMode) {
      throw new Error(
        `Cannot enable Cloud-only feature "${key}" in OSS mode. ` +
          `This feature requires Better Data Cloud.`
      );
    }

    this.overrides.set(key, value);
  }

  /**
   * Clear an override, reverting to default/env behavior.
   */
  clearOverride(key: FeatureFlagKey): void {
    this.overrides.delete(key);
  }

  /**
   * Clear all overrides.
   */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Get the current value of a feature flag.
   */
  getValue(key: FeatureFlagKey): boolean {
    const config = FEATURE_FLAGS[key];
    if (!config) {
      return false;
    }

    // Check programmatic override first
    if (this.overrides.has(key)) {
      return this.overrides.get(key)!;
    }

    // Check environment variable
    if (config.envVar && typeof process !== 'undefined' && process.env) {
      const envValue = process.env[config.envVar];
      if (envValue !== undefined) {
        const parsed = envValue.toLowerCase();
        if (parsed === 'true' || parsed === '1') {
          // Prevent enabling Cloud-only flags via env in OSS mode
          if (config.classification === 'cloud-only' && !this.isCloudMode) {
            console.warn(
              `[FeatureFlags] Ignoring ${config.envVar}=true: ` +
                `Cloud-only feature "${key}" cannot be enabled in OSS mode.`
            );
            return false;
          }
          return true;
        }
        if (parsed === 'false' || parsed === '0') {
          return false;
        }
      }
    }

    // Return default value
    return config.defaultValue;
  }

  /**
   * Get all flag values.
   */
  getAllValues(): Record<FeatureFlagKey, boolean> {
    const result: Record<string, boolean> = {};
    for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
      result[key] = this.getValue(key);
    }
    return result as Record<FeatureFlagKey, boolean>;
  }

  /**
   * Get all Cloud-only flags that are currently enabled.
   * Used for CI enforcement.
   */
  getEnabledCloudOnlyFlags(): string[] {
    const enabled: string[] = [];
    for (const [key, config] of Object.entries(FEATURE_FLAGS)) {
      if (config.classification === 'cloud-only' && this.getValue(key as FeatureFlagKey)) {
        enabled.push(key);
      }
    }
    return enabled;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global feature flag state.
 */
export const featureFlags = new FeatureFlagState();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a feature flag is enabled.
 *
 * @param key - Feature flag key
 * @returns Whether the feature is enabled
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('ENABLE_LOT_EXPIRY')) {
 *   // Include lot/expiry fields
 * }
 * ```
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return featureFlags.getValue(key);
}

/**
 * Check if a feature flag is experimental.
 */
export function isExperimentalFeature(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key]?.classification === 'experimental';
}

/**
 * Check if a feature flag is Cloud-only.
 */
export function isCloudOnlyFeature(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key]?.classification === 'cloud-only';
}

/**
 * Get the configuration for a feature flag.
 */
export function getFeatureFlagConfig(key: FeatureFlagKey): FeatureFlagConfig | undefined {
  return FEATURE_FLAGS[key];
}

/**
 * Validate that no Cloud-only flags are enabled in OSS mode.
 * Used for CI enforcement.
 *
 * @throws Error if Cloud-only flags are enabled in OSS mode
 */
export function validateOSSFeatureFlags(): void {
  if (featureFlags.isCloud()) {
    return; // Skip validation in Cloud mode
  }

  const enabledCloudOnly = featureFlags.getEnabledCloudOnlyFlags();
  if (enabledCloudOnly.length > 0) {
    throw new Error(
      `Cloud-only features enabled in OSS mode: ${enabledCloudOnly.join(', ')}. ` +
        `These features require Better Data Cloud.`
    );
  }
}
