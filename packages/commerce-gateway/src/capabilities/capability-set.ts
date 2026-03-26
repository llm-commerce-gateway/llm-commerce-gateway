/**
 * @betterdata/commerce-gateway - Capability Sets (Commerce + SCM + Governance)
 *
 * Structured capability model for tool gating across runtimes.
 *
 * @license Apache-2.0
 */

import type { MerchantCapabilities } from '../federation/types';

// ============================================================================
// Capability Groups
// ============================================================================

export type CapabilityGroup = 'commerce' | 'scm' | 'governance';

export type CommerceCapabilityKey =
  | 'catalog.search'
  | 'catalog.details'
  | 'availability.check'
  | 'cart.add'
  | 'cart.view'
  | 'cart.update'
  | 'cart.remove'
  | 'order.create'
  | 'recommend.products'
  | 'usage.instructions';

export type ScmCapabilityKey =
  | 'inventory.visibility'
  | 'shipment.tracking'
  | 'procurement.purchaseOrders'
  | 'traceability.events'
  | 'demand.forecast';

export type GovernanceCapabilityKey =
  | 'discovery.registry'
  | 'verification.domain'
  | 'audit.events';

export interface CapabilitySet {
  commerce?: Partial<Record<CommerceCapabilityKey, boolean>>;
  scm?: Partial<Record<ScmCapabilityKey, boolean>>;
  governance?: Partial<Record<GovernanceCapabilityKey, boolean>>;
}

export interface CapabilityRequirement {
  group: CapabilityGroup;
  key: CommerceCapabilityKey | ScmCapabilityKey | GovernanceCapabilityKey;
}

// ============================================================================
// Built-in Tool Requirements
// ============================================================================

export const TOOL_CAPABILITY_REQUIREMENTS = {
  search_products: { group: 'commerce', key: 'catalog.search' },
  get_product_details: { group: 'commerce', key: 'catalog.details' },
  check_availability: { group: 'commerce', key: 'availability.check' },
  add_to_cart: { group: 'commerce', key: 'cart.add' },
  get_cart: { group: 'commerce', key: 'cart.view' },
  update_cart_item: { group: 'commerce', key: 'cart.update' },
  remove_from_cart: { group: 'commerce', key: 'cart.remove' },
  create_order: { group: 'commerce', key: 'order.create' },
  get_recommendations: { group: 'commerce', key: 'recommend.products' },
  get_usage_instructions: { group: 'commerce', key: 'usage.instructions' },
  check_inventory: { group: 'scm', key: 'inventory.visibility' },
  get_shipment_status: { group: 'scm', key: 'shipment.tracking' },
  get_purchase_order_status: { group: 'scm', key: 'procurement.purchaseOrders' },
  get_trace_events: { group: 'scm', key: 'traceability.events' },
  get_demand_forecast: { group: 'scm', key: 'demand.forecast' },
  shop: { group: 'governance', key: 'discovery.registry' },
} as const satisfies Record<string, CapabilityRequirement>;

export type BuiltInToolName = keyof typeof TOOL_CAPABILITY_REQUIREMENTS;

// ============================================================================
// Capability Helpers
// ============================================================================

export function hasCapability(
  capabilitySet: CapabilitySet | undefined,
  requirement: CapabilityRequirement
): boolean {
  if (!capabilitySet) return false;
  const group = capabilitySet[requirement.group] as
    | Record<string, boolean>
    | undefined;
  return Boolean(group?.[requirement.key]);
}

export function formatCapabilityRequirement(
  requirement: CapabilityRequirement
): string {
  return `${requirement.group}.${requirement.key}`;
}

export function getRequiredCapabilitiesForTool(toolName: string): string[] | undefined {
  const requirement = TOOL_CAPABILITY_REQUIREMENTS[toolName as BuiltInToolName];
  if (!requirement) return undefined;
  return [formatCapabilityRequirement(requirement)];
}

export function filterToolsByCapabilities<T extends string>(
  tools: readonly T[],
  capabilitySet?: CapabilitySet
): T[] {
  if (!capabilitySet) return [...tools];

  return tools.filter((tool) => {
    const requirement = TOOL_CAPABILITY_REQUIREMENTS[tool as BuiltInToolName];
    if (!requirement) return true;
    return hasCapability(capabilitySet, requirement);
  });
}

export function defaultCommerceCapabilitySet(): CapabilitySet {
  return {
    commerce: {
      'catalog.search': true,
      'catalog.details': true,
      'availability.check': true,
      'cart.add': true,
      'cart.view': true,
      'cart.update': true,
      'cart.remove': true,
      'order.create': true,
      'recommend.products': true,
      'usage.instructions': true,
    },
    governance: {
      'discovery.registry': true,
    },
  };
}

// ============================================================================
// Compatibility Helpers (MerchantCapabilities)
// ============================================================================

export function merchantCapabilitiesToCapabilitySet(
  merchantCapabilities?: MerchantCapabilities | null
): CapabilitySet {
  if (!merchantCapabilities) return {};

  return {
    commerce: {
      'catalog.search': merchantCapabilities.search,
      'catalog.details': merchantCapabilities.search,
      'cart.add': merchantCapabilities.cart,
      'cart.view': merchantCapabilities.cart,
      'cart.update': merchantCapabilities.cart,
      'cart.remove': merchantCapabilities.cart,
      'order.create': merchantCapabilities.checkout,
      'availability.check': merchantCapabilities.inventory,
      'recommend.products': merchantCapabilities.recommendations,
    },
  };
}

export function capabilitySetToMerchantCapabilities(
  capabilitySet?: CapabilitySet | null
): MerchantCapabilities {
  const commerce = capabilitySet?.commerce ?? {};
  const hasCart =
    Boolean(commerce['cart.add']) ||
    Boolean(commerce['cart.view']) ||
    Boolean(commerce['cart.update']) ||
    Boolean(commerce['cart.remove']);

  return {
    search: Boolean(commerce['catalog.search']),
    cart: hasCart,
    checkout: Boolean(commerce['order.create']),
    inventory: Boolean(commerce['availability.check']),
    recommendations: Boolean(commerce['recommend.products']),
  };
}
