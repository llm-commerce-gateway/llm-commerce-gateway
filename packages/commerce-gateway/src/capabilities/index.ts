/**
 * @betterdata/commerce-gateway - Capabilities Module
 *
 * Runtime capability discovery for federated gateways.
 *
 * @example
 * ```typescript
 * import {
 *   type GatewayCapabilities,
 *   type CapabilityProvider,
 *   hasCapabilities,
 *   DEFAULT_CAPABILITIES,
 * } from '@betterdata/commerce-gateway/capabilities';
 * ```
 *
 * @license MIT
 */

export {
  // Types
  type GatewayCapabilities,
  type CapabilityProvider,

  // Factory function
  defaultCapabilities,

  // Constants
  DEFAULT_CAPABILITIES,
  OSS_CAPABILITIES,

  // Type guards & utilities
  hasCapabilities,
  isValidCapabilities,
  mergeCapabilities,
} from './types';

export {
  type CapabilitySet,
  type CapabilityGroup,
  type CommerceCapabilityKey,
  type ScmCapabilityKey,
  type GovernanceCapabilityKey,
  type CapabilityRequirement,
  type BuiltInToolName,
  TOOL_CAPABILITY_REQUIREMENTS,
  hasCapability,
  formatCapabilityRequirement,
  getRequiredCapabilitiesForTool,
  filterToolsByCapabilities,
  defaultCommerceCapabilitySet,
  merchantCapabilitiesToCapabilitySet,
  capabilitySetToMerchantCapabilities,
} from './capability-set';
