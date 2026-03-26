/**
 * @betterdata/commerce-gateway - Federation Integration
 *
 * Integrates federation capabilities into the existing LLMGateway.
 * Provides both Hub mode (routes to merchants) and Merchant mode (advertises to hubs).
 *
 * @example
 * ```typescript
 * import { LLMGateway } from '@betterdata/commerce-gateway';
 * import { integrateFederation, FederatedGatewayOptions } from '@betterdata/commerce-gateway/federation';
 *
 * // Create gateway with federation
 * const gateway = new LLMGateway({ backends: myBackends });
 *
 * // Add federation as a hub
 * await integrateFederation(gateway, {
 *   mode: 'hub',
 *   hub: {
 *     registry: { type: 'file', filePath: './merchants.json' },
 *     discovery: { type: 'tag-based' },
 *   },
 * });
 *
 * // Or add federation as a merchant
 * await integrateFederation(gateway, {
 *   mode: 'merchant',
 *   merchant: {
 *     config: {
 *       domain: 'mystore.com',
 *       name: 'My Store',
 *       categories: ['fashion'],
 *     },
 *   },
 * });
 * ```
 *
 * @license Apache-2.0
 */

import type { Hono } from 'hono';
import type { MerchantRegistration } from './types';
import { FederationHub, type FederationHubOptions } from './hub';
import {
  createWellKnownRoutes,
  type WellKnownConfig,
  type BackendAvailability,
} from './well-known/routes';
import {
  ShopMerchantTool,
  DiscoverMerchantsTool,
  SHOP_MERCHANT_TOOL_DEFINITION,
  DISCOVER_MERCHANTS_TOOL_DEFINITION,
  ShopMerchantArgsSchema,
  DiscoverMerchantsArgsSchema,
  type DiscoveryProvider as ToolDiscoveryProvider,
} from './tools/index';
import type { DiscoveryProvider as HubDiscoveryProvider } from './discovery/interface';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Hub mode configuration.
 */
export interface HubModeConfig extends FederationHubOptions {
  /** Base path for federation routes (default: "/api/federation") */
  basePath?: string;

  /** Register federation tools with the gateway */
  registerTools?: boolean;
}

/**
 * Merchant mode configuration.
 */
export interface MerchantModeConfig {
  /** Well-known configuration */
  config: WellKnownConfig;

  /** Private key for signing verification callbacks */
  privateKey?: string;

  /** Key ID for the private key */
  keyId?: string;

  /** Backend availability (for capability inference) */
  backends?: BackendAvailability;
}

/**
 * Federation options for LLMGateway.
 */
export type FederatedGatewayOptions =
  | { mode: 'hub'; hub: HubModeConfig }
  | { mode: 'merchant'; merchant: MerchantModeConfig }
  | { mode: 'both'; hub: HubModeConfig; merchant: MerchantModeConfig };

/**
 * Result of federation integration.
 */
export interface FederationIntegrationResult {
  /** Federation hub (if hub mode enabled) */
  hub?: FederationHub;

  /** Whether merchant mode is enabled */
  merchantMode?: boolean;
}

// ============================================================================
// Main Integration Function
// ============================================================================

/**
 * Integrate federation capabilities into an existing LLMGateway.
 *
 * @param gateway - LLMGateway instance (or its Hono app)
 * @param options - Federation options
 * @returns Integration result with hub instance and registration status
 *
 * @example
 * ```typescript
 * // Hub mode - routes to multiple merchants
 * const gateway = new LLMGateway({ backends: myBackends });
 * const { hub } = await integrateFederation(gateway, {
 *   mode: 'hub',
 *   hub: {
 *     registry: { type: 'memory' },
 *     discovery: { type: 'tag-based' },
 *     fallback: { suggestAlternatives: true },
 *   },
 * });
 *
 * // Register merchants
 * await hub.registerMerchant({ ... });
 *
 * // Merchant mode - advertises gateway for federation discovery
 * await integrateFederation(gateway, {
 *   mode: 'merchant',
 *   merchant: {
 *     config: {
 *       domain: 'mystore.com',
 *       name: 'My Store',
 *       categories: ['fashion', 'accessories'],
 *     },
 *   },
 * });
 * // Gateway now exposes /.well-known/llm-gateway.json
 * ```
 */
export async function integrateFederation(
  gateway: { getApp(): Hono } | Hono,
  options: FederatedGatewayOptions
): Promise<FederationIntegrationResult> {
  const app = 'getApp' in gateway ? gateway.getApp() : gateway;
  const result: FederationIntegrationResult = {};

  // Handle hub mode
  if (options.mode === 'hub' || options.mode === 'both') {
    const hubConfig = options.mode === 'hub' ? options.hub : options.hub;
    result.hub = await setupHubMode(app, hubConfig);
  }

  // Handle merchant mode
  if (options.mode === 'merchant' || options.mode === 'both') {
    const merchantConfig = options.mode === 'merchant' ? options.merchant : options.merchant;
    await setupMerchantMode(app, merchantConfig);
    result.merchantMode = true;
  }

  return result;
}

