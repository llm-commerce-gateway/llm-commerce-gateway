/**
 * Cloud Module
 *
 * Cloud-only features for Better Data Cloud deployments.
 * These modules integrate with the entitlement system and provide
 * enhanced capabilities not available in the OSS version.
 *
 * @example
 * ```typescript
 * import {
 *   CloudCapabilityProvider,
 *   createCloudCapabilityProvider,
 *   CapabilityGate,
 *   createCloudCapabilityGate,
 * } from '@betterdata/commerce-gateway/cloud';
 * ```
 */

export {
  // Capability Discovery
  CloudCapabilityProvider,
  createCloudCapabilityProvider,
  createOSSCapabilityProvider,
  getCapabilityComparison,
  GATEWAY_ENTITLEMENT_KEYS,
  // Types
  type CloudCapabilityConfig,
  type CloudCapabilityResult,
  type EntitlementChecker,
  type GatewayEntitlementKey,
  type GatewayCapabilities,
  type CapabilityProvider,
  OSS_CAPABILITIES,
} from './capability-discovery';

export {
  // Capability Gate
  CapabilityGate,
  CapabilityNotEnabledError,
  createCloudCapabilityGate,
  createOSSCapabilityGate,
  OSS_CAPABILITY_GATE,
  CAPABILITY_ENTITLEMENT_MAP,
  PROVIDER_REQUIRED_CAPABILITIES,
  // Types
  type CapabilityGateConfig,
  type CapabilityCheckResult,
} from './capability-gate';

