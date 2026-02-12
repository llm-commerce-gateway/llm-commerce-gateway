/**
 * @betterdata/llm-gateway - Discover Merchants Tool
 *
 * Federation tool for discovering merchants by category or product type.
 * Helps users find stores when they don't have a specific merchant in mind.
 *
 * @example
 * ```typescript
 * // User says: "where can I buy running shoes?"
 * // LLM calls: discover_merchants({ query: "running shoes" })
 *
 * const tool = new DiscoverMerchantsTool(registry);
 * const result = await tool.execute({ query: 'running shoes' });
 *
 * // Returns list of relevant merchants
 * // { domain: 'nike.com', name: 'Nike', categories: ['athletic', 'footwear'], ... }
 * ```
 *
 * @license MIT
 */

import { z } from 'zod';
import type { MerchantRegistry } from '../registry/interface';
import type { FederatedResult, DiscoveredMerchant, MerchantRegistration } from '../types';

// ============================================================================
// Discovery Provider Interface
// ============================================================================

/**
 * Interface for merchant discovery providers.
 *
 * Can be implemented with different strategies:
 * - Static category matching (OSS)
 * - Tag-based search (OSS)
 * - ML-powered ranking (proprietary)
 */
export interface DiscoveryProvider {
  /**
   * Discover merchants matching a query.
   *
   * @param query - Search query
   * @param options - Discovery options
   * @returns Ranked list of merchants
   */
  discover(
    query: string,
    options?: {
      category?: string;
      limit?: number;
      tier?: 'verified' | 'registered' | 'discovered';
    }
  ): Promise<DiscoveredMerchant[]>;
}

// ============================================================================
// Tool Schema
// ============================================================================

/**
 * Zod schema for discover_merchants tool arguments.
 */
export const DiscoverMerchantsArgsSchema = z.object({
  /** What the user is looking for */
  query: z
    .string()
    .min(1)
    .describe('What the user is looking for'),

  /** Product category to filter by */
  category: z
    .string()
    .optional()
    .describe('Product category to filter by'),

  /** Maximum number of merchants to return */
  limit: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of merchants to return'),

  /** Only show verified merchants */
  verifiedOnly: z
    .boolean()
    .optional()
    .describe('Only show verified merchants'),
});

/**
 * Type for discover_merchants arguments.
 */
export type DiscoverMerchantsArgs = z.infer<typeof DiscoverMerchantsArgsSchema>;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Universal tool definition for discover_merchants.
 */
export const DISCOVER_MERCHANTS_TOOL_DEFINITION = {
  name: 'discover_merchants',
  description: `Find stores and brands that sell specific products. Use when user wants shopping options without a specific store in mind.

Examples of when to use:
- "where can I buy running shoes"
- "find stores that sell activewear"
- "what stores have luxury watches"
- "show me fashion retailers"

Returns a list of connected merchants that may have relevant products.`,
  parameters: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'What the user is looking for',
      },
      category: {
        type: 'string',
        description: 'Product category to filter by (e.g., "activewear", "footwear", "electronics")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of merchants to return (default 5)',
      },
      verifiedOnly: {
        type: 'boolean',
        description: 'Only show verified merchants',
      },
    },
    required: ['query'],
  },
};

// ============================================================================
// Default Discovery Provider (OSS)
// ============================================================================

/**
 * Default discovery provider using category and keyword matching.
 *
 * This is the OSS implementation that does simple keyword matching
 * against merchant categories and descriptions.
 */
export class DefaultDiscoveryProvider implements DiscoveryProvider {
  private registry: MerchantRegistry;

  constructor(registry: MerchantRegistry) {
    this.registry = registry;
  }

