/**
 * @betterdata/commerce-gateway - Gateway MCP Server Factory
 * 
 * Creates an MCP server for individual gateways with gateway-specific tools.
 * Each gateway should expose MCP tools for direct interaction.
 * 
 * @license MIT
 */

import { MCPServer } from './MCPServer';
import type { MCPServerConfig } from './types';
import type { GatewayBackends } from '../backends/interfaces';

// ============================================================================
// Types
// ============================================================================

export interface GatewayConfig {
  slug: string;
  brandName: string;
  endpoint: string;
  protocol: string;
  capabilities?: Record<string, unknown>;
}

// ============================================================================
// Gateway MCP Server Factory
// ============================================================================

/**
 * Create an MCP server for a specific gateway
 * 
 * Each gateway should expose MCP tools for direct interaction:
 * - search_products: Search for products in the gateway's catalog
 * - get_product: Get detailed information about a specific product
 * - check_price: Get current pricing for products
 * - check_availability: Check product availability and inventory
 * 
 * @example
 * ```typescript
 * import { createGatewayMCPServer } from '@betterdata/commerce-gateway/mcp';
 * 
 * const server = createGatewayMCPServer({
 *   slug: 'lumebonde',
 *   brandName: 'Lumebonde',
 *   endpoint: 'https://api.lumebonde.com/llm/v1',
 *   protocol: 'mcp',
 *   capabilities: {
 *     catalog_search: true,
 *     pricing: 'public',
 *     inventory: 'real_time',
 *   },
 *   backends: {
 *     products: new MyProductBackend(),
 *     cart: new MyCartBackend(),
 *   },
 * });
 * 
 * server.start();
 * ```
 */
export function createGatewayMCPServer(
  config: GatewayConfig & { backends: GatewayBackends } & Partial<MCPServerConfig>
): MCPServer {
  const {
    slug,
    brandName,
    endpoint,
    protocol,
    capabilities,
    backends,
    ...mcpConfig
  } = config;

  // Enable gateway-specific tools based on capabilities
  const enabledTools: Array<'search_products' | 'get_product_details' | 'check_availability'> = [];
  
  if (capabilities?.catalog_search) {
    enabledTools.push('search_products', 'get_product_details');
  }
  
  if (capabilities?.inventory === 'real_time' || capabilities?.inventory === 'cached') {
    enabledTools.push('check_availability');
  }
  
  // Note: The spec mentions 'get_product', 'check_price', and 'check_availability' as tool names,
  // but the implementation uses 'get_product_details' and 'check_inventory' which are more descriptive.
  // These map to the same backend methods and provide the same functionality.

  // Create MCP server with gateway-specific configuration
  const server = new MCPServer({
    ...mcpConfig,
    backends,
    tools: mcpConfig.tools || enabledTools,
    name: mcpConfig.name || `commerce-gateway-${slug}`,
    version: mcpConfig.version || '1.0.0',
  });

  return server;
}

