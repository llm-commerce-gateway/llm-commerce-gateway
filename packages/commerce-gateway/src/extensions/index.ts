/**
 * @betterdata/commerce-gateway - Extensions Module
 *
 * Extension interfaces and OSS defaults for multi-tenancy hooks.
 *
 * ## OSS vs Cloud
 *
 * OSS deployments use the default single-tenant implementations:
 * - No tenant isolation
 * - Global Redis keyspace
 * - No permission enforcement
 *
 * Cloud deployments provide real implementations for:
 * - Multi-tenant isolation
 * - Namespaced key derivation
 * - RBAC / entitlements
 *
 * @example
 * ```typescript
 * import {
 *   createOSSTenantContextResolver,
 *   createOSSKeyDeriver,
 *   createOSSEntitlementsChecker,
 *   OSS_GATEWAY_EXTENSIONS,
 * } from '@betterdata/commerce-gateway/extensions';
 *
 * // Use defaults (single-tenant)
 * const gateway = createGateway({
 *   // ... config
 *   extensions: OSS_GATEWAY_EXTENSIONS,
 * });
 * ```
 *
 * @license MIT
 */

// Interfaces
export type {
  TenantContext,
  TenantContextResolver,
  KeyDeriver,
  EntitlementChecker,
  EntitlementsChecker,
  GatewayExtensions,
  GatewayEntitlementKey,
} from './interfaces';

export { GATEWAY_ENTITLEMENT_KEYS } from './interfaces';

// OSS Defaults
export {
  // Constants
  OSS_DEFAULT_ORG_ID,
  OSS_KEY_PREFIX,
  OSS_TENANT_CONTEXT,
  OSS_GATEWAY_EXTENSIONS,

  // Classes
  OSSTenantContextResolver,
  OSSKeyDeriver,
  OSSEntitlementsChecker,

  // Factory functions
  createOSSTenantContextResolver,
  createOSSKeyDeriver,
  ossKeyDeriverFactory,
  createOSSEntitlementsChecker,
  createOSSGatewayExtensions,

  // Singletons
  ossTenantContextResolver,
  ossKeyDeriver,
  ossEntitlementsChecker,
} from './oss-defaults';
