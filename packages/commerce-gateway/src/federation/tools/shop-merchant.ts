/**
 * @betterdata/commerce-gateway - Shop Merchant Tool
 *
 * Federation tool for shopping at a specific merchant's catalog.
 * Routes LLM requests to the appropriate merchant gateway.
 *
 * @example
 * ```typescript
 * // User says: "shop vuori for joggers under $100"
 * // LLM calls: shop_merchant({ merchant: "vuori", query: "joggers", filters: { priceMax: 100 } })
 *
 * const tool = new ShopMerchantTool(registry, client, parser);
 * const result = await tool.execute({
 *   merchant: 'vuori',
 *   query: 'joggers',
 *   filters: { priceMax: 100 },
 * });
 *
 * // Returns products from Vuori's catalog with attribution
 * ```
 *
 * @license Apache-2.0
 */

import { z } from 'zod';
import type { MerchantRegistry } from '../registry/interface';
import type { GatewayClient, SearchResult } from '../client/gateway-client';
import type { IntentParser } from '../router/intent-parser';
import type { FederatedResult, MerchantRegistration } from '../types';

// ============================================================================
// Tool Schema
// ============================================================================

/**
 * Zod schema for shop_merchant tool arguments.
 */
export const ShopMerchantArgsSchema = z.object({
  /** Domain, brand name, or URL to shop at */
  merchant: z
    .string()
    .min(1)
    .describe(
      "Domain, brand name, or URL (e.g., 'vuoriclothing.com', 'Macy's', 'nike.com')"
    ),

  /** Product search query */
  query: z
    .string()
    .min(1)
    .describe('What to search for at this merchant'),

  /** Optional search filters */
  filters: z
    .object({
      category: z.string().optional().describe('Product category'),
      priceMin: z.number().optional().describe('Minimum price'),
      priceMax: z.number().optional().describe('Maximum price'),
      inStock: z.boolean().optional().describe('Only show in-stock items'),
      limit: z.number().min(1).max(50).optional().default(10).describe('Max results'),
    })
    .optional(),
});

/**
 * Type for shop_merchant arguments.
 */
export type ShopMerchantArgs = z.infer<typeof ShopMerchantArgsSchema>;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Universal tool definition for shop_merchant.
 *
 * Compatible with MCP (Anthropic), OpenAI Functions, and other LLM formats.
 */
