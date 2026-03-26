/**
 * @betterdata/commerce-gateway
 * 
 * Universal LLM Gateway for Conversational Commerce
 * 
 * Build AI-powered shopping experiences with any LLM provider and any commerce backend.
 * 
 * @example
 * ```typescript
 * import { LLMGateway } from '@betterdata/commerce-gateway';
 * import { MyShopifyBackend } from './my-backend';
 * 
 * const gateway = new LLMGateway({
 *   backends: {
 *     products: new MyShopifyBackend(),
 *     cart: new MyShopifyBackend(),
 *     orders: new MyShopifyBackend(),
 *   },
 *   session: {
 *     redis: { url: process.env.REDIS_URL }
 *   }
 * });
 * 
 * await gateway.start(3000);
 * ```
 * 
 * @license Apache-2.0
 * @see https://github.com/betterdataco/llm-commerce-gateway
 */

// ============================================================================
// Core Exports
// ============================================================================

export { LLMGateway, createGateway } from './core/Gateway.js';
export { ToolRegistry, createTool, ToolRegistryClass } from './core/ToolRegistry.js';

// Gateway Factory with Extension Points (NEW - recommended for simple setups)
export {
  createSimpleGateway,
  createGatewayServices,
  registerCommerceTools,
  type SimpleGatewayConfig,
  type GatewayServices,
} from './core/GatewayFactory.js';

// createSCMGateway and SCMGatewayConfig moved to @betterdata/scm (proprietary)

// ============================================================================
// Backend Interfaces
// ============================================================================

export type {
  // Core product types
  Product,
  ProductVariant,
  ProductFilters,
  ProductSearchResult,
  InventoryStatus,
  
  // Cart types
  Cart,
  CartItem,
  
  // Order types
  Order,
  Address,
  PaymentInfo,
  
  // Link types
  ShortLink,
  Recommendation,
  
  // Backend interfaces - implement these for your commerce platform
  ProductBackend,
  CartBackend,
  OrderBackend,
  LinkGenerator,
  GatewayBackends,
} from './backends/interfaces.js';

// ============================================================================
// Configuration Types
// ============================================================================

// ============================================================================
// Auth Adapter (OSS Extraction - Pluggable API Key Validation)
// ============================================================================

export type { AuthAdapter, AuthResult } from './middleware/auth.js';
export { EnvAuthAdapter } from './middleware/auth.js';

// ============================================================================
// Configuration Types
// ============================================================================

export type {
  // Gateway configuration
  GatewayConfig,
  RedisConfig,
  PostgresConfig,
  SessionConfig,
  AuthConfig,
  OAuthConfig,
  RateLimitConfig,
  TelemetryConfig,
  
  // LLM types
  LLMProvider,
  LLMConfig,
  
  // Session types
  SessionData,
  UserPreferences,
  ConversationMessage,
  
  // Tool types
  ToolContext,
  ToolError,
  ToolResult,
  ToolHandler,
  ToolOptions,
  
  // API types
  APIResponse,
  ToolCallRequest,
  ToolCallResponse,
  
  // Tool input/output types
  SearchProductsInput,
  SearchProductsOutput,
  GetProductDetailsInput,
  GetProductDetailsOutput,
  AddToCartInput,
  AddToCartOutput,
  CheckInventoryInput,
  CheckInventoryOutput,
  GetRecommendationsInput,
  GetRecommendationsOutput,
  CreateOrderInput,
  CreateOrderOutput,
  
  // Utility types
  Logger,
} from './core/types';

// ============================================================================
// Tool Registry Types
// ============================================================================

export type {
  ToolDefinition,
  JSONSchema,
  AnthropicToolDefinition,
  OpenAIFunctionDefinition,
  GrokToolDefinition,
  GoogleToolDefinition,
} from './core/ToolRegistry';

// ============================================================================
// Session Management
// ============================================================================

export {
  SessionManager,
  createSessionManager,
  RedisSessionStore,
  InMemorySessionStore,
} from './session/SessionManager';

export type { SessionStore } from './session/SessionManager';

// ============================================================================
// Built-in Tools
// ============================================================================

export {
  registerBuiltInTools,
  // Schemas (for extending or customizing)
  SearchProductsSchema,
  GetProductDetailsSchema,
  AddToCartSchema,
  CheckInventorySchema,
  GetRecommendationsSchema,
  CreateOrderSchema,
} from './tools/builtInTools';

// Tool registry exports
export { toolRegistry } from './tools/registry.js';

// ============================================================================
// Registry Exports
// ============================================================================

export { RegistryClient, createRegistryClient } from './registry/index.js';
export { parseShopQuery } from './registry/shop-parser.js';
export type {
  RegistryClientConfig,
  BrandResolution,
  GTINResolution,
  CategoryResolution,
  ParsedShopQuery,
  WellKnownCommerceGateway,
} from './registry/index.js';
export { registerAllTools } from './tools/handlers/index.js';

// Marketplace Search and Cart tools have been moved to @betterdata/scm (proprietary)

// ============================================================================
// Error Handling
// ============================================================================

