/**
 * Commerce Registry MCP Server
 * 
 * Model Context Protocol server for direct LLM integration with the Commerce Gateway Registry.
 * Exposes @shop resolution and gateway interaction tools.
 * 
 * @see https://modelcontextprotocol.io/
 * @license Apache-2.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { jwtVerify } from 'jose';
import { RegistryClient, parseShopQuery, type BrandResolution, type GTINResolution } from '@betterdata/commerce-gateway';
import {
  METRICS,
  createCorrelationId,
  incrementCounter,
  logStructured,
  startTimerSeconds,
  startTrace,
} from './telemetry.js';
import { FLAG_OWNERS, isEnabled } from './flags.js';
import { requireTenantContext } from './context.js';
import { MemoryRegistryStore } from './store/memory.js';
import type { RegistryToolContext } from './tools/context.js';
import { ALL_TOOLS } from './tools/index.js';

// ============================================================================
// Configuration
// ============================================================================

const REGISTRY_URL = process.env.REGISTRY_URL || 'https://registry.betterdata.co';
const registryClient = new RegistryClient({
  baseUrl: REGISTRY_URL,
  timeout: 10000,
});

// ============================================================================
// Tenant Context Resolution
// ============================================================================

interface TenantContextParams {
  apiKey?: string;
  organizationId?: string;
  sessionToken?: string;
  userId?: string;
  roleKeys?: string[];
  isSuperAdmin?: boolean;
}

interface MCPInitializeParams {
  protocolVersion?: string;
  capabilities?: object;
  clientInfo?: object;
  tenantContext?: TenantContextParams;
}

type ResolvedTenantContext = {
  organizationId: string;
  userId?: string;
  roleKeys?: string[];
  isSuperAdmin?: boolean;
};

// OSS: in-memory store — no @repo/database or @repo/security
const memoryStore = new MemoryRegistryStore();

let sessionContext: RegistryToolContext | null = null;

async function verifyNextAuthToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** OSS tenant resolution — no DB. Uses params, JWT, or env defaults. */
async function resolveTenantContext(
  params?: TenantContextParams,
): Promise<ResolvedTenantContext | null> {
  if (!params) {
    return {
      organizationId: process.env.REGISTRY_ORG_ID ?? 'default',
      userId: process.env.REGISTRY_USER_ID ?? 'self-hosted-user',
      isSuperAdmin: false,
    };
  }

  if (params.organizationId) {
    return {
      organizationId: params.organizationId,
      userId: params.userId,
      roleKeys: params.roleKeys,
      isSuperAdmin: params.isSuperAdmin ?? false,
    };
  }

  if (params.sessionToken) {
    const payload = await verifyNextAuthToken(params.sessionToken);
    if (!payload?.sub) return null;
    const tokenOrgId = (payload.organizationId || payload.activeOrganizationId) as string | undefined;
    return {
      organizationId: tokenOrgId ?? 'default',
      userId: payload.sub as string,
      roleKeys: params.roleKeys,
      isSuperAdmin: (payload.isSuperAdmin as boolean) ?? false,
    };
  }

  if (params.apiKey) {
    // OSS: no API key lookup. Use env or default.
    return {
      organizationId: process.env.REGISTRY_ORG_ID ?? 'default',
      userId: process.env.REGISTRY_USER_ID ?? 'self-hosted-user',
      isSuperAdmin: false,
    };
  }

  return null;
}

// ============================================================================
// Gateway Client Factory
// ============================================================================

/**
 * Create a gateway client for a resolved gateway
 */
