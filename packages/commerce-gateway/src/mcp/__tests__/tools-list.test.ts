import { describe, it, expect } from 'vitest';
import { getMCPToolDefinitions } from '../tools';
import type { CapabilitySet } from '../../capabilities';

describe('MCP tools/list gating', () => {
  it('returns only tools allowed by capability set', () => {
    const enabledTools = [
      'search_products',
      'get_product_details',
      'check_inventory',
      'shop',
      'get_shipment_status',
    ];

    const capabilitySet: CapabilitySet = {
      commerce: {
        'catalog.search': true,
        'catalog.details': true,
        'availability.check': false,
      },
      governance: {
        'discovery.registry': false,
      },
      scm: {
        'shipment.tracking': false,
      },
    };

    const tools = getMCPToolDefinitions(enabledTools, capabilitySet);
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(['search_products', 'get_product_details']);
    expect(tools[0]?.requiredCapabilities).toEqual(['commerce.catalog.search']);
  });
});