  async discover(
    query: string,
    options?: {
      category?: string;
      limit?: number;
      tier?: 'verified' | 'registered' | 'discovered';
    }
  ): Promise<DiscoveredMerchant[]> {
    const limit = options?.limit ?? 5;
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Get merchants by category if specified
    let merchants: MerchantRegistration[];

    if (options?.category) {
      merchants = await this.registry.findByCategory(options.category);
    } else {
      merchants = await this.registry.list({
        tier: options?.tier,
        limit: 100, // Get more to score and filter
      });
    }

    // Score each merchant
    const scored: Array<{
      merchant: MerchantRegistration;
      score: number;
      reason: string;
    }> = [];

    for (const merchant of merchants) {
      if (!merchant.capabilities.search) {
        continue; // Skip merchants that can't search
      }

      const { score, reason } = this.scoreMerchant(merchant, queryLower, queryWords);

      if (score > 0) {
        scored.push({ merchant, score, reason });
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Convert to DiscoveredMerchant
    return scored.slice(0, limit).map(({ merchant, score, reason }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      matchReason: reason,
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  /**
   * Score a merchant based on query relevance.
   */
  private scoreMerchant(
    merchant: MerchantRegistration,
    queryLower: string,
    queryWords: string[]
  ): { score: number; reason: string } {
    let score = 0;
    let reason = '';

    // Check category matches
    for (const category of merchant.metadata.categories) {
      const categoryLower = category.toLowerCase();

      // Exact category match
      if (queryLower.includes(categoryLower)) {
        score += 0.6;
        reason = `Matches category: ${category}`;
      }

      // Word overlap with category
      for (const word of queryWords) {
        if (categoryLower.includes(word)) {
          score += 0.3;
          if (!reason) {
            reason = `Related to ${category}`;
          }
        }
      }
    }

    // Check description matches
    if (merchant.metadata.description) {
      const descLower = merchant.metadata.description.toLowerCase();
      for (const word of queryWords) {
        if (descLower.includes(word)) {
          score += 0.2;
          if (!reason) {
            reason = 'Matches description';
          }
        }
      }
    }

    // Check name matches
    const nameLower = merchant.metadata.name.toLowerCase();
    for (const word of queryWords) {
      if (nameLower.includes(word)) {
        score += 0.4;
        if (!reason) {
          reason = 'Matches store name';
        }
      }
    }

    // Boost verified merchants
    if (merchant.tier === 'verified') {
      score *= 1.2;
      if (reason) {
        reason += ' (Verified)';
      }
    }

    // Default reason if we have a score but no reason
    if (score > 0 && !reason) {
      reason = 'General match';
    }

    return { score, reason };
  }
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Handler for the discover_merchants tool.
 *
 * Uses a discovery provider to find merchants matching the query.
 * Falls back to DefaultDiscoveryProvider if none is provided.
 *
 * @example
 * ```typescript
 * // With default provider (category matching)
 * const tool = new DiscoverMerchantsTool(registry);
 *
 * // With custom provider (e.g., ML-powered)
 * const tool = new DiscoverMerchantsTool(registry, customProvider);
 *
 * const result = await tool.execute({
 *   query: 'running shoes',
 *   limit: 5,
 * });
 *
 * if (result.status === 'ok') {
 *   for (const merchant of result.data) {
 *     console.log(`${merchant.name} - ${merchant.matchReason}`);
 *   }
 * }
 * ```
 */
export class DiscoverMerchantsTool {
  private provider: DiscoveryProvider;

  /**
   * Create a new DiscoverMerchantsTool.
   *
   * @param registry - Merchant registry
   * @param provider - Optional custom discovery provider
   */
  constructor(registry: MerchantRegistry, provider?: DiscoveryProvider) {
    this.provider = provider ?? new DefaultDiscoveryProvider(registry);
  }

  /**
   * Execute the discover_merchants tool.
   *
   * @param args - Tool arguments
   * @returns Federated result with discovered merchants
   */
  async execute(
    args: DiscoverMerchantsArgs
  ): Promise<FederatedResult<DiscoveredMerchant[]>> {
    // Validate arguments
    const validated = DiscoverMerchantsArgsSchema.parse(args);

    // Discover merchants
    const merchants = await this.provider.discover(validated.query, {
      category: validated.category,
      limit: validated.limit,
      tier: validated.verifiedOnly ? 'verified' : undefined,
    });

    if (merchants.length === 0) {
      return {
        status: 'ok',
        data: [],
        message: `I couldn't find any connected stores matching "${validated.query}". Try a different search term or category.`,
      };
    }

    return {
      status: 'ok',
      data: merchants,
      message: `Found ${merchants.length} store${merchants.length > 1 ? 's' : ''} that may have what you're looking for.`,
    };
  }

  /**
   * Get the tool definition.
   */
  getDefinition(): typeof DISCOVER_MERCHANTS_TOOL_DEFINITION {
    return DISCOVER_MERCHANTS_TOOL_DEFINITION;
  }

  /**
   * Get the tool name.
   */
  getName(): string {
    return DISCOVER_MERCHANTS_TOOL_DEFINITION.name;
  }

  /**
   * Set a custom discovery provider.
   */
  setProvider(provider: DiscoveryProvider): void {
    this.provider = provider;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a discover_merchants tool handler.
 */
export function createDiscoverMerchantsTool(
  registry: MerchantRegistry,
  provider?: DiscoveryProvider
): DiscoverMerchantsTool {
  return new DiscoverMerchantsTool(registry, provider);
}