function createGatewayClient(gateway: {
  endpoint: string;
  protocol: string;
  capabilities?: Record<string, unknown>;
}) {
  // In a full implementation, this would create a protocol-specific client
  // For now, return a simple fetch-based client
  return {
    async getProductByGTIN(gtin: string) {
      const response = await fetch(`${gateway.endpoint}/product/gtin/${gtin}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) throw new Error(`Gateway error: ${response.statusText}`);
      return response.json();
    },
    async search(query: string, filters?: Record<string, unknown>) {
      const response = await fetch(`${gateway.endpoint}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, filters }),
      });
      if (!response.ok) throw new Error(`Gateway error: ${response.statusText}`);
      return response.json();
    },
    async browse() {
      const response = await fetch(`${gateway.endpoint}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: '', limit: 20 }),
      });
      if (!response.ok) throw new Error(`Gateway error: ${response.statusText}`);
      return response.json();
    },
    async getPricing(productIds: string[]) {
      const response = await fetch(`${gateway.endpoint}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ product_ids: productIds }),
      });
      if (!response.ok) throw new Error(`Gateway error: ${response.statusText}`);
      return response.json();
    },
    async getAvailability(productIds: string[], location?: string) {
      const response = await fetch(`${gateway.endpoint}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ product_ids: productIds, location }),
      });
      if (!response.ok) throw new Error(`Gateway error: ${response.statusText}`);
      return response.json();
    },
  };
}

// ============================================================================
// Format Helpers
// ============================================================================

type ProductResult = {
  products?: Array<{
    name?: string;
    title?: string;
    price?: string | number;
    description?: string;
    id?: string;
  }>;
  total?: number;
};

function formatProductResults(brand: string, result: unknown): string {
  const typedResult = result as ProductResult;
  if (typedResult.products && Array.isArray(typedResult.products)) {
    const products = typedResult.products.slice(0, 10);
    const lines = [`Found ${typedResult.total || products.length} products from ${brand}:\n`];
    products.forEach((p) => {
      lines.push(`- ${p.name || p.title || 'Product'}`);
      if (p.price) lines.push(`  Price: ${p.price}`);
      if (p.description) lines.push(`  ${p.description.substring(0, 100)}...`);
    });
    return lines.join('\n');
  }
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// Type Guards
// ============================================================================

function isBrandResolution(
  r: BrandResolution | GTINResolution
): r is BrandResolution {
  return typeof (r as any)?.brand === 'string' || (r as any)?.gateway != null;
}

function isGTINResolution(
  r: BrandResolution | GTINResolution
): r is GTINResolution {
  return (r as any)?.gtin != null || (r as any)?.authoritative_source != null;
}

function validateGatewayMetadata(gatewayInfo: {
  endpoint?: unknown;
  protocol?: unknown;
  capabilities?: Record<string, unknown>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof gatewayInfo.endpoint !== 'string' || gatewayInfo.endpoint.length === 0) {
    errors.push('missing_endpoint');
  }

  if (typeof gatewayInfo.protocol !== 'string' || gatewayInfo.protocol.length === 0) {
    errors.push('missing_protocol');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleShopQuery(
  query: string,
  _intent: string = 'browse',
  correlationId: string,
  _context?: RegistryToolContext | null
) {
  const stopTimer = startTimerSeconds(METRICS.registryDiscoveryLatencySeconds);
  incrementCounter(METRICS.registryDiscoveryRequestsTotal);

  if (!isEnabled('oss_registry_discovery')) {
    logStructured('warn', 'registry_discovery_disabled', {
      correlation_id: correlationId,
      owner: FLAG_OWNERS.oss_registry_discovery,
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry discovery is currently disabled.',
      }],
      isError: true,
    };
  }

  // Parse the query
  const parsed = parseShopQuery(query);

  // Resolve via registry
  let resolution: BrandResolution | GTINResolution;
  try {
    if (parsed.type === 'gtin') {
      resolution = await registryClient.resolveGTIN(parsed.gtin!);
    } else {
      resolution = await registryClient.resolveBrand(parsed.brand!);
    }
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    logStructured('error', 'registry_discovery_error', {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry lookup failed.',
      }],
      isError: true,
    };
  }

  if (!resolution.found) {
    // Narrow for suggestions (only on BrandResolution)
    const suggestions = isBrandResolution(resolution) ? resolution.suggestions ?? [] : [];
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `I couldn't find a commerce gateway for "${query}". ${
          suggestions.length
            ? `Did you mean: ${suggestions.map((s: { brand: string }) => s.brand).join(', ')}?`
            : 'This brand may not have their catalog available yet.'
        }`,
      }],
    };
  }

  // Get gateway info - narrow union before accessing
  const gatewayFromBrand = isBrandResolution(resolution) ? resolution.gateway : undefined;
  const gatewayFromGTIN = isGTINResolution(resolution) ? resolution.authoritative_source?.gateway : undefined;
  const gatewayInfo = gatewayFromBrand || gatewayFromGTIN;
  
  if (!gatewayInfo) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Gateway information not available.',
      }],
      isError: true,
    };
  }

  // Call the resolved gateway
  const gateway = createGatewayClient(gatewayInfo);
  const brandFromBrand = isBrandResolution(resolution) ? resolution.brand : undefined;
  const brandFromGTIN = isGTINResolution(resolution) ? resolution.authoritative_source?.brand : undefined;
  const brandName: string = brandFromBrand || brandFromGTIN || parsed.brand || 'Unknown Brand';

  try {
    if (isEnabled('oss_registry_metadata')) {
      const validation = validateGatewayMetadata(gatewayInfo);
      incrementCounter(METRICS.registryMetadataValidationsTotal);
      if (!validation.valid) {
        incrementCounter(METRICS.registryMetadataValidationErrorsTotal);
        logStructured('warn', 'registry_metadata_validation_failed', {
          correlation_id: correlationId,
          errors: validation.errors,
        });
      }
    }

    let result: unknown;
    if (parsed.type === 'gtin') {
      result = await gateway.getProductByGTIN(parsed.gtin!);
      const product = result as { name?: string; title?: string };
      stopTimer();
      return {
        content: [{
          type: 'text',
          text: `Found product "${product.name || product.title || 'Product'}" (GTIN: ${parsed.gtin}) from ${brandName}.\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    } else if (parsed.productQuery) {
      result = await gateway.search(parsed.productQuery);
      stopTimer();
      return {
        content: [{
          type: 'text',
          text: formatProductResults(brandName, result),
        }],
      };
    } else {
      result = await gateway.browse();
      stopTimer();
      return {
        content: [{
          type: 'text',
          text: formatProductResults(brandName, result),
        }],
      };
    }
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `Error calling gateway: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

async function handlePriceCheck(
  args: {
  brand: string;
  product?: string;
  gtin?: string;
  },
  correlationId: string,
  _context?: RegistryToolContext | null
) {
  const stopTimer = startTimerSeconds(METRICS.registryDiscoveryLatencySeconds);
  incrementCounter(METRICS.registryDiscoveryRequestsTotal);

  if (!isEnabled('oss_registry_discovery')) {
    logStructured('warn', 'registry_discovery_disabled', {
      correlation_id: correlationId,
      owner: FLAG_OWNERS.oss_registry_discovery,
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry discovery is currently disabled.',
      }],
      isError: true,
    };
  }

  // Resolve brand (returns BrandResolution)
  let resolution: BrandResolution;
  try {
    resolution = await registryClient.resolveBrand(args.brand);
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    logStructured('error', 'registry_discovery_error', {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry lookup failed.',
      }],
      isError: true,
    };
  }
  if (!resolution.found || !resolution.gateway) {
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `Could not find gateway for brand: ${args.brand}`,
      }],
      isError: true,
    };
  }

  const gateway = createGatewayClient(resolution.gateway);

  try {
    if (isEnabled('oss_registry_metadata')) {
      const validation = validateGatewayMetadata(resolution.gateway);
      incrementCounter(METRICS.registryMetadataValidationsTotal);
      if (!validation.valid) {
        incrementCounter(METRICS.registryMetadataValidationErrorsTotal);
        logStructured('warn', 'registry_metadata_validation_failed', {
          correlation_id: correlationId,
          errors: validation.errors,
        });
      }
    }

    // If GTIN provided, get product by GTIN first
    if (args.gtin) {
      const product = (await gateway.getProductByGTIN(args.gtin)) as { id?: string };
      const productId = product.id || args.gtin;
      const pricing = await gateway.getPricing([productId]);
      stopTimer();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(pricing, null, 2),
        }],
      };
    } else if (args.product) {
      // Search for product, then get pricing
      type SearchResult = {
        products?: Array<{ id: string }>;
        total?: number;
      };
      const searchResult = (await gateway.search(args.product)) as SearchResult;
      if (searchResult.products && searchResult.products.length > 0) {
        const productIds = searchResult.products.slice(0, 5).map((p) => p.id);
        const pricing = await gateway.getPricing(productIds);
        stopTimer();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(pricing, null, 2),
          }],
        };
      }
    }

    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Please provide either a product name or GTIN to check pricing.',
      }],
      isError: true,
    };
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `Error checking price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

