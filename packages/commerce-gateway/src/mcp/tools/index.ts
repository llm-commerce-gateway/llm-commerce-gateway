/**
 * @betterdata/commerce-gateway - MCP Tool Handlers
 * 
 * Implements all commerce tools for the MCP server.
 * Each tool handler calls backend interfaces and formats responses for Claude.
 * 
 * @license Apache-2.0
 */

import { z } from 'zod';
import type { 
  MCPToolDefinition, 
  MCPToolResult, 
  MCPToolContext,
  MCPJSONSchema,
} from '../types';
import {
  filterToolsByCapabilities,
  getRequiredCapabilitiesForTool,
} from '../../capabilities';
import {
  formatProduct,
  formatProductList,
  formatCart,
  formatCartUpdate,
  formatInventoryStatus,
  formatRecommendations,
  formatOrder,
  formatError,
  formatNotFound,
} from '../formatters';
import { createRegistryClient } from '../../registry/client';
import { parseShopQuery } from '../../registry/shop-parser';

// ============================================================================
// Tool Schema Definitions
// ============================================================================

export const SearchProductsSchema = z.object({
  query: z.string().describe('Natural language search query for products'),
  filters: z.object({
    category: z.string().optional().describe('Filter by category'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    priceMin: z.number().optional().describe('Minimum price'),
    priceMax: z.number().optional().describe('Maximum price'),
    inStock: z.boolean().optional().describe('Only show in-stock items'),
  }).optional().describe('Optional search filters'),
  limit: z.number().min(1).max(20).optional().default(10).describe('Number of results'),
  offset: z.number().min(0).optional().default(0).describe('Pagination offset'),
});

export const GetProductDetailsSchema = z.object({
  productId: z.string().describe('Product ID to get details for'),
});

export const AddToCartSchema = z.object({
  productId: z.string().describe('Product ID to add'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().int().min(1).max(99).optional().default(1).describe('Quantity to add'),
});

export const CheckInventorySchema = z.object({
  productId: z.string().describe('Product ID to check'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  locationId: z.string().optional().describe('Specific location to check'),
});

export const CheckAvailabilitySchema = z.object({
  productId: z.string().describe('Product ID to check'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().int().min(1).max(99).optional().default(1).describe('Desired quantity'),
});

export const GetRecommendationsSchema = z.object({
  productIds: z.array(z.string()).optional().describe('Products to base recommendations on'),
  strategy: z.enum(['similar', 'complementary', 'trending', 'personalized', 'bundle'])
    .optional()
    .default('personalized')
    .describe('Recommendation strategy'),
  limit: z.number().min(1).max(10).optional().default(5).describe('Number of recommendations'),
});

export const CreateOrderSchema = z.object({
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).describe('Shipping address'),
  billingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).optional().describe('Billing address (uses shipping if not provided)'),
  paymentMethod: z.enum(['credit_card', 'paypal', 'apple_pay', 'google_pay', 'affirm', 'klarna'])
    .optional()
    .default('credit_card')
    .describe('Payment method'),
});

export const ShopSchema = z.object({
  query: z.string().describe(
    'The @shop query (brand name, brand + product, or GTIN). ' +
    'Examples: "@shop Nike", "@shop Lumebonde lipstick", "@shop 012345678901". ' +
    'Use this tool whenever you see @shop in the user\'s message.'
  ),
  intent: z.enum(['browse', 'search', 'lookup', 'price', 'availability'])
    .optional()
    .default('browse')
    .describe('Intent of the query'),
});

// ============================================================================
// Proposed SCM Tool Schemas (placeholders until adapters exist)
// ============================================================================

export const GetShipmentStatusSchema = z.object({
  shipmentId: z.string().describe('Shipment ID to look up'),
  orderId: z.string().optional().describe('Optional order ID for context'),
});

export const GetPurchaseOrderStatusSchema = z.object({
  purchaseOrderId: z.string().describe('Purchase order ID to look up'),
});

export const GetTraceEventsSchema = z.object({
  traceId: z.string().describe('Trace or batch ID to look up'),
});

export const GetDemandForecastSchema = z.object({
  sku: z.string().describe('SKU or product ID to forecast'),
  horizonDays: z.number().min(1).max(365).optional().default(30).describe('Forecast horizon in days'),
});

// ============================================================================
// Convert Zod to JSON Schema (for MCP)
// ============================================================================

function zodToJsonSchema(schema: z.ZodTypeAny): MCPJSONSchema {
  // Simple conversion - a full implementation would use zod-to-json-schema
  const def = schema._def;
  
  if (def.typeName === 'ZodObject') {
    const shape = def.shape();
    const properties: Record<string, MCPJSONSchema> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      // Check if field is required (not optional and no default)
      const fieldDef = (value as z.ZodTypeAny)._def;
      if (fieldDef.typeName !== 'ZodOptional' && fieldDef.typeName !== 'ZodDefault') {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      description: def.description,
    };
  }
  
  if (def.typeName === 'ZodString') {
    return { type: 'string', description: def.description };
  }
  
  if (def.typeName === 'ZodNumber') {
    return { 
      type: 'number', 
      description: def.description,
      minimum: def.checks?.find((c: { kind: string }) => c.kind === 'min')?.value,
      maximum: def.checks?.find((c: { kind: string }) => c.kind === 'max')?.value,
    };
  }
  
  if (def.typeName === 'ZodBoolean') {
    return { type: 'boolean', description: def.description };
  }
  
  if (def.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(def.type),
      description: def.description,
    };
  }
  
  if (def.typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: def.values,
      description: def.description,
    };
  }
  
  if (def.typeName === 'ZodOptional') {
    return zodToJsonSchema(def.innerType);
  }
  
  if (def.typeName === 'ZodDefault') {
    const inner = zodToJsonSchema(def.innerType);
    inner.default = def.defaultValue();
    return inner;
  }
  
  // Fallback
  return { type: 'object' };
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function searchProductsHandler(
  input: z.infer<typeof SearchProductsSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    const result = await context.backends.products.searchProducts(
      input.query,
      input.filters,
      { limit: input.limit, offset: input.offset }
    );
    
    return {
      content: formatProductList(result.products, {
        title: `Results for "${input.query}"`,
        showCount: true,
        total: result.total,
        hasMore: result.hasMore,
      }),
    };
  } catch (error) {
    return {
      content: formatError(
        'Failed to search products. Please try again.',
        ['Check your search query', 'Try simpler terms']
      ),
      isError: true,
    };
  }
}

