/**
 * @betterdata/llm-gateway - Federation Module
 *
 * The Federation Hub routes shopping intent to merchant-specific gateway instances.
 * It enables users to say "shop vuoriclothing.com for joggers" and have the request
 * routed to Vuori's connected catalog.
 *
 * @example
 * ```typescript
 * import { FederationHub, type MerchantRegistration } from '@betterdata/llm-gateway/federation';
 *
 * // Create a federation hub
 * const hub = await FederationHub.create({
 *   registry: { type: 'memory' },
 *   discovery: { type: 'tag-based' },
 *   fallback: { suggestAlternatives: true, maxAlternatives: 5 },
 * });
 *
 * // Register a merchant
 * await hub.registerMerchant({
 *   domain: 'vuoriclothing.com',
 *   aliases: ['vuori'],
 *   gatewayUrl: 'https://api.vuori.com/llm-gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Vuori', categories: ['activewear'] },
 * });
 *
 * // Route a shopping request
 * const result = await hub.search('shop vuori for joggers under $100');
 * ```
 *
 * @license MIT
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Merchant types
  MerchantTier,
  MerchantCapabilities,
  MerchantRegistration,
  MerchantVerification,
  VerificationMethod,

  // Result types
  FederatedStatus,
  FederatedResult,
  DiscoveredMerchant,

  // Discovery types
  WellKnownGateway,
  JWK,

  // Configuration types
  FederationHubConfig,
  FallbackStrategy,

  // Cross-gateway types
  FederatedToolRequest,
  FederatedToolResponse,
} from './types';

// ============================================================================
// Registry Exports
// ============================================================================

export type {
  MerchantRegistry,
  ListOptions,
  SearchOptions as RegistrySearchOptions,
  RegistryEventType,
  RegistryEvent,
  RegistryEventListener,
  ObservableMerchantRegistry,
} from './registry/index';

export {
  MemoryMerchantRegistry,
  createMemoryRegistry,
  FileMerchantRegistry,
  createFileRegistry,
  createRegistry,
  type RegistryBackendType,
  type RegistryConfig,
} from './registry/index';

// ============================================================================
// Router Exports
// ============================================================================

export {
  IntentParser,
  createIntentParser,
  type ParsedIntent,
  type MatchConfidence,
  type IntentParserOptions,
} from './router/index';

// ============================================================================
// Client Exports
// ============================================================================

export {
  GatewayClient,
  createGatewayClient,
  type GatewayClientOptions,
  type SearchOptions,
  type SearchResult,
} from './client/index';

// ============================================================================
// Auth Exports
// ============================================================================

export {
  // Classes
  FederationJWTSigner,
  FederationJWTVerifier,

  // Error classes
  JWTError,
  JWTExpiredError,
  JWTInvalidSignatureError,
  JWTInvalidAudienceError,
  JWTInvalidIssuerError,
  JWTKeyNotFoundError,

  // Key generation & export
  generateKeyPair,
  exportPublicKeyJWK,
  importPublicKeyJWK,
  exportPrivateKeyJWK,
  importPrivateKeyJWK,

  // Utility functions
  decodeToken,
  decodeHeader,
  isTokenExpired,
  getTokenExpiration,

  // Types
  type KeyLike,
  type FederationJWK,
  type FederationJWTPayload,
  type SignOptions,
  type PublicKeyEntry,
} from './auth/index';

// ============================================================================
// Analytics Exports
// ============================================================================

export type {
  AnalyticsSink,
  AnalyticsSinkOptions,
  AnalyticsEvent,
  BaseEvent,
  SearchEvent,
  ResolutionEvent,
  ToolCallEvent,
  DiscoveryEvent,
  RegistrationEvent,
} from './analytics/index';

export {
  NoopAnalyticsSink,
  ConsoleAnalyticsSink,
  createNoopAnalyticsSink,
  createConsoleAnalyticsSink,
} from './analytics/index';

// ============================================================================
// Tools Exports
// ============================================================================

export {
  // Shop Merchant Tool
  ShopMerchantTool,
  createShopMerchantTool,
  ShopMerchantArgsSchema,
  SHOP_MERCHANT_TOOL_DEFINITION,
  type ShopMerchantArgs,

  // Discover Merchants Tool
  DiscoverMerchantsTool,
  createDiscoverMerchantsTool,
  DefaultDiscoveryProvider,
  DiscoverMerchantsArgsSchema,
  DISCOVER_MERCHANTS_TOOL_DEFINITION,
  type DiscoverMerchantsArgs,
  type DiscoveryProvider,

  // Registration helpers
  registerFederationTools,
  getFederationToolDefinitions,
  getFederationToolsForOpenAI,
  getFederationToolsForMCP,
  type FederationToolsOptions,
} from './tools/index';

// ============================================================================
// Discovery Exports
// ============================================================================

export {
  // Interface
  CompositeDiscoveryProvider,
  type DiscoverByIntentOptions,
  type SuggestAlternativesOptions,
  type CompositeProviderOptions,

  // Providers
  StaticDiscoveryProvider,
  createStaticDiscoveryProvider,
  TagBasedDiscoveryProvider,
  createTagBasedDiscoveryProvider,
  DEFAULT_CATEGORY_SYNONYMS,
  type TagBasedDiscoveryOptions,

  // Factory
  createDiscoveryProvider,
  type DiscoveryProviderConfig,
} from './discovery/index';

// ============================================================================
// Well-Known Exports (for merchant gateways)
// ============================================================================

export {
  createWellKnownRoutes,
  addFederationRoutes,
  generateWellKnownResponse,
  type WellKnownConfig,
  type WellKnownRouteOptions,
  type BackendAvailability,
  type FederationConfig,
} from './well-known/index';

// ============================================================================
// Federation Hub
// ============================================================================

export {
  FederationHub,
  createFederationHub,
  type FederationHubOptions,
  type RegistryConfigOption,
  type DiscoveryConfigOption,
  type AuthConfig,
  type FallbackConfig,
  type CloudConfig,
  type SearchOptions as HubSearchOptions,
} from './hub';

// ============================================================================
// Capability Gate (Cloud-only)
// ============================================================================

export {
  CapabilityGate,
  CapabilityNotEnabledError,
  createCloudCapabilityGate,
  createOSSCapabilityGate,
  OSS_CAPABILITY_GATE,
  CAPABILITY_ENTITLEMENT_MAP,
  PROVIDER_REQUIRED_CAPABILITIES,
  type CapabilityGateConfig,
  type CapabilityCheckResult,
} from '../cloud/capability-gate';

// ============================================================================
// Gateway Integration
// ============================================================================

export {
  integrateFederation,
  createFederatedGateway,
  type FederatedGatewayOptions,
  type HubModeConfig,
  type MerchantModeConfig,
  type FederationIntegrationResult,
} from './integration';

// ============================================================================
// Better Data Cloud Providers (Optional)
// ============================================================================

/**
 * Better Data Cloud provider implementations.
 *
 * These are optional providers that connect to Better Data Cloud.
 * Import from '@betterdata/llm-gateway/federation/providers' for full API.
 *
 * @example
 * ```typescript
 * import { createBetterDataProviders } from '@betterdata/llm-gateway/federation/providers';
 *
 * const providers = createBetterDataProviders({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 * });
 * ```
 */
export {
  // Factory
  createBetterDataProviders,
  createBetterDataProvidersIfConfigured,
  isBetterDataConfigured,

  // Individual providers
  BetterDataRegistryProvider,
  BetterDataDiscoveryProvider,
  BetterDataAnalyticsSink,
  NoopAnalyticsSink as BetterDataNoopSink,

  // Types
  type BetterDataProvidersConfig,
  type BetterDataProviders,
  type BetterDataRegistryConfig,
  type BetterDataDiscoveryConfig,
  type BetterDataAnalyticsConfig,
} from './providers/index';