async function handleAvailability(
  args: {
  brand: string;
  product: string;
  location?: string;
  },
  correlationId: string,
  _context?: RegistryToolContext | null
) {
  const stopTimer = startTimerSeconds(METRICS.registryDiscoveryLatencySeconds);
  incrementCounter(METRICS.registryDiscoveryRequestsTotal);

  if (!isEnabled('oss_registry_discovery')) {
    logStructured('warn', 'registry_discovery_disabled', {
      correlation_id: correlationId,
      owner: FLAG_OWNERS.oss_registry_discovery,
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry discovery is currently disabled.',
      }],
      isError: true,
    };
  }

  // Resolve brand (returns BrandResolution)
  let resolution: BrandResolution;
  try {
    resolution = await registryClient.resolveBrand(args.brand);
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    logStructured('error', 'registry_discovery_error', {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: 'Registry lookup failed.',
      }],
      isError: true,
    };
  }
  if (!resolution.found || !resolution.gateway) {
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `Could not find gateway for brand: ${args.brand}`,
      }],
      isError: true,
    };
  }

  const gateway = createGatewayClient(resolution.gateway);

  try {
    if (isEnabled('oss_registry_metadata')) {
      const validation = validateGatewayMetadata(resolution.gateway);
      incrementCounter(METRICS.registryMetadataValidationsTotal);
      if (!validation.valid) {
        incrementCounter(METRICS.registryMetadataValidationErrorsTotal);
        logStructured('warn', 'registry_metadata_validation_failed', {
          correlation_id: correlationId,
          errors: validation.errors,
        });
      }
    }

    // Search for product
    type SearchResult = {
      products?: Array<{ id: string }>;
      total?: number;
    };
    const searchResult = (await gateway.search(args.product)) as SearchResult;
    if (!searchResult.products || searchResult.products.length === 0) {
      stopTimer();
      return {
        content: [{
          type: 'text',
          text: `Product "${args.product}" not found in ${args.brand}'s catalog.`,
        }],
        isError: true,
      };
    }

    const productIds = searchResult.products.slice(0, 5).map((p) => p.id);
    const availability = await gateway.getAvailability(productIds, args.location);

    stopTimer();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(availability, null, 2),
      }],
    };
  } catch (error) {
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    stopTimer();
    return {
      content: [{
        type: 'text',
        text: `Error checking availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}

// ============================================================================
// Create MCP Server
// ============================================================================

const server = new Server(
  { name: 'commerce-registry', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

const TOOL_MAP = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

// ============================================================================
// Initialize (Tenant Context)
// ============================================================================

server.setRequestHandler(InitializeRequestSchema, async (request) => {
  const params = request.params as MCPInitializeParams | undefined;
  const resolved = await resolveTenantContext(params?.tenantContext);

  if (!resolved?.organizationId) {
    throw new Error('Tenant context required: provide apiKey, organizationId, or sessionToken');
  }

  sessionContext = {
    store: memoryStore,
    auth: {
      userId: resolved.userId ?? 'self-hosted-user',
      organizationId: resolved.organizationId,
      isSuperAdmin: resolved.isSuperAdmin ?? false,
      permissions: { canRead: true, canWrite: true, canAdmin: false },
    },
  };

  requireTenantContext({ organizationId: resolved.organizationId });

  return {
    protocolVersion: params?.protocolVersion ?? '2024-11-05',
    capabilities: { tools: {}, resources: {} },
    serverInfo: { name: 'commerce-registry', version: '1.0.0' },
  };
});

// ============================================================================
// Tool: @shop resolution
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'shop',
      description: `Resolve @shop queries to find and interact with brand commerce gateways.
      
Triggers:
- "@shop Nike" → Browse Nike's catalog
- "@shop Lumebonde lipstick" → Search for lipstick in Lumebonde
- "@shop 012345678901" → Look up product by UPC/GTIN

Use this tool whenever you see @shop in the user's message.`,
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The @shop query (brand name, brand + product, or GTIN)',
          },
          intent: {
            type: 'string',
            enum: ['browse', 'search', 'lookup', 'price', 'availability'],
            default: 'browse',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'price_check',
      description: 'Check current pricing for a product from a specific brand',
      inputSchema: {
        type: 'object',
        properties: {
          brand: { type: 'string' },
          product: { type: 'string' },
          gtin: { type: 'string' },
        },
        required: ['brand'],
      },
    },
    {
      name: 'check_availability',
      description: 'Check if a product is in stock',
      inputSchema: {
        type: 'object',
        properties: {
          brand: { type: 'string' },
          product: { type: 'string' },
          location: { type: 'string' },
        },
        required: ['brand', 'product'],
      },
    },
    ...ALL_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  ],
}));

