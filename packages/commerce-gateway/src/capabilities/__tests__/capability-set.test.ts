import { describe, it, expect } from 'vitest';
import {
  filterToolsByCapabilities,
  merchantCapabilitiesToCapabilitySet,
  capabilitySetToMerchantCapabilities,
  type CapabilitySet,
} from '../capability-set';

describe('CapabilitySet', () => {
  it('filters tools by capability set', () => {
    const tools = [
      'search_products',
      'get_product_details',
      'check_inventory',
      'create_order',
      'custom_tool',
    ] as const;

    const capabilitySet: CapabilitySet = {
      commerce: {
        'catalog.search': true,
        'catalog.details': true,
        'availability.check': false,
        'order.create': true,
      },
    };

    const filtered = filterToolsByCapabilities(tools, capabilitySet);

    expect(filtered).toEqual([
      'search_products',
      'get_product_details',
      'create_order',
      'custom_tool',
    ]);
  });

  it('maps MerchantCapabilities to CapabilitySet and back', () => {
    const capabilitySet = merchantCapabilitiesToCapabilitySet({
      search: true,
      cart: false,
      checkout: true,
      inventory: false,
      recommendations: true,
    });

    expect(capabilitySet.commerce?.['catalog.search']).toBe(true);
    expect(capabilitySet.commerce?.['cart.add']).toBe(false);
    expect(capabilitySet.commerce?.['order.create']).toBe(true);
    expect(capabilitySet.commerce?.['availability.check']).toBe(false);
    expect(capabilitySet.commerce?.['recommend.products']).toBe(true);

    const roundTrip = capabilitySetToMerchantCapabilities(capabilitySet);

    expect(roundTrip).toEqual({
      search: true,
      cart: false,
      checkout: true,
      inventory: false,
      recommendations: true,
    });
  });
});