export {
  // Error codes
  ErrorCode,
  
  // Error classes
  GatewayError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ToolNotFoundError,
  ToolExecutionError,
  SessionNotFoundError,
  SessionExpiredError,
  ProductNotFoundError,
  CartNotFoundError,
  OrderNotFoundError,
  InsufficientInventoryError,
  BackendError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  
  // Utilities
  isGatewayError,
  wrapError,
  safeErrorMessage,
} from './core/errors.js';

export type { ErrorResponse } from './core/errors.js';

// ============================================================================
// Validation
// ============================================================================

export {
  // Schemas
  ToolCallRequestSchema,
  SearchProductsArgsSchema,
  GetProductDetailsArgsSchema,
  AddToCartArgsSchema,
  CheckInventoryArgsSchema,
  GetRecommendationsArgsSchema,
  CreateOrderArgsSchema,
  SessionCreateRequestSchema,
  SessionUpdateRequestSchema,
  CartItemSchema,
  AddToCartRequestSchema,
  
  // Validation helpers
  validateRequest,
  safeValidate,
  createValidator,
  parseBody,
  parseQuery,
} from './core/validation.js';

export type {
  LLMProvider as ValidatedLLMProvider,
  ToolCallRequest as ValidatedToolCallRequest,
  SearchProductsArgs,
  GetProductDetailsArgs,
  AddToCartArgs,
  CheckInventoryArgs,
  GetRecommendationsArgs,
  CreateOrderArgs,
  SessionCreateRequest,
  SessionUpdateRequest,
  CartItemInput,
  AddToCartRequest,
  ValidationResult,
} from './core/validation';

// ============================================================================
// Observability
// ============================================================================

export {
  // Logger implementations
  ConsoleLogger,
  StructuredLogger,
  NoOpLogger,
  TestLogger,
  
  // Logger management
  setLogger,
  getLogger,
  resetLogger,
} from './observability/index.js';

export type {
  Logger as StructuredLoggerInterface,
  LogLevel,
  LogEntry,
  ConsoleLoggerOptions,
  ExternalLogger,
} from './observability/index';

// ============================================================================
// Extension Point Interfaces
// ============================================================================

export type {
  // Search Types (Product/Cart types already exported from backends/interfaces)
  SearchQuery,
  SearchFilters,
  SearchResult,
  
  // Ranking Types
  RankingContext,
  
  // Extension Point Interfaces
  SearchService,
  RankingService,
  CartService,
  ProductCatalog,
  IngestionService,
  AnalyticsService,
  IngestionResult,
  PlatformConfig,
  GatewayExtensions,
  SessionConfig as CatalogSessionConfig,
  ProviderConfig,
} from './catalog/interfaces.js';

// ============================================================================
// Basic Implementations (Open Source)
// ============================================================================

export {
  // Basic Search Service
  BasicSearchService,
  createBasicSearchService,
  
  // Basic Cart Service
  BasicCartService,
  InMemoryCartStorage,
  RedisCartStorage,
  createBasicCartService,
  createRedisCartService,
  
  // In-Memory Catalog
  InMemoryCatalog,
  createInMemoryCatalog,
  createCatalogFromJSON,
  parseCSVRow,
  loadProductsFromCSV,
  
  // Basic Ingestion Service
  BasicIngestionService,
  createBasicIngestionService,
} from './catalog/index.js';

export type {
  BasicSearchServiceConfig,
  BasicCartServiceConfig,
  CartStorage,
  CSVColumnMapping,
  BasicIngestionServiceConfig,
  IngestionProgress,
} from './catalog/index';

// ============================================================================
// Product Matching - Moved to @betterdata/scm (Proprietary)
// ============================================================================

// Product matcher, ranking, and search index features are now part of the
// Better Data SCM (Supply Chain Management) proprietary package.
// For open source users: Use BasicSearchService for single-store keyword search.

// ============================================================================
// Marketplace Admin - Moved to @betterdata/scm (Proprietary)
// ============================================================================

// Marketplace admin, vendor management, and dashboard features are now part of
// the Better Data SCM (Supply Chain Management) proprietary package.

// ============================================================================
// Attribution Analytics - Moved to @betterdata/scm (Proprietary)
// ============================================================================

// LLM attribution analytics, competitive insights, and demand forecasting are
// now part of the Better Data SCM (Supply Chain Management) proprietary package.

// ============================================================================
// Ingestion (Lightweight Product Import)
// ============================================================================

export {
  // Main import functions
  importProducts,
  importToCatalog,
  importFromShopify,
  importFromSquare,
  importFromCSV,
  importFromJSON,
  
  // Fetcher factory
  createFetcher,
  
  // Fetcher classes
  ShopifyFetcher,
  SquareFetcher,
  CSVFetcher,
  JSONFetcher,
  createShopifyFetcher,
  createSquareFetcher,
  createCSVFetcher,
  createJSONFetcher,
  
  // Utilities
  DEFAULT_CSV_MAPPING,
} from './ingestion/index.js';

