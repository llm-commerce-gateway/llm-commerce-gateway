/**
 * @betterdata/llm-gateway - OSS Defaults
 *
 * Single-tenant stub implementations for OSS deployments.
 * These provide the extension interfaces without any isolation or enforcement.
 *
 * ## Contract (v0.1)
 *
 * OSS defaults:
 * - Single tenant (organizationId: 'default')
 * - Global Redis keyspace (no tenant namespacing)
 * - No permission enforcement (all checks pass or return false for entitlements)
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 * @license MIT
 */

import type {
  TenantContext,
  TenantContextResolver,
  KeyDeriver,
  EntitlementsChecker,
  GatewayExtensions,
} from './interfaces';

// ============================================================================
// OSS Constants
// ============================================================================

/**
 * Default organization ID for OSS single-tenant mode.
 */
export const OSS_DEFAULT_ORG_ID = 'default';

/**
 * Default key prefix for OSS Redis keys.
 */
export const OSS_KEY_PREFIX = 'llm-gateway';

// ============================================================================
// OSS Tenant Context Resolver
// ============================================================================

/**
 * Single-tenant context for OSS deployments.
 */
export const OSS_TENANT_CONTEXT: TenantContext = {
  organizationId: OSS_DEFAULT_ORG_ID,
  userId: undefined,
  isCloud: false,
  metadata: { mode: 'oss' },
};

/**
 * OSS tenant context resolver.
 *
 * Always returns the same single-tenant context.
 * No authentication or session lookup is performed.
 */
export class OSSTenantContextResolver implements TenantContextResolver {
  /**
   * Resolve tenant context from a request.
   * In OSS mode, always returns the default single-tenant context.
   */
  async resolve(_request: Request): Promise<TenantContext> {
    return OSS_TENANT_CONTEXT;
  }

  /**
   * Create tenant context from known values.
   * In OSS mode, ignores the organizationId and returns the default context.
   */
  fromKnown(_organizationId: string, userId?: string): TenantContext {
    return {
      ...OSS_TENANT_CONTEXT,
      userId,
    };
  }
}

/**
 * Create an OSS tenant context resolver.
 */
export function createOSSTenantContextResolver(): TenantContextResolver {
  return new OSSTenantContextResolver();
}

// ============================================================================
// OSS Key Deriver
// ============================================================================

/**
 * OSS key deriver with global (non-tenant-namespaced) keys.
 *
 * Key format: `llm-gateway:{namespace}:{key}`
 *
 * This provides no tenant isolation - all keys are in the same keyspace.
 */
export class OSSKeyDeriver implements KeyDeriver {
  private readonly prefix: string;

  constructor(prefix: string = OSS_KEY_PREFIX) {
    this.prefix = prefix;
  }

  /**
   * Derive a session storage key.
   * Format: `llm-gateway:session:{sessionId}`
   */
  deriveSessionKey(sessionId: string): string {
    return `${this.prefix}:session:${sessionId}`;
  }

  /**
   * Derive a cart storage key.
   * Format: `llm-gateway:cart:{cartId}`
   */
  deriveCartKey(cartId: string): string {
    return `${this.prefix}:cart:${cartId}`;
  }

  /**
   * Derive a rate limit key.
   * Format: `llm-gateway:ratelimit:{identifier}`
   */
  deriveRateLimitKey(identifier: string): string {
    return `${this.prefix}:ratelimit:${identifier}`;
  }

  /**
   * Derive a generic cache key.
   * Format: `llm-gateway:cache:{namespace}:{key}`
   */
  deriveCacheKey(namespace: string, key: string): string {
    return `${this.prefix}:cache:${namespace}:${key}`;
  }

  /**
   * Get the tenant context (undefined for OSS).
   */
  getTenantContext(): TenantContext | undefined {
    return undefined;
  }
}

/**
 * Create an OSS key deriver.
 *
 * @param prefix - Optional custom prefix (default: 'llm-gateway')
 */
export function createOSSKeyDeriver(prefix?: string): KeyDeriver {
  return new OSSKeyDeriver(prefix);
}

/**
 * Default OSS key deriver factory.
 * Ignores tenant context and returns a global deriver.
 */
export function ossKeyDeriverFactory(_context?: TenantContext): KeyDeriver {
  return new OSSKeyDeriver();
}

// ============================================================================
// OSS Entitlements Checker
// ============================================================================

/**
 * OSS entitlements checker.
 *
 * Always returns false for all entitlement checks.
 * Cloud-only features are gated at the capability level.
 */
export class OSSEntitlementsChecker implements EntitlementsChecker {
  /**
   * Check if an organization has an entitlement.
   * In OSS mode, always returns false.
   */
  async check(
    _organizationId: string,
    _entitlementKey: string
  ): Promise<boolean> {
    return false;
  }

  /**
   * Check multiple entitlements at once.
   * In OSS mode, all entitlements return false.
   */
  async checkMany(
    _organizationId: string,
    entitlementKeys: string[]
  ): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    for (const key of entitlementKeys) {
      result.set(key, false);
    }
    return result;
  }

  /**
   * Whether this is an OSS checker.
   */
  isOSS(): boolean {
    return true;
  }
}

/**
 * Create an OSS entitlements checker.
 */
export function createOSSEntitlementsChecker(): EntitlementsChecker {
  return new OSSEntitlementsChecker();
}

// ============================================================================
// OSS Gateway Extensions
// ============================================================================

/**
 * Default OSS gateway extensions.
 *
 * Use this when no custom extensions are provided.
 */
export const OSS_GATEWAY_EXTENSIONS: GatewayExtensions = {
  tenantResolver: new OSSTenantContextResolver(),
  keyDeriverFactory: ossKeyDeriverFactory,
  entitlements: new OSSEntitlementsChecker(),
};

/**
 * Create OSS gateway extensions.
 *
 * @param options - Optional customization
 * @returns Gateway extensions for OSS mode
 */
export function createOSSGatewayExtensions(options?: {
  keyPrefix?: string;
}): GatewayExtensions {
  const keyDeriver = new OSSKeyDeriver(options?.keyPrefix);

  return {
    tenantResolver: new OSSTenantContextResolver(),
    keyDeriverFactory: () => keyDeriver,
    entitlements: new OSSEntitlementsChecker(),
  };
}

// ============================================================================
// Singleton Instances
// ============================================================================

/**
 * Default OSS tenant context resolver (singleton).
 */
export const ossTenantContextResolver = new OSSTenantContextResolver();

/**
 * Default OSS key deriver (singleton).
 */
export const ossKeyDeriver = new OSSKeyDeriver();

/**
 * Default OSS entitlements checker (singleton).
 */
export const ossEntitlementsChecker = new OSSEntitlementsChecker();