// ============================================================================
// Tool Handler
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = args ?? {};
  const correlationId = createCorrelationId();
  const trace = startTrace(`registry_mcp_${name}`, correlationId);
  let traceStatus = 'ok';
  const context = sessionContext;

  logStructured('info', 'registry_mcp_request', {
    correlation_id: correlationId,
    tool: name,
  });

  try {
    if (!context?.auth?.organizationId) {
      throw new Error('No tenant context. Call initialize with tenantContext first.');
    }

    if (TOOL_MAP.has(name)) {
      const tool = TOOL_MAP.get(name);
      const result = await tool?.execute(safeArgs, context);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    switch (name) {
      case 'shop':
        return await handleShopQuery(safeArgs.query as string, safeArgs.intent as string, correlationId, context);
      case 'price_check':
        return await handlePriceCheck(
          safeArgs as { brand: string; product?: string; gtin?: string },
          correlationId,
          context
        );
      case 'check_availability':
        return await handleAvailability(
          safeArgs as { brand: string; product: string; location?: string },
          correlationId,
          context
        );
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    traceStatus = 'error';
    incrementCounter(METRICS.registryDiscoveryErrorsTotal);
    logStructured('error', 'registry_mcp_request_failed', {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    throw error;
  } finally {
    trace.end(traceStatus);
    logStructured('info', 'registry_mcp_response', {
      correlation_id: correlationId,
      tool: name,
    });
  }
});

// ============================================================================
// Error Handler
// ============================================================================

server.onerror = (error) => {
  console.error('[Registry MCP Server Error]', error);
};

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Registry MCP Server] Commerce Registry MCP Server started');
  console.error(`[Registry MCP Server] Registry URL: ${REGISTRY_URL}`);
}

main().catch((error) => {
  console.error('[Registry MCP Server] Failed to start:', error);
  process.exit(1);
});

export { server };
export type {
  RegistryStore,
  RegistryAdminStore,
  Gateway,
  GatewayFilters,
  CreateGatewayInput,
  UpdateGatewayInput,
  DiscoveryQuery,
  DiscoveryResult,
  ShopResolution,
  UsagePeriod,
  UsageStats,
  AuditEntry,
  AuditFilters,
  TenantInfo,
  TenantFilters,
  AdminSearchResult,
} from './store/index.js';
export type { RegistryAuthProvider, RegistryAuthContext, RegistryPermissions } from './auth/index.js';