async function getProductDetailsHandler(
  input: z.infer<typeof GetProductDetailsSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    const product = await context.backends.products.getProductDetails(input.productId);
    
    if (!product) {
      return {
        content: formatNotFound('product', input.productId),
        isError: true,
      };
    }
    
    // Generate link if LinkGenerator is available
    let linkUrl: string | undefined;
    if (context.backends.links) {
      try {
        const link = await context.backends.links.createProductLink(product, {
          sessionId: context.sessionId,
          source: 'claude-mcp',
        });
        linkUrl = link.shortUrl;
      } catch {
        // Link generation is optional, continue without it
      }
    }
    
    return {
      content: formatProduct(product, { includeDetails: true, linkUrl }),
    };
  } catch (error) {
    return {
      content: formatError('Failed to fetch product details.'),
      isError: true,
    };
  }
}

async function addToCartHandler(
  input: z.infer<typeof AddToCartSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    // Get or create cart
    let cart = context.cart;
    if (!cart) {
      cart = await context.backends.cart.getOrCreateCart(context.sessionId);
    }
    
    // Add item to cart
    const updatedCart = await context.backends.cart.addToCart(
      cart.id,
      {
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity ?? 1,
      }
    );
    
    // Update context cart
    context.cart = updatedCart;
    
    // Find the added item
    const addedItem = updatedCart.items.find(
      i => i.productId === input.productId && 
           (input.variantId ? i.variantId === input.variantId : true)
    );
    
    if (addedItem) {
      // Generate checkout link if available
      let checkoutUrl: string | undefined;
      if (context.backends.links) {
        try {
          const link = await context.backends.links.createCartLink(updatedCart, 24);
          checkoutUrl = link.shortUrl;
        } catch {
          // Optional
        }
      }
      
      return {
        content: [
          ...formatCartUpdate('added', addedItem, updatedCart),
          ...formatCart(updatedCart, { checkoutUrl }),
        ],
      };
    }
    
    return {
      content: formatCart(updatedCart),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add item to cart';
    return {
      content: formatError(message, [
        'Check if the product is in stock',
        'Verify the product ID is correct',
      ]),
      isError: true,
    };
  }
}

