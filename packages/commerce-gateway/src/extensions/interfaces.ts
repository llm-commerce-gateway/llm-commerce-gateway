/**
 * @betterdata/commerce-gateway - Extension Interfaces
 *
 * These interfaces define the extension points for multi-tenancy, key derivation,
 * and entitlements checking. OSS deployments use single-tenant stubs.
 * Cloud deployments provide real implementations.
 *
 * ## Contract (v0.1)
 *
 * OSS defaults:
 * - Single tenant (no isolation)
 * - Global Redis keyspace
 * - No permission enforcement
 *
 * Cloud provides:
 * - Tenant isolation
 * - Namespaced key derivation
 * - RBAC / entitlements
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 * @license Apache-2.0
 */

// ============================================================================
// Tenant Context Resolution
// ============================================================================

/**
 * Tenant context resolved from a request.
 *
 * In OSS mode, this returns a stub context with no isolation.
 * In Cloud mode, this is populated from authentication/session data.
 */
export interface TenantContext {
  /**
   * Organization/tenant identifier.
   * OSS default: 'default' (single tenant)
   */
  organizationId: string;

  /**
   * User identifier within the tenant.
   * OSS default: undefined (anonymous)
   */
  userId?: string;

  /**
   * Whether this is a Cloud deployment with real isolation.
   * OSS default: false
   */
  isCloud: boolean;

  /**
   * Optional tenant-specific metadata.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Resolves tenant context from incoming requests.
 *
 * ## OSS Behavior
 *
 * Returns a single-tenant stub context:
 * ```typescript
 * {
 *   organizationId: 'default',
 *   userId: undefined,
 *   isCloud: false,
 * }
 * ```
 *
 * ## Cloud Behavior
 *
 * Extracts tenant context from:
 * - API key lookup (organizationId from key metadata)
 * - JWT claims (organizationId, userId from token)
 * - Session data (if authenticated)
 *
 * @example
 * ```typescript
 * // OSS usage (single tenant)
 * const resolver = createOSSTenantContextResolver();
 * const ctx = await resolver.resolve(request);
 * // ctx.organizationId === 'default'
 *
 * // Cloud usage (multi-tenant)
 * const resolver = new CloudTenantContextResolver(authService);
 * const ctx = await resolver.resolve(request);
 * // ctx.organizationId === 'org_abc123'
 * ```
 */
export interface TenantContextResolver {
  /**
   * Resolve tenant context from a request.
   *
   * @param request - The incoming request (Hono Request or compatible)
   * @returns Resolved tenant context
   */
  resolve(request: Request): Promise<TenantContext>;

  /**
   * Resolve tenant context from known values.
   * Useful for internal/background operations.
   *
   * @param organizationId - Known organization ID
   * @param userId - Optional user ID
   * @returns Tenant context
   */
  fromKnown(organizationId: string, userId?: string): TenantContext;
}

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Key derivation strategy for Redis/cache keys.
 *
 * ## OSS Behavior
 *
 * Returns global keys with no tenant namespacing:
 * ```
 * llm-gateway:session:{sessionId}
 * llm-gateway:cart:{cartId}
 * ```
 *
 * ## Cloud Behavior
 *
 * Returns tenant-namespaced keys:
 * ```
 * org:{organizationId}:llm-gateway:session:{sessionId}
 * org:{organizationId}:llm-gateway:cart:{cartId}
 * ```
 *
 * ## Contract Requirement
 *
 * All Redis/session keys MUST pass through a KeyDeriver.
 * CI enforcement validates this requirement.
 *
 * @example
 * ```typescript
 * // OSS usage (global keyspace)
 * const deriver = createOSSKeyDeriver();
 * const key = deriver.deriveSessionKey('sess_123');
 * // key === 'llm-gateway:session:sess_123'
 *
 * // Cloud usage (tenant-isolated)
 * const deriver = createCloudKeyDeriver('org_abc123');
 * const key = deriver.deriveSessionKey('sess_123');
 * // key === 'org:org_abc123:llm-gateway:session:sess_123'
 * ```
 */
export interface KeyDeriver {
  /**
   * Derive a session storage key.
   *
   * @param sessionId - The session identifier
   * @returns Derived Redis key
   */
  deriveSessionKey(sessionId: string): string;

  /**
   * Derive a cart storage key.
   *
   * @param cartId - The cart identifier
   * @returns Derived Redis key
   */
  deriveCartKey(cartId: string): string;

  /**
   * Derive a rate limit key.
   *
   * @param identifier - Rate limit identifier (IP, API key, etc.)
   * @returns Derived Redis key
   */
  deriveRateLimitKey(identifier: string): string;

