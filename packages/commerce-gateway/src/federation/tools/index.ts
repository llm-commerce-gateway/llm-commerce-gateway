/**
 * @betterdata/commerce-gateway - Federation Tools Module
 *
 * LLM-callable tools for federated commerce operations.
 * Compatible with MCP (Anthropic), OpenAI Functions, and other LLM formats.
 *
 * @example
 * ```typescript
 * import {
 *   registerFederationTools,
 *   ShopMerchantTool,
 *   DiscoverMerchantsTool,
 * } from '@betterdata/commerce-gateway/federation';
 *
 * // Register with existing LLMGateway
 * registerFederationTools(gateway, { registry, client, parser });
 *
 * // Or use tools directly
 * const shopTool = new ShopMerchantTool(registry, client, parser);
 * const result = await shopTool.execute({ merchant: 'vuori', query: 'joggers' });
 * ```
 *
 * @license MIT
 */

import { ToolRegistry } from '../../core/ToolRegistry';
import type { MerchantRegistry } from '../registry/interface';
import type { GatewayClient } from '../client/gateway-client';
import type { IntentParser } from '../router/intent-parser';

// ============================================================================
// Shop Merchant Tool Exports
// ============================================================================

export {
  ShopMerchantTool,
  createShopMerchantTool,
  ShopMerchantArgsSchema,
  SHOP_MERCHANT_TOOL_DEFINITION,
  type ShopMerchantArgs,
} from './shop-merchant';

// ============================================================================
// Discover Merchants Tool Exports
// ============================================================================

export {
  DiscoverMerchantsTool,
  createDiscoverMerchantsTool,
  DefaultDiscoveryProvider,
  DiscoverMerchantsArgsSchema,
  DISCOVER_MERCHANTS_TOOL_DEFINITION,
  type DiscoverMerchantsArgs,
  type DiscoveryProvider,
} from './discover-merchants';

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Options for registering federation tools.
 */
export interface FederationToolsOptions {
  /** Merchant registry */
  registry: MerchantRegistry;

  /** Gateway client for cross-gateway calls */
  client: GatewayClient;

  /** Intent parser for resolution and suggestions */
  parser: IntentParser;

  /** Optional custom discovery provider */
  discoveryProvider?: import('./discover-merchants.js').DiscoveryProvider;

  /** Which tools to register (default: all) */
  tools?: Array<'shop_merchant' | 'discover_merchants'>;
}

/**
 * Register federation tools with the global ToolRegistry.
 *
 * This makes the tools available to LLMGateway instances for MCP and OpenAI.
 *
 * @param options - Registration options
 *
 * @example
 * ```typescript
 * import { registerFederationTools, MemoryMerchantRegistry, GatewayClient, IntentParser } from '@betterdata/commerce-gateway/federation';
 *
 * const registry = new MemoryMerchantRegistry([...merchants]);
 * const client = new GatewayClient();
 * const parser = new IntentParser({ registry });
 *
 * registerFederationTools({ registry, client, parser });
 *
 * // Now shop_merchant and discover_merchants are available
 * ```
 */
export function registerFederationTools(options: FederationToolsOptions): void {
  const {
    registry,
    client,
    parser,
    discoveryProvider,
    tools = ['shop_merchant', 'discover_merchants'],
  } = options;

  // Import tools (dynamic to avoid circular deps)
  const { ShopMerchantTool, SHOP_MERCHANT_TOOL_DEFINITION, ShopMerchantArgsSchema } =
    require('./shop-merchant.js');
  const {
    DiscoverMerchantsTool,
    DISCOVER_MERCHANTS_TOOL_DEFINITION,
    DiscoverMerchantsArgsSchema,
  } = require('./discover-merchants.js');

  // Register shop_merchant
  if (tools.includes('shop_merchant')) {
    const shopTool = new ShopMerchantTool(registry, client, parser);

    ToolRegistry.register({
      name: SHOP_MERCHANT_TOOL_DEFINITION.name,
      description: SHOP_MERCHANT_TOOL_DEFINITION.description,
      inputSchema: ShopMerchantArgsSchema,
      parameters: SHOP_MERCHANT_TOOL_DEFINITION.parameters,
      handler: async (input: unknown) => {
        const result = await shopTool.execute(input as import('./shop-merchant.js').ShopMerchantArgs);
        return {
          success: result.status === 'ok',
          data: result.status === 'ok' ? result.data : undefined,
          error: result.status !== 'ok' ? result.message : undefined,
          // Include additional info for LLM context
          meta: {
            status: result.status,
            attribution: result.attribution,
            alternatives: result.alternatives,
            timing: result.timing,
          },
        };
      },
      options: {
        requiresAuth: false,
        rateLimit: { requests: 50, windowMs: 60000 },
      },
    });
  }

  // Register discover_merchants
  if (tools.includes('discover_merchants')) {
    const discoverTool = new DiscoverMerchantsTool(registry, discoveryProvider);

    ToolRegistry.register({
      name: DISCOVER_MERCHANTS_TOOL_DEFINITION.name,
      description: DISCOVER_MERCHANTS_TOOL_DEFINITION.description,
      inputSchema: DiscoverMerchantsArgsSchema,
      parameters: DISCOVER_MERCHANTS_TOOL_DEFINITION.parameters,
      handler: async (input: unknown) => {
        const result = await discoverTool.execute(
          input as import('./discover-merchants.js').DiscoverMerchantsArgs
        );
        return {
          success: result.status === 'ok',
          data: result.data,
          error: result.status !== 'ok' ? result.message : undefined,
          meta: {
            status: result.status,
            message: result.message,
          },
        };
      },
      options: {
        requiresAuth: false,
        rateLimit: { requests: 100, windowMs: 60000 },
      },
    });
  }
}

/**
 * Get tool definitions for all federation tools.
 *
 * Useful for manually registering with custom LLM integrations.
 */
export function getFederationToolDefinitions(): Array<{
  name: string;
  description: string;
  parameters: object;
}> {
  const { SHOP_MERCHANT_TOOL_DEFINITION } = require('./shop-merchant.js');
  const { DISCOVER_MERCHANTS_TOOL_DEFINITION } = require('./discover-merchants.js');

  return [SHOP_MERCHANT_TOOL_DEFINITION, DISCOVER_MERCHANTS_TOOL_DEFINITION];
}

/**
 * Get tool definitions formatted for OpenAI function calling.
 */
export function getFederationToolsForOpenAI(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: object };
}> {
  return getFederationToolDefinitions().map(def => ({
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}

/**
 * Get tool definitions formatted for Anthropic MCP.
 */
export function getFederationToolsForMCP(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return getFederationToolDefinitions().map(def => ({
    name: def.name,
    description: def.description,
    inputSchema: def.parameters,
  }));
}