async function checkInventoryHandler(
  input: z.infer<typeof CheckInventorySchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    const inventory = await context.backends.products.checkInventory(
      [input.productId],
      input.locationId ? { locationId: input.locationId } : undefined
    );
    
    if (inventory.length === 0 || !inventory[0]) {
      return {
        content: formatNotFound('product', input.productId),
        isError: true,
      };
    }
    
    // Get product name for better display
    let productName: string | undefined;
    try {
      const product = await context.backends.products.getProductDetails(input.productId);
      productName = product?.name;
    } catch {
      // Optional
    }
    
    // TypeScript now knows inventory[0] is defined due to the check above
    return {
      content: formatInventoryStatus(inventory[0]!, productName),
    };
  } catch (error) {
    return {
      content: formatError('Failed to check inventory.'),
      isError: true,
    };
  }
}

async function checkAvailabilityHandler(
  input: z.infer<typeof CheckAvailabilitySchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    const inventory = await context.backends.products.checkInventory(
      [input.productId]
    );

    if (inventory.length === 0 || !inventory[0]) {
      return {
        content: formatNotFound('product', input.productId),
        isError: true,
      };
    }

    const status = inventory[0]!;
    const quantity = input.quantity ?? 1;
    const available = status.inStock && status.quantity >= quantity;
    const message = available
      ? 'In stock and available to ship.'
      : 'Currently unavailable. Check back soon.';

    const details = status.shippingEstimate
      ? ` Estimated delivery: ${status.shippingEstimate}.`
      : '';

    return {
      content: [
        {
          type: 'text',
          text: `${message}${details}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: formatError('Failed to check availability.'),
      isError: true,
    };
  }
}

async function getRecommendationsHandler(
  input: z.infer<typeof GetRecommendationsSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    const getRecommendations = context.backends.products.getRecommendations;
    if (!getRecommendations) {
      return {
        content: formatError('Recommendations are not available.'),
        isError: true,
      };
    }
    
    const recommendations = await getRecommendations.call(
      context.backends.products,
      {
        productIds: input.productIds,
        sessionId: context.sessionId,
        strategy: input.strategy,
      },
      input.limit
    );
    
    return {
      content: formatRecommendations(recommendations, { strategy: input.strategy }),
    };
  } catch (error) {
    return {
      content: formatError('Failed to get recommendations.'),
      isError: true,
    };
  }
}

async function createOrderHandler(
  input: z.infer<typeof CreateOrderSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    // Need a cart to create an order
    const cart = context.cart ?? await context.backends.cart.getOrCreateCart(context.sessionId);
    
    if (cart.items.length === 0) {
      return {
        content: formatError(
          'Your cart is empty. Add some items before checking out.',
          ['Search for products to add', 'Browse recommendations']
        ),
        isError: true,
      };
    }
    
    const order = await context.backends.orders.createOrder(
      cart,
      input.shippingAddress,
      input.billingAddress,
      { method: input.paymentMethod ?? 'credit_card' }
    );
    
    // Clear the cart after order
    try {
      await context.backends.cart.clearCart(cart.id);
      context.cart = undefined;
    } catch {
      // Cart clearing is optional
    }
    
    return {
      content: formatOrder(order),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return {
      content: formatError(message, [
        'Verify your shipping address',
        'Check that all cart items are still in stock',
      ]),
      isError: true,
    };
  }
}

async function shopHandler(
  input: z.infer<typeof ShopSchema>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  try {
    // Get registry client from context or create default
    const registryClient = context.registryClient ?? createRegistryClient();
    
    // Parse the query
    const parsed = parseShopQuery(input.query);
    
    // Resolve via registry
    let resolution;
    if (parsed.type === 'gtin') {
      resolution = await registryClient.resolveGTIN(parsed.gtin!);
    } else {
      // Try registry first
      resolution = await registryClient.resolveBrand(parsed.brand!);
      
      // If not found, try .well-known discovery
      if (!resolution.found) {
        const wellKnownResult = await registryClient.tryWellKnownDiscovery(parsed.brand!);
        if (wellKnownResult) {
          resolution = wellKnownResult;
        }
      }
    }
    
    if (!resolution.found) {
      const suggestions = resolution.suggestions?.length 
        ? ` Did you mean: ${resolution.suggestions.map((s: { brand: string }) => s.brand).join(', ')}?`
        : ' This brand may not have their catalog available yet.';
      
      return {
        content: formatError(
          `I couldn't find a commerce gateway for "${input.query}".${suggestions}`,
          ['Try a different brand name', 'Check the spelling']
        ),
        isError: true,
      };
    }
    
    // If we have a gateway, we would call it here
    // For now, return the resolution information
    // In a full implementation, we'd create a gateway client and call the appropriate endpoint
    
    const gatewayInfo = resolution.gateway || resolution.authoritative_source?.gateway;
    if (!gatewayInfo) {
      return {
        content: formatError('Gateway information not available.'),
        isError: true,
      };
    }
    
    // Format the response
    const brandName = resolution.brand || resolution.authoritative_source?.brand || parsed.brand;
    const message = parsed.type === 'gtin'
      ? `Found product "${resolution.product_name}" (GTIN: ${resolution.gtin}) from ${brandName}.`
      : parsed.productQuery
      ? `Found ${brandName}'s gateway. Searching for "${parsed.productQuery}"...`
      : `Found ${brandName}'s commerce gateway.`;
    
    return {
      content: [
        {
          type: 'text',
          text: `${message}\n\nGateway: ${gatewayInfo.endpoint}\nProtocol: ${gatewayInfo.protocol}\nTrust Score: ${resolution.trust_score ?? 'N/A'}`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve @shop query';
    return {
      content: formatError(message, [
        'Check your internet connection',
        'Try again in a moment',
      ]),
      isError: true,
    };
  }
}

async function scmNotImplementedHandler(
  _input: unknown,
  _context: MCPToolContext
): Promise<MCPToolResult> {
  return {
    content: formatError(
      'This SCM tool is not implemented for this gateway.',
      ['Requires an approved SCM adapter', 'Check capability configuration']
    ),
    isError: true,
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export interface MCPToolHandler {
  schema: z.ZodTypeAny;
  handler: (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>;
  requiredCapabilities?: string[];
}

export const MCP_TOOLS: Record<string, MCPToolHandler> = {
  search_products: {
    schema: SearchProductsSchema,
    handler: searchProductsHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('search_products'),
  },
  get_product_details: {
    schema: GetProductDetailsSchema,
    handler: getProductDetailsHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_product_details'),
  },
  add_to_cart: {
    schema: AddToCartSchema,
    handler: addToCartHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('add_to_cart'),
  },
  check_availability: {
    schema: CheckAvailabilitySchema,
    handler: checkAvailabilityHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('check_availability'),
  },
  check_inventory: {
    schema: CheckInventorySchema,
    handler: checkInventoryHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('check_inventory'),
  },
  get_recommendations: {
    schema: GetRecommendationsSchema,
    handler: getRecommendationsHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_recommendations'),
  },
  create_order: {
    schema: CreateOrderSchema,
    handler: createOrderHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('create_order'),
  },
  shop: {
    schema: ShopSchema,
    handler: shopHandler as (input: unknown, context: MCPToolContext) => Promise<MCPToolResult>,
    requiredCapabilities: getRequiredCapabilitiesForTool('shop'),
  },
  get_shipment_status: {
    schema: GetShipmentStatusSchema,
    handler: scmNotImplementedHandler,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_shipment_status'),
  },
  get_purchase_order_status: {
    schema: GetPurchaseOrderStatusSchema,
    handler: scmNotImplementedHandler,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_purchase_order_status'),
  },
  get_trace_events: {
    schema: GetTraceEventsSchema,
    handler: scmNotImplementedHandler,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_trace_events'),
  },
  get_demand_forecast: {
    schema: GetDemandForecastSchema,
    handler: scmNotImplementedHandler,
    requiredCapabilities: getRequiredCapabilitiesForTool('get_demand_forecast'),
  },
};

/**
 * Get MCP tool definitions for enabled tools
 */
export function getMCPToolDefinitions(
  enabledTools: string[],
  capabilitySet?: import('../../capabilities').CapabilitySet
): MCPToolDefinition[] {
  const filteredTools = filterToolsByCapabilities(enabledTools, capabilitySet);
  return filteredTools
    .filter(name => MCP_TOOLS[name])
    .map(name => {
      const tool = MCP_TOOLS[name];
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }
      return {
        name,
        description: getToolDescription(name),
        inputSchema: zodToJsonSchema(tool.schema),
        requiredCapabilities: tool.requiredCapabilities,
      };
    });
}

function getToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    shop: `Resolve @shop queries to find and interact with brand commerce gateways.

Triggers:
- "@shop Nike" → Browse Nike's catalog
- "@shop Lumebonde lipstick" → Search for lipstick in Lumebonde
- "@shop 012345678901" → Look up product by UPC/GTIN

Use this tool whenever you see @shop in the user's message.`,
    search_products: `Search for products using natural language queries.
Supports filtering by category, price range, tags, and availability.
Returns product details including pricing, images, and stock status.
Use this when customers ask about finding products or browsing the catalog.`,

    get_product_details: `Get detailed information about a specific product.
Returns full product details including variants, pricing, images, and availability.
Use this when a customer wants to learn more about a specific product.`,

    add_to_cart: `Add a product to the shopping cart.
Supports specifying quantity and variant selection.
Returns updated cart totals and contents.
Use this when customers want to buy or save a product.`,

    check_availability: `Check buyer-safe availability for a product.
Returns a simple in-stock signal with a confidence hint and optional delivery estimate.
Use this when customers ask if an item is available without exposing location details.`,

    check_inventory: `Check real-time inventory availability for a product.
Returns quantity available and location-specific stock levels.
Use this for SCM visibility use cases (not buyer-facing).`,

    get_recommendations: `Get personalized product recommendations.
Supports multiple strategies: similar, complementary, trending, bundle, and personalized.
Use this when customers need suggestions or want to discover products.`,

    create_order: `Create an order from the current cart.
Requires shipping address and payment method.
Returns order confirmation with number and estimated delivery.
Use this when customers are ready to complete their purchase.`,
    get_shipment_status: `Check shipment status for a purchase order or shipment.
Returns carrier status and delivery estimates when supported by adapters.`,
    get_purchase_order_status: `Check purchase order status for SCM workflows.
Returns fulfillment progress and expected delivery dates.`,
    get_trace_events: `Fetch traceability events for a batch or lot.
Returns chain-of-custody events when supported by adapters.`,
    get_demand_forecast: `Get demand forecast for a SKU or product.
Returns forecasted demand over the requested horizon.`,
  };
  
  return descriptions[name] ?? `Execute the ${name} tool.`;
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: MCPToolContext
): Promise<MCPToolResult> {
  const tool = MCP_TOOLS[name];
  
  if (!tool) {
    return {
      content: formatError(`Unknown tool: ${name}`),
      isError: true,
    };
  }
  
  try {
    // Validate input
    const validatedInput = tool.schema.parse(input);
    
    // Execute handler
    return await tool.handler(validatedInput, context);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return {
        content: formatError(
          'Invalid input parameters.',
          issues.slice(0, 3)
        ),
        isError: true,
      };
    }
    
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return {
      content: formatError(message),
      isError: true,
    };
  }
}