  /**
   * Derive a generic cache key.
   *
   * @param namespace - Cache namespace (e.g., 'products', 'search')
   * @param key - The cache key
   * @returns Derived Redis key
   */
  deriveCacheKey(namespace: string, key: string): string;

  /**
   * Get the current tenant context for this deriver.
   * Returns undefined for OSS (global) derivers.
   */
  getTenantContext(): TenantContext | undefined;
}

// ============================================================================
// Entitlements Checking
// ============================================================================

/**
 * Entitlement check function type.
 * Cloud deployments provide this from @repo/database.
 *
 * @param organizationId - Organization to check
 * @param entitlementKey - Entitlement key (e.g., 'gateway.discovery.ranked')
 * @returns Whether the entitlement is enabled
 */
export type EntitlementChecker = (
  organizationId: string,
  entitlementKey: string
) => Promise<boolean>;

/**
 * Entitlements service interface.
 *
 * ## OSS Behavior
 *
 * Returns false for all entitlement checks.
 * Cloud-only features are gated at the capability level.
 *
 * ## Cloud Behavior
 *
 * Checks against the organization's entitlements in the database.
 *
 * @example
 * ```typescript
 * // OSS usage (all entitlements denied)
 * const checker = createOSSEntitlementsChecker();
 * const hasFeature = await checker.check('org_123', 'gateway.discovery.ranked');
 * // hasFeature === false
 *
 * // Cloud usage (database lookup)
 * const checker = createCloudEntitlementsChecker(db);
 * const hasFeature = await checker.check('org_123', 'gateway.discovery.ranked');
 * // hasFeature === true/false based on org's plan
 * ```
 */
export interface EntitlementsChecker {
  /**
   * Check if an organization has an entitlement.
   *
   * @param organizationId - Organization to check
   * @param entitlementKey - Entitlement key
   * @returns Whether the entitlement is enabled
   */
  check(organizationId: string, entitlementKey: string): Promise<boolean>;

  /**
   * Check multiple entitlements at once.
   *
   * @param organizationId - Organization to check
   * @param entitlementKeys - Entitlement keys to check
   * @returns Map of entitlement key to enabled status
   */
  checkMany(
    organizationId: string,
    entitlementKeys: string[]
  ): Promise<Map<string, boolean>>;

  /**
   * Whether this is an OSS checker (always returns false).
   */
  isOSS(): boolean;
}

// ============================================================================
// Gateway Extensions Configuration
// ============================================================================

/**
 * Configuration for gateway extension points.
 *
 * OSS deployments can omit this entirely to use defaults.
 * Cloud deployments provide real implementations.
 */
export interface GatewayExtensions {
  /**
   * Tenant context resolver.
   * Default: Single-tenant OSS resolver
   */
  tenantResolver?: TenantContextResolver;

  /**
   * Key derivation factory.
   * Called with tenant context to create a KeyDeriver.
   * Default: Global OSS key deriver
   */
  keyDeriverFactory?: (context?: TenantContext) => KeyDeriver;

  /**
   * Entitlements checker.
   * Default: OSS checker (always returns false)
   */
  entitlements?: EntitlementsChecker;
}

// ============================================================================
// Well-Known Entitlement Keys
// ============================================================================

/**
 * Gateway entitlement keys.
 *
 * These are the entitlement keys used for capability gating.
 * OSS mode ignores these - all capabilities are allowed in OSS.
 */
export const GATEWAY_ENTITLEMENT_KEYS = {
  /** Cloud product registry access */
  REGISTRY_CLOUD: 'gateway.registry.cloud',

  /** ML-powered ranked discovery */
  DISCOVERY_RANKED: 'gateway.discovery.ranked',

  /** Automated verification (DNS, callback) */
  VERIFICATION_AUTOMATED: 'gateway.verification.automated',

  /** Gateway analytics and metrics */
  ANALYTICS_ENABLED: 'gateway.analytics.enabled',

  /** Global federation (public merchant registry) */
  FEDERATION_GLOBAL: 'gateway.federation.global',

  /** Private federation (private merchant hubs) */
  FEDERATION_PRIVATE: 'gateway.federation.private',

  /** Semantic caching (embedding-based) */
  SEMANTIC_CACHING: 'gateway.caching.semantic',

  /** Smart routing (cost/latency optimization) */
  SMART_ROUTING: 'gateway.routing.smart',

  /** SCM tools (PO, shipment, forecast) */
  SCM_TOOLS: 'gateway.tools.scm',
} as const;

export type GatewayEntitlementKey =
  (typeof GATEWAY_ENTITLEMENT_KEYS)[keyof typeof GATEWAY_ENTITLEMENT_KEYS];