export const SHOP_MERCHANT_TOOL_DEFINITION = {
  name: 'shop_merchant',
  description: `Shop a specific website or brand. Use when user mentions a store name, brand, or URL like 'macys.com', 'Nike', or 'shop Vuori for...'. Routes to that merchant's product catalog.

Examples of when to use:
- "shop vuori for joggers"
- "find dresses on macys.com"
- "search Nike for running shoes"
- "what does Nordstrom have in activewear"

Returns products from the specified merchant with pricing and availability.`,
  parameters: {
    type: 'object' as const,
    properties: {
      merchant: {
        type: 'string',
        description:
          "Domain, brand name, or URL (e.g., 'vuoriclothing.com', 'Macy\\'s', 'nike.com')",
      },
      query: {
        type: 'string',
        description: 'What to search for at this merchant',
      },
      filters: {
        type: 'object',
        description: 'Optional search filters',
        properties: {
          category: { type: 'string', description: 'Product category' },
          priceMin: { type: 'number', description: 'Minimum price' },
          priceMax: { type: 'number', description: 'Maximum price' },
          inStock: { type: 'boolean', description: 'Only show in-stock items' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
    required: ['merchant', 'query'],
  },
};

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Handler for the shop_merchant tool.
 *
 * Resolves merchant references (domain, brand name, URL) to a registered
 * merchant and executes product search on their gateway.
 *
 * @example
 * ```typescript
 * const tool = new ShopMerchantTool(registry, client, parser);
 *
 * // Direct execution
 * const result = await tool.execute({
 *   merchant: 'nike.com',
 *   query: 'running shoes',
 *   filters: { priceMax: 150 },
 * });
 *
 * // Check result
 * if (result.status === 'ok') {
 *   console.log(`Found ${result.data.products.length} products from ${result.attribution?.merchant.name}`);
 * } else if (result.status === 'merchant_not_connected') {
 *   console.log('Merchant not found, alternatives:', result.alternatives);
 * }
 * ```
 */
export class ShopMerchantTool {
  private registry: MerchantRegistry;
  private client: GatewayClient;
  private parser: IntentParser;

  /**
   * Create a new ShopMerchantTool.
   *
   * @param registry - Merchant registry for resolution
   * @param client - Gateway client for executing searches
   * @param parser - Intent parser for fuzzy matching and suggestions
   */
  constructor(
    registry: MerchantRegistry,
    client: GatewayClient,
    parser: IntentParser
  ) {
    this.registry = registry;
    this.client = client;
    this.parser = parser;
  }

  /**
   * Execute the shop_merchant tool.
   *
   * @param args - Tool arguments
   * @returns Federated result with search data or alternatives
   */
  async execute(args: ShopMerchantArgs): Promise<FederatedResult<SearchResult>> {
    // Validate arguments
    const validated = ShopMerchantArgsSchema.parse(args);

    // Resolve merchant
    const merchant = await this.resolveMerchant(validated.merchant);

    if (!merchant) {
      // Merchant not found - provide alternatives
      const alternatives = await this.parser.suggestMerchants(
        validated.query,
        5
      );

      return {
        status: 'merchant_not_connected',
        message: `I don't have access to "${validated.merchant}" yet. ${
          alternatives.length > 0
            ? 'Here are some connected stores that might have what you\'re looking for:'
            : 'No similar connected stores found.'
        }`,
        alternatives,
      };
    }

    // Check capabilities
    if (!merchant.capabilities.search) {
      return {
        status: 'capability_not_supported',
        message: `${merchant.metadata.name} doesn't support product search through this channel.`,
        attribution: {
          merchant: {
            domain: merchant.domain,
            name: merchant.metadata.name,
            tier: merchant.tier,
          },
        },
      };
    }

    // Execute search
    const result = await this.client.executeSearch(merchant, validated.query, {
      filters: validated.filters
        ? {
            category: validated.filters.category,
            priceMin: validated.filters.priceMin,
            priceMax: validated.filters.priceMax,
            inStock: validated.filters.inStock,
          }
        : undefined,
      limit: validated.filters?.limit ?? 10,
    });

    return result;
  }

  /**
   * Resolve a merchant reference to a registration.
   *
   * Tries in order:
   * 1. Exact domain match
   * 2. Alias lookup
   * 3. URL parsing (extract domain)
   * 4. Fuzzy matching via intent parser
   */
  private async resolveMerchant(
    merchantRef: string
  ): Promise<MerchantRegistration | null> {
    const normalized = merchantRef.toLowerCase().trim();

    // 1. Try exact domain match
    const byDomain = await this.registry.get(normalized);
    if (byDomain) {
      return byDomain;
    }

    // 2. Try alias lookup
    const byAlias = await this.registry.findByAlias(normalized);
    if (byAlias) {
      return byAlias;
    }

    // 3. Try parsing as URL
    if (merchantRef.includes('://') || merchantRef.includes('www.')) {
      const urlMatch = merchantRef.match(
        /(?:https?:\/\/)?(?:www\.)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)/i
      );
      if (urlMatch && urlMatch[1]) {
        const domain = urlMatch[1].toLowerCase();
        const byUrlDomain = await this.registry.get(domain);
        if (byUrlDomain) {
          return byUrlDomain;
        }
      }
    }

    // 4. Try fuzzy matching via parser
    const parsed = await this.parser.parse(`shop ${merchantRef} for products`);
    if (parsed?.merchant.domain) {
      const byFuzzy = await this.registry.get(parsed.merchant.domain);
      if (byFuzzy) {
        return byFuzzy;
      }
    }

    return null;
  }

  /**
   * Get the tool definition.
   */
  getDefinition(): typeof SHOP_MERCHANT_TOOL_DEFINITION {
    return SHOP_MERCHANT_TOOL_DEFINITION;
  }

  /**
   * Get the tool name.
   */
  getName(): string {
    return SHOP_MERCHANT_TOOL_DEFINITION.name;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a shop_merchant tool handler.
 */
export function createShopMerchantTool(
  registry: MerchantRegistry,
  client: GatewayClient,
  parser: IntentParser
): ShopMerchantTool {
  return new ShopMerchantTool(registry, client, parser);
}