// ============================================================================
// Hub Mode Setup
// ============================================================================

/**
 * Set up federation hub mode.
 */
async function setupHubMode(app: Hono, config: HubModeConfig): Promise<FederationHub> {
  const basePath = config.basePath ?? '/api/federation';

  // Create federation hub
  const hub = await FederationHub.create(config);

  // Add federation routes
  addHubRoutes(app, hub, basePath);

  // Register tools if requested
  if (config.registerTools !== false) {
    registerFederationToolsToGlobal(hub);
  }

  return hub;
}

/**
 * Add federation hub routes to the app.
 */
function addHubRoutes(app: Hono, hub: FederationHub, basePath: string): void {
  // ==========================================================================
  // Merchant Management Routes
  // ==========================================================================

  // List registered merchants
  app.get(`${basePath}/merchants`, async (c) => {
    const tier = c.req.query('tier') as 'verified' | 'registered' | 'discovered' | undefined;
    const limit = parseInt(c.req.query('limit') ?? '100');

    const merchants = await hub.listMerchants({ tier, limit });

    return c.json({
      success: true,
      data: {
        merchants,
        total: merchants.length,
      },
    });
  });

  // Get merchant details
  app.get(`${basePath}/merchants/:domain`, async (c) => {
    const domain = c.req.param('domain');
    const merchant = await hub.getMerchant(domain);

    if (!merchant) {
      return c.json({ success: false, error: 'Merchant not found' }, 404);
    }

    return c.json({ success: true, data: merchant });
  });

  // Register new merchant
  app.post(`${basePath}/merchants`, async (c) => {
    try {
      const merchant = await c.req.json<MerchantRegistration>();
      await hub.registerMerchant(merchant);

      return c.json({
        success: true,
        data: { domain: merchant.domain, message: 'Merchant registered' },
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed',
        },
        400
      );
    }
  });

  // Update merchant
  app.put(`${basePath}/merchants/:domain`, async (c) => {
    try {
      const domain = c.req.param('domain');
      const updates = await c.req.json<Partial<MerchantRegistration>>();

      const existing = await hub.getMerchant(domain);
      if (!existing) {
        return c.json({ success: false, error: 'Merchant not found' }, 404);
      }

      await hub.registerMerchant({ ...existing, ...updates, domain });

      return c.json({ success: true, data: { domain, message: 'Merchant updated' } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Update failed',
        },
        400
      );
    }
  });

  // Unregister merchant
  app.delete(`${basePath}/merchants/:domain`, async (c) => {
    const domain = c.req.param('domain');
    const result = await hub.unregisterMerchant(domain);

    if (!result) {
      return c.json({ success: false, error: 'Merchant not found' }, 404);
    }

    return c.json({ success: true, data: { domain, message: 'Merchant unregistered' } });
  });

  // Verify merchant
  app.post(`${basePath}/merchants/:domain/verify`, async (c) => {
    const domain = c.req.param('domain');
    const body = await c.req.json<{ method?: 'dns' | 'meta_tag' | 'api_callback' }>();

    const verified = await hub.verifyMerchant(domain, body.method ?? 'api_callback');

    return c.json({
      success: true,
      data: { domain, verified },
    });
  });

  // ==========================================================================
  // Search Routes
  // ==========================================================================

  // Federated search (natural language)
  app.post(`${basePath}/search`, async (c) => {
    const body = await c.req.json<{
      input: string;
      sessionId?: string;
      filters?: object;
      limit?: number;
    }>();

    const result = await hub.search(body.input, {
      sessionId: body.sessionId,
      filters: body.filters as any,
      limit: body.limit,
    });

    return c.json({ success: result.status === 'ok', ...result });
  });

  // Direct merchant search
  app.post(`${basePath}/search/:merchant`, async (c) => {
    const merchant = c.req.param('merchant');
    const body = await c.req.json<{
      query: string;
      sessionId?: string;
      filters?: object;
      limit?: number;
    }>();

    const result = await hub.shopMerchant(merchant, body.query, {
      sessionId: body.sessionId,
      filters: body.filters as any,
      limit: body.limit,
    });

    return c.json({ success: result.status === 'ok', ...result });
  });

  // ==========================================================================
  // Discovery Routes
  // ==========================================================================

  // Discover merchants
  app.post(`${basePath}/discover`, async (c) => {
    const body = await c.req.json<{
      query: string;
      category?: string;
      limit?: number;
      tier?: 'verified' | 'registered' | 'discovered';
    }>();

    const merchants = await hub.discoverMerchants(body.query, {
      category: body.category,
      limit: body.limit,
      tier: body.tier,
    });

    return c.json({
      success: true,
      data: { merchants, total: merchants.length },
    });
  });

  // Resolve merchant
  app.get(`${basePath}/resolve`, async (c) => {
    const input = c.req.query('input');

    if (!input) {
      return c.json({ success: false, error: 'Missing input parameter' }, 400);
    }

    const merchant = await hub.resolveMerchant(input);

    if (!merchant) {
      return c.json({
        success: false,
        error: 'Merchant not found',
        data: { input },
      });
    }

    return c.json({ success: true, data: merchant });
  });

  // ==========================================================================
  // Tool Execution Routes
  // ==========================================================================

  // Execute tool on merchant
  app.post(`${basePath}/execute/:merchant`, async (c) => {
    const merchantRef = c.req.param('merchant');
    const body = await c.req.json<{
      tool: string;
      args: Record<string, unknown>;
      sessionId?: string;
    }>();

    const result = await hub.executeToolOnMerchant(
      merchantRef,
      body.tool,
      body.args,
      body.sessionId
    );

    return c.json({ success: result.status === 'ok', ...result });
  });
}