export type {
  Platform,
  ImportConfig,
  ImportResult,
  ImportOptions,
  ImportProgress,
  ImportError,
  ProductFetcher as LightweightProductFetcher,
  ShopifyCredentials,
  SquareCredentials,
  CSVCredentials,
  JSONCredentials,
  CSVColumnMapping as IngestionCSVColumnMapping,
  PlatformCredentials,
} from './ingestion/index';

// ============================================================================
// Federation Module
// ============================================================================

// Re-export key federation types for convenience
export type {
  MerchantRegistration,
  MerchantTier,
  MerchantCapabilities,
  FederatedResult,
  FederatedStatus,
  DiscoveredMerchant,
  WellKnownGateway,
} from './federation/types.js';

// Re-export FederationHub for easy access
export { FederationHub, createFederationHub } from './federation/hub.js';

// Re-export integration helpers
export {
  integrateFederation,
  createFederatedGateway,
} from './federation/integration.js';

// For full federation module access, use:
// import { ... } from '@betterdata/commerce-gateway/federation';

// ============================================================================
// Capability Providers (NEW - Merchant Capability Interfaces)
// ============================================================================

// These interfaces abstract internal SCM concepts and expose buyer-friendly APIs.
// OSS: Baseline implementations (simple in-stock, static rates)
// Cloud/SCM: Enhanced implementations (multi-location ATP, dynamic rates)

export {
  // Availability Provider
  SimpleAvailabilityProvider,
  
  // Fulfillment Provider
  StaticFulfillmentProvider,
  DEFAULT_SHIPPING_OPTIONS,
  
  // Verification Provider
  TrustAllVerificationProvider,
  
  // Factory function
  createBaselineProviders,
} from './providers/index.js';

export type {
  // Availability types
  AvailabilityProvider,
  CheckAvailabilityInput,
  CheckAvailabilityOutput,
  
  // Fulfillment types
  FulfillmentProvider,
  GetFulfillmentOptionsInput,
  GetFulfillmentOptionsOutput,
  FulfillmentOption,
  StaticFulfillmentOption,
  
  // Verification types
  VerificationProvider,
  VerificationMethod,
  ChallengeStatus,
  Challenge,
  ChallengeResult,
  
  // Provider bundle types
  BaselineProvidersConfig,
  BaselineProviders,
} from './providers/index';

// ============================================================================
// Capability Discovery (NEW - Runtime Feature Detection)
// ============================================================================

export {
  // Capability sets
  type CapabilitySet,
  type CapabilityGroup,
  type CommerceCapabilityKey,
  type ScmCapabilityKey,
  type GovernanceCapabilityKey,
  type CapabilityRequirement,
  type BuiltInToolName,
  TOOL_CAPABILITY_REQUIREMENTS,
  hasCapability,
  filterToolsByCapabilities,
  merchantCapabilitiesToCapabilitySet,
  capabilitySetToMerchantCapabilities,

  // Types
  type GatewayCapabilities,
  type CapabilityProvider,

  // Factory function
  defaultCapabilities,

  // Constants
  DEFAULT_CAPABILITIES,
  OSS_CAPABILITIES,

  // Utilities
  hasCapabilities,
  isValidCapabilities,
  mergeCapabilities,
} from './capabilities/index.js';

// ============================================================================
// Extension Interfaces (v0.1 Contract - Multi-tenancy Hooks)
// ============================================================================

// These interfaces define extension points for multi-tenancy.
// OSS provides single-tenant stubs; Cloud provides real implementations.

export {
  // OSS Constants
  OSS_DEFAULT_ORG_ID,
  OSS_KEY_PREFIX,
  OSS_TENANT_CONTEXT,
  OSS_GATEWAY_EXTENSIONS,

  // OSS Classes
  OSSTenantContextResolver,
  OSSKeyDeriver,
  OSSEntitlementsChecker,

  // OSS Factory Functions
  createOSSTenantContextResolver,
  createOSSKeyDeriver,
  ossKeyDeriverFactory,
  createOSSEntitlementsChecker,
  createOSSGatewayExtensions,

  // Singletons
  ossTenantContextResolver,
  ossKeyDeriver,
  ossEntitlementsChecker,
} from './extensions/oss-defaults.js';

export {
  // Entitlement Keys
  GATEWAY_ENTITLEMENT_KEYS,
} from './extensions/interfaces.js';

export type {
  // Interfaces
  TenantContext,
  TenantContextResolver,
  KeyDeriver,
  EntitlementChecker,
  EntitlementsChecker,
  GatewayExtensions as TenantGatewayExtensions,
  GatewayEntitlementKey,
} from './extensions/interfaces';

// ============================================================================
// Feature Flags (v0.1 Contract - Capability Gating)
// ============================================================================

export {
  // Feature flag state
  featureFlags,

  // Helper functions
  isFeatureEnabled,
  isExperimentalFeature,
  isCloudOnlyFeature,
  getFeatureFlagConfig,
  validateOSSFeatureFlags,

  // Constants
  FEATURE_FLAGS,
} from './feature-flags.js';

export type {
  FeatureFlagConfig,
  FeatureFlagKey,
} from './feature-flags';

// ============================================================================
// Version
// ============================================================================

export { VERSION } from './version.js';
