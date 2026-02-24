/**
 * Better Data Cloud Provider Implementations
 *
 * This module exports implementations of the OSS federation interfaces
 * that connect to the Better Data Cloud Federation API.
 *
 * These providers are optional - the OSS package works standalone.
 * Use these when you want to leverage the Better Data Cloud for:
 * - Managed merchant registry
 * - Advanced discovery and ranking
 * - Centralized analytics
 * - Enterprise features
 *
 * @example
 * ```typescript
 * import { createBetterDataProviders } from '@betterdata/commerce-gateway/federation/providers';
 *
 * const providers = createBetterDataProviders({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 *   hubId: 'global',
 * });
 *
 * // Use in your gateway
 * const hub = new FederationHub({
 *   registry: providers.registry,
 *   discovery: providers.discovery,
 *   analytics: providers.analytics,
 * });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Provider Exports
// ============================================================================

export {
  BetterDataRegistryProvider,
  type BetterDataRegistryConfig,
  type RegistryCache,
} from '../registry/betterdata';

export {
  BetterDataDiscoveryProvider,
  type BetterDataDiscoveryConfig,
  type DiscoverOptions,
  type DiscoveredMerchant,
  type AlternativesContext,
} from '../discovery/betterdata';

export {
  BetterDataAnalyticsSink,
  NoopAnalyticsSink,
  type BetterDataAnalyticsConfig,
  type SearchEvent,
  type ResolutionEvent,
  type GatewayHealthEvent,
} from '../analytics/betterdata';

// ============================================================================
// Types
// ============================================================================

export interface BetterDataProvidersConfig {
  /**
   * API key for Better Data Cloud authentication.
   * Required.
   */
  apiKey: string;

  /**
   * Federation hub ID.
   * @default "global"
   */
  hubId?: string;

  /**
   * Better Data Cloud API URL.
   * @default "https://api.betterdata.com/federation"
   */
  apiUrl?: string;

  /**
   * Optional local cache for registry reads.
   */
  registryCache?: import('../registry/betterdata.js').RegistryCache;

  /**
   * Analytics configuration overrides.
   */
  analytics?: {
    batchSize?: number;
    flushIntervalMs?: number;
    debug?: boolean;
  };
}

export interface BetterDataProviders {
  registry: import('../registry/betterdata.js').BetterDataRegistryProvider;
  discovery: import('../discovery/betterdata.js').BetterDataDiscoveryProvider;
  analytics: import('../analytics/betterdata.js').BetterDataAnalyticsSink;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create all Better Data Cloud providers with a single configuration.
 *
 * This is the recommended way to initialize the providers when using
 * Better Data Cloud for all federation services.
 *
 * @param config - Configuration for all providers
 * @returns Object containing registry, discovery, and analytics providers
 *
 * @example
 * ```typescript
 * const providers = createBetterDataProviders({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 * });
 *
 * // Track events
 * providers.analytics.trackSearch({
 *   merchantId: 'nike.com',
 *   query: 'running shoes',
 *   success: true,
 *   latencyMs: 150,
 * });
 *
 * // Discover merchants
 * const merchants = await providers.discovery.discoverByIntent('running shoes');
 *
 * // Flush analytics before shutdown
 * await providers.analytics.flush();
 * ```
 */
export function createBetterDataProviders(
  config: BetterDataProvidersConfig
): BetterDataProviders {
  const baseConfig = {
    apiUrl: config.apiUrl ?? 'https://api.betterdata.com/federation',
    apiKey: config.apiKey,
    hubId: config.hubId ?? 'global',
  };

  // Import dynamically to avoid circular dependencies
  const { BetterDataRegistryProvider } = require('../registry/betterdata.js');
  const { BetterDataDiscoveryProvider } = require('../discovery/betterdata.js');
  const { BetterDataAnalyticsSink } = require('../analytics/betterdata.js');

  return {
    registry: new BetterDataRegistryProvider({
      ...baseConfig,
      cache: config.registryCache,
    }),
    discovery: new BetterDataDiscoveryProvider(baseConfig),
    analytics: new BetterDataAnalyticsSink({
      ...baseConfig,
      ...config.analytics,
    }),
  };
}

// ============================================================================
// Utility: Check if API key is configured
// ============================================================================

/**
 * Check if Better Data Cloud is configured.
 *
 * Useful for conditional initialization.
 *
 * @param apiKey - API key to check (defaults to env var)
 * @returns True if API key is present
 */
export function isBetterDataConfigured(
  apiKey?: string
): boolean {
  const key = apiKey ?? process.env.BETTERDATA_API_KEY;
  return typeof key === 'string' && key.length > 0;
}

/**
 * Create providers if configured, otherwise return null.
 *
 * @param config - Optional config overrides
 * @returns Providers if configured, null otherwise
 */
export function createBetterDataProvidersIfConfigured(
  config?: Partial<BetterDataProvidersConfig>
): BetterDataProviders | null {
  const apiKey = config?.apiKey ?? process.env.BETTERDATA_API_KEY;

  if (!isBetterDataConfigured(apiKey)) {
    return null;
  }

  return createBetterDataProviders({
    apiKey: apiKey!,
    ...config,
  });
}