/**
 * Adapter to convert HubDiscoveryProvider to ToolDiscoveryProvider.
 */
function createToolDiscoveryAdapter(
  hubDiscovery: HubDiscoveryProvider
): ToolDiscoveryProvider {
  return {
    discover: async (query, options) => {
      return hubDiscovery.discoverByIntent(query, {
        limit: options?.limit,
        categories: options?.category ? [options.category] : undefined,
        tier: options?.tier,
      });
    },
  };
}

/**
 * Register federation tools with the global ToolRegistry.
 */
function registerFederationToolsToGlobal(hub: FederationHub): void {
  // Dynamically import to avoid circular dependencies
  const { ToolRegistry } = require('../core/ToolRegistry.js');

  const registry = hub.getRegistry();
  const client = hub.getClient();
  const parser = hub.getParser();
  const hubDiscovery = hub.getDiscovery();

  // Create adapter for discovery provider
  const toolDiscovery = createToolDiscoveryAdapter(hubDiscovery);

  // Create tool handlers
  const shopTool = new ShopMerchantTool(registry, client, parser);
  const discoverTool = new DiscoverMerchantsTool(registry, toolDiscovery);

  // Register shop_merchant
  ToolRegistry.register({
    name: SHOP_MERCHANT_TOOL_DEFINITION.name,
    description: SHOP_MERCHANT_TOOL_DEFINITION.description,
    inputSchema: ShopMerchantArgsSchema,
    parameters: SHOP_MERCHANT_TOOL_DEFINITION.parameters,
    handler: async (input: unknown) => {
      const result = await shopTool.execute(input as any);
      return {
        success: result.status === 'ok',
        data: result.status === 'ok' ? result.data : undefined,
        error: result.status !== 'ok' ? result.message : undefined,
        meta: {
          status: result.status,
          attribution: result.attribution,
          alternatives: result.alternatives,
        },
      };
    },
  });

  // Register discover_merchants
  ToolRegistry.register({
    name: DISCOVER_MERCHANTS_TOOL_DEFINITION.name,
    description: DISCOVER_MERCHANTS_TOOL_DEFINITION.description,
    inputSchema: DiscoverMerchantsArgsSchema,
    parameters: DISCOVER_MERCHANTS_TOOL_DEFINITION.parameters,
    handler: async (input: unknown) => {
      const result = await discoverTool.execute(input as any);
      return {
        success: result.status === 'ok',
        data: result.data,
        error: result.status !== 'ok' ? result.message : undefined,
      };
    },
  });
}

// ============================================================================
// Merchant Mode Setup
// ============================================================================

/**
 * Set up federation merchant mode.
 *
 * Adds the .well-known/llm-gateway.json and /api/federation/verify endpoints
 * to advertise this gateway for federation discovery.
 */
async function setupMerchantMode(
  app: Hono,
  config: MerchantModeConfig
): Promise<void> {
  // Add well-known routes
  const wellKnownRoutes = createWellKnownRoutes({
    config: config.config,
    backends: config.backends,
    privateKey: config.privateKey,
    keyId: config.keyId,
  });

  app.route('/', wellKnownRoutes);
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Create an LLMGateway with federation hub capabilities.
 *
 * This is a convenience function that creates a gateway and integrates federation.
 *
 * @param gatewayConfig - LLMGateway configuration
 * @param federationOptions - Federation options
 * @returns Object with gateway and hub
 */
export async function createFederatedGateway(
  GatewayClass: new (config: any) => { getApp(): Hono; start(port?: number): Promise<void> },
  gatewayConfig: any,
  federationOptions: FederatedGatewayOptions
): Promise<{
  gateway: { getApp(): Hono; start(port?: number): Promise<void> };
  federation: FederationIntegrationResult;
}> {
  const gateway = new GatewayClass(gatewayConfig);
  const federation = await integrateFederation(gateway, federationOptions);

  return { gateway, federation };
}

