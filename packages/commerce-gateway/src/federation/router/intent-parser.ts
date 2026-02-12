/**
 * @betterdata/llm-gateway - Intent Parser
 *
 * Extracts merchant intent and search query from natural language user input.
 * Supports URL detection, brand name matching, and filter extraction.
 *
 * @example
 * ```typescript
 * import { IntentParser } from '@betterdata/llm-gateway/federation';
 * import { MemoryMerchantRegistry } from '@betterdata/llm-gateway/federation';
 *
 * const registry = new MemoryMerchantRegistry([
 *   {
 *     domain: 'vuoriclothing.com',
 *     aliases: ['vuori', 'vuori clothing'],
 *     gatewayUrl: 'https://api.vuori.com/llm-gateway',
 *     tier: 'verified',
 *     capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *     metadata: { name: 'Vuori', categories: ['activewear', 'athleisure'] },
 *   },
 * ]);
 *
 * const parser = new IntentParser({ registry });
 *
 * // URL pattern
 * const intent1 = await parser.parse('shop https://vuoriclothing.com for joggers');
 * // → { merchant: { domain: 'vuoriclothing.com', confidence: 'high' }, query: 'joggers' }
 *
 * // Brand name pattern
 * const intent2 = await parser.parse('search Vuori for joggers under $100');
 * // → { merchant: { domain: 'vuoriclothing.com', confidence: 'high' }, query: 'joggers', filters: { priceRange: { max: 100 } } }
 *
 * // Domain pattern
 * const intent3 = await parser.parse('find dresses on macys.com');
 * // → { merchant: { domain: 'macys.com', confidence: 'high' }, query: 'dresses' }
 * ```
 *
 * @license MIT
 */

import type { MerchantRegistry } from '../registry/interface';
import type { DiscoveredMerchant, MerchantRegistration } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence level for merchant detection.
 *
 * - `high`: Exact URL or domain match, or exact alias match
 * - `medium`: Fuzzy alias match or partial brand name match
 * - `low`: Category-based inference or weak signal
 */
export type MatchConfidence = 'high' | 'medium' | 'low';

/**
 * Parsed shopping intent from user input.
 *
 * @example
 * ```typescript
 * // Input: "shop vuori for joggers under $100"
 * const intent: ParsedIntent = {
 *   merchant: {
 *     domain: 'vuoriclothing.com',
 *     name: 'Vuori',
 *     confidence: 'high',
 *     matchedOn: 'alias',
 *   },
 *   query: 'joggers',
 *   filters: {
 *     priceRange: { max: 100 },
 *   },
 *   rawInput: 'shop vuori for joggers under $100',
 * };
 * ```
 */
export interface ParsedIntent {
  /** Resolved merchant information */
  merchant: {
    /** Primary domain of the merchant */
    domain: string;
    /** Display name */
    name: string;
    /** Confidence level of the match */
    confidence: MatchConfidence;
    /** What matched (for debugging) */
    matchedOn: 'url' | 'domain' | 'alias' | 'brand' | 'fuzzy';
    /** The raw string that matched */
    matchedValue: string;
  };

  /** Extracted product search query */
  query: string;

  /** Extracted search filters */
  filters?: {
    /** Category filter */
    category?: string;
    /** Price range filter */
    priceRange?: {
      min?: number;
      max?: number;
    };
    /** In-stock only filter */
    inStock?: boolean;
  };

  /** Original user input */
  rawInput: string;
}

/**
 * Options for the IntentParser.
 */
export interface IntentParserOptions {
  /** Merchant registry for alias resolution */
  registry: MerchantRegistry;

  /**
   * Strict mode: only match merchants that exist in the registry.
   * If false, will return unregistered domains with low confidence.
   * @default false
   */
  strictMode?: boolean;

  /**
   * Enable fuzzy matching for brand names.
   * @default true
   */
  fuzzyMatching?: boolean;

  /**
   * Minimum fuzzy match score (0-1).
   * @default 0.7
   */
  fuzzyThreshold?: number;
}

// ============================================================================
// Intent Parser
// ============================================================================

/**
 * Parses natural language shopping queries to extract merchant intent and search terms.
 *
 * The parser uses multiple strategies in order of precedence:
 * 1. Full URL detection ("shop https://vuori.com for...")
 * 2. Domain pattern detection ("search macys.com for...")
 * 3. Brand name detection ("shop Vuori for...")
 * 4. Fuzzy alias matching
 *
 * @example
 * ```typescript
 * const parser = new IntentParser({ registry });
 *
 * // Test cases:
 *
 * // Full URL
 * await parser.parse('shop https://vuoriclothing.com/products for joggers');
 * // → merchant: vuoriclothing.com (high), query: joggers
 *
 * // Domain pattern
 * await parser.parse('search macys.com for red dresses');
 * // → merchant: macys.com (high), query: red dresses
 *
 * // Brand name (exact alias)
 * await parser.parse('find joggers at Vuori');
 * // → merchant: vuoriclothing.com (high), query: joggers
 *
 * // Brand name (fuzzy)
 * await parser.parse('shop vuory for pants');
 * // → merchant: vuoriclothing.com (medium), query: pants
 *
 * // With price filter
 * await parser.parse('search Nike for running shoes under $150');
 * // → merchant: nike.com (high), query: running shoes, filters: { priceRange: { max: 150 } }
 *
 * // With price range
 * await parser.parse('find bags at Coach $200-$500');
 * // → merchant: coach.com (high), query: bags, filters: { priceRange: { min: 200, max: 500 } }
 *
 * // With category
 * await parser.parse('shop Nordstrom in activewear for leggings');
 * // → merchant: nordstrom.com (high), query: leggings, filters: { category: activewear }
 *
 * // Possessive pattern
 * await parser.parse("find Nike's latest running shoes");
 * // → merchant: nike.com (high), query: latest running shoes
 *
 * // No merchant (returns null)
 * await parser.parse('find me some joggers');
 * // → null (use suggestMerchants instead)
 * ```
 */
export class IntentParser {
  private registry: MerchantRegistry;
  private strictMode: boolean;
  private fuzzyMatching: boolean;
  private fuzzyThreshold: number;

  // ==========================================================================
  // Regex Patterns
  // ==========================================================================

  /** Match full URLs: https://example.com/path */
  private readonly URL_PATTERN = /https?:\/\/([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+)(?:\/[^\s]*)?/gi;

  /** Match domain patterns: shop example.com, search store.co.uk */
  private readonly DOMAIN_PATTERN =
    /(?:shop|search|find|browse|at|on|from)\s+([a-z0-9][-a-z0-9]*(?:\.[a-z]{2,})+)/gi;

  /** Match brand name after action words */
  private readonly BRAND_AFTER_ACTION_PATTERN =
    /(?:shop|search|find|browse)\s+([A-Z][a-zA-Z0-9']*(?:\s+[A-Z][a-zA-Z0-9']*)*)\s+(?:for\s+)?/gi;

  /** Match "at/on/from Brand" pattern */
  private readonly BRAND_PREPOSITION_PATTERN =
    /(?:at|on|from)\s+([A-Z][a-zA-Z0-9']*(?:\s+[A-Z][a-zA-Z0-9']*)*)/gi;

  /** Match possessive pattern: Brand's products */
  private readonly BRAND_POSSESSIVE_PATTERN =
    /([A-Z][a-zA-Z0-9]*)'s?\s+/gi;

  /** Extract "for [query]" pattern */
  private readonly FOR_QUERY_PATTERN = /\bfor\s+(.+?)(?:\s+(?:under|less than|below|above|over|\$|in\s+\w+)|$)/i;

  /** Extract "find [query]" when no "for" present */
  private readonly FIND_QUERY_PATTERN = /\bfind\s+(?:me\s+)?(?:some\s+)?(.+?)(?:\s+(?:at|on|from|under|less than|below|above|over|\$)|$)/i;

  /** Match "under $X", "less than $X", "below $X", "max $X" */
  private readonly PRICE_UNDER_PATTERN = /(?:under|less\s+than|below|max(?:imum)?)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi;

  /** Match "over $X", "above $X", "more than $X", "min $X" */
  private readonly PRICE_OVER_PATTERN = /(?:over|above|more\s+than|min(?:imum)?)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi;

  /** Match "$X-$Y", "$X to $Y", "$X – $Y" */
  private readonly PRICE_RANGE_PATTERN =
    /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–—to]+\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi;

  /** Match category filter: "in [category]" */
  private readonly CATEGORY_PATTERN = /\bin\s+([a-z]+(?:\s+[a-z]+)?)\s*$/i;

  /** Match in-stock filter */
  private readonly IN_STOCK_PATTERN = /\b(?:in\s*stock|available|in-stock)\b/i;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor(options: IntentParserOptions) {
    this.registry = options.registry;
    this.strictMode = options.strictMode ?? false;
    this.fuzzyMatching = options.fuzzyMatching ?? true;
    this.fuzzyThreshold = options.fuzzyThreshold ?? 0.7;
  }

  // ==========================================================================
  // Main Parse Method
  // ==========================================================================

  /**
   * Parse user input to extract shopping intent.
   *
   * @param input - Raw user input string
   * @returns Parsed intent or null if no merchant detected
   */
  async parse(input: string): Promise<ParsedIntent | null> {
    const rawInput = input.trim();

    if (!rawInput) {
      return null;
    }

    // Try parsing strategies in order of precedence
    let result: ParsedIntent | null = null;

    // 1. Try URL pattern (highest confidence)
    result = await this.tryParseUrl(rawInput);
    if (result) return result;

    // 2. Try domain pattern
    result = await this.tryParseDomain(rawInput);
    if (result) return result;

    // 3. Try brand name patterns
    result = await this.tryParseBrandName(rawInput);
    if (result) return result;

    // 4. Try fuzzy matching (if enabled)
    if (this.fuzzyMatching) {
      result = await this.tryFuzzyMatch(rawInput);
      if (result) return result;
    }

    // No merchant detected
    return null;
  }

  // ==========================================================================
  // URL Pattern Parsing
  // ==========================================================================

  /**
   * Try to parse a full URL from the input.
   */
  private async tryParseUrl(input: string): Promise<ParsedIntent | null> {
    // Reset regex state
    this.URL_PATTERN.lastIndex = 0;

    const match = this.URL_PATTERN.exec(input);
    if (!match || !match[1]) {
      return null;
    }

    const domain = match[1].toLowerCase();
    const merchant = await this.registry.get(domain);

    if (!merchant && this.strictMode) {
      return null;
    }

    const query = this.extractQuery(input, match[0]);
    const filters = this.extractFilters(input);

    return {
      merchant: {
        domain,
        name: merchant?.metadata.name ?? domain,
        confidence: 'high',
        matchedOn: 'url',
        matchedValue: match[0],
      },
      query,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      rawInput: input,
    };
  }

  // ==========================================================================
  // Domain Pattern Parsing
  // ==========================================================================

  /**
   * Try to parse a domain pattern (e.g., "shop macys.com for...").
   */
  private async tryParseDomain(input: string): Promise<ParsedIntent | null> {
    // Reset regex state
    this.DOMAIN_PATTERN.lastIndex = 0;

    const match = this.DOMAIN_PATTERN.exec(input);
    if (!match || !match[1]) {
      return null;
    }

    const domain = match[1].toLowerCase();
    const merchant = await this.registry.get(domain);

    if (!merchant && this.strictMode) {
      return null;
    }

    const query = this.extractQuery(input, match[0] || '');
    const filters = this.extractFilters(input);

    return {
      merchant: {
        domain,
        name: merchant?.metadata.name ?? domain,
        confidence: 'high',
        matchedOn: 'domain',
        matchedValue: match[1],
      },
      query,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      rawInput: input,
    };
  }

  // ==========================================================================
  // Brand Name Pattern Parsing
  // ==========================================================================

  /**
   * Try to parse brand name patterns.
   */
  private async tryParseBrandName(input: string): Promise<ParsedIntent | null> {
    // Try different brand patterns
    const brandPatterns = [
      { pattern: this.BRAND_AFTER_ACTION_PATTERN, type: 'brand' as const },
      { pattern: this.BRAND_PREPOSITION_PATTERN, type: 'brand' as const },
      { pattern: this.BRAND_POSSESSIVE_PATTERN, type: 'brand' as const },
    ];

    for (const { pattern, type } of brandPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(input);

      if (match && match[1]) {
        const brandName = match[1].trim();
        const merchant = await this.registry.findByAlias(brandName);

        if (merchant) {
          const query = this.extractQuery(input, match[0]);
          const filters = this.extractFilters(input);

          return {
            merchant: {
              domain: merchant.domain,
              name: merchant.metadata.name,
              confidence: 'high',
              matchedOn: type,
              matchedValue: brandName,
            },
            query,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            rawInput: input,
          };
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Fuzzy Matching
  // ==========================================================================

  /**
   * Try fuzzy matching for brand names.
   */
  private async tryFuzzyMatch(input: string): Promise<ParsedIntent | null> {
    // Extract potential brand names (capitalized words)
    const capitalizedWords = input.match(/\b[A-Z][a-zA-Z0-9']*\b/g);

    if (!capitalizedWords || capitalizedWords.length === 0) {
      // Also try lowercase words that might be brands
      const words = input.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length >= 3) {
          const merchant = await this.tryFuzzyMatchWord(word);
          if (merchant) {
            const query = this.extractQuery(input, word);
            const filters = this.extractFilters(input);

            return {
              merchant: {
                domain: merchant.domain,
                name: merchant.metadata.name,
                confidence: 'medium',
                matchedOn: 'fuzzy',
                matchedValue: word,
              },
              query,
              filters: Object.keys(filters).length > 0 ? filters : undefined,
              rawInput: input,
            };
          }
        }
      }
      return null;
    }

    for (const word of capitalizedWords) {
      const merchant = await this.tryFuzzyMatchWord(word);
      if (merchant) {
        const query = this.extractQuery(input, word);
        const filters = this.extractFilters(input);

        return {
          merchant: {
            domain: merchant.domain,
            name: merchant.metadata.name,
            confidence: 'medium',
            matchedOn: 'fuzzy',
            matchedValue: word,
          },
          query,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          rawInput: input,
        };
      }
    }

    return null;
  }

  /**
   * Try to fuzzy match a single word against registry.
   */
  private async tryFuzzyMatchWord(
    word: string
  ): Promise<MerchantRegistration | null> {
    // First try exact match
    const exact = await this.registry.findByAlias(word);
    if (exact) {
      return exact;
    }

    // Get all merchants and try fuzzy matching
    const merchants = await this.registry.list({ limit: 100 });

    for (const merchant of merchants) {
      const allNames = [
        merchant.metadata.name,
        merchant.domain.split('.')[0],
        ...merchant.aliases,
      ];

      for (const name of allNames) {
        if (!name) continue;
        const score = this.fuzzyScore(word.toLowerCase(), name.toLowerCase());
        if (score >= this.fuzzyThreshold) {
          return merchant;
        }
      }
    }

    return null;
  }

  /**
   * Calculate fuzzy match score using Levenshtein distance.
   */
  private fuzzyScore(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Check if one contains the other
    if (a.includes(b) || b.includes(a)) {
      return 0.9;
    }

    // Calculate Levenshtein distance
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1;

    // Initialize matrix with proper typing
    const matrix: number[][] = Array.from({ length: b.length + 1 }, () => 
      Array.from({ length: a.length + 1 }, () => 0)
    );

    for (let i = 0; i <= a.length; i++) {
      const row = matrix[0];
      if (row) row[i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      const row = matrix[j];
      if (row) row[0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const row = matrix[j];
        const prevRow = matrix[j - 1];
        if (!row || !prevRow) continue;
        
        if (a[i - 1] === b[j - 1]) {
          row[i] = prevRow[i - 1] ?? 0;
        } else {
          row[i] = Math.min(
            (prevRow[i - 1] ?? 0) + 1,
            (row[i - 1] ?? 0) + 1,
            (prevRow[i] ?? 0) + 1
          );
        }
      }
    }

    const lastRow = matrix[b.length];
    const distance = lastRow?.[a.length] ?? 0;

    return 1 - distance / maxLength;
  }

  // ==========================================================================
  // Query Extraction
  // ==========================================================================

  /**
   * Extract the product search query from input.
   */
  private extractQuery(input: string, merchantMatch: string): string {
    // Remove the merchant match from input
    let remaining = input.replace(merchantMatch, ' ').trim();

    // Remove action words
    remaining = remaining.replace(/^(?:shop|search|find|browse)\s+/i, '');

    // Try "for [query]" pattern
    this.FOR_QUERY_PATTERN.lastIndex = 0;
    const forMatch = this.FOR_QUERY_PATTERN.exec(remaining);
    if (forMatch && forMatch[1]) {
      return this.cleanQuery(forMatch[1]);
    }

    // Try "find [query]" pattern
    this.FIND_QUERY_PATTERN.lastIndex = 0;
    const findMatch = this.FIND_QUERY_PATTERN.exec(remaining);
    if (findMatch && findMatch[1]) {
      return this.cleanQuery(findMatch[1]);
    }

    // Remove filter patterns and return remaining
    remaining = remaining
      .replace(this.PRICE_UNDER_PATTERN, '')
      .replace(this.PRICE_OVER_PATTERN, '')
      .replace(this.PRICE_RANGE_PATTERN, '')
      .replace(this.CATEGORY_PATTERN, '')
      .replace(this.IN_STOCK_PATTERN, '')
      .replace(/\bfor\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return remaining;
  }

  /**
   * Clean up extracted query.
   */
  private cleanQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/^(?:me|some|a|an|the)\s+/i, '')
      .trim();
  }

  // ==========================================================================
  // Filter Extraction
  // ==========================================================================

  /**
   * Extract price and category filters from input.
   */
  private extractFilters(input: string): NonNullable<ParsedIntent['filters']> {
    const filters: NonNullable<ParsedIntent['filters']> = {};

    // Extract price range pattern first (most specific)
    this.PRICE_RANGE_PATTERN.lastIndex = 0;
    const rangeMatch = this.PRICE_RANGE_PATTERN.exec(input);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      filters.priceRange = {
        min: this.parsePrice(rangeMatch[1]),
        max: this.parsePrice(rangeMatch[2]),
      };
    } else {
      // Try individual price patterns
      this.PRICE_UNDER_PATTERN.lastIndex = 0;
      const underMatch = this.PRICE_UNDER_PATTERN.exec(input);
      if (underMatch && underMatch[1]) {
        filters.priceRange = { max: this.parsePrice(underMatch[1]) };
      }

      this.PRICE_OVER_PATTERN.lastIndex = 0;
      const overMatch = this.PRICE_OVER_PATTERN.exec(input);
      if (overMatch && overMatch[1]) {
        filters.priceRange = {
          ...filters.priceRange,
          min: this.parsePrice(overMatch[1]),
        };
      }
    }

    // Extract category
    this.CATEGORY_PATTERN.lastIndex = 0;
    const categoryMatch = this.CATEGORY_PATTERN.exec(input);
    if (categoryMatch && categoryMatch[1]) {
      filters.category = categoryMatch[1].toLowerCase();
    }

    // Extract in-stock filter
    if (this.IN_STOCK_PATTERN.test(input)) {
      filters.inStock = true;
    }

    return filters;
  }

  /**
   * Parse price string to number.
   */
  private parsePrice(priceStr: string): number {
    return parseFloat(priceStr.replace(/,/g, ''));
  }

  // ==========================================================================
  // Merchant Suggestion
  // ==========================================================================

  /**
   * Suggest relevant merchants when no specific merchant was detected.
   *
   * @param query - The product search query
   * @param limit - Maximum suggestions to return (default: 5)
   * @returns Ranked list of suggested merchants
   *
   * @example
   * ```typescript
   * const suggestions = await parser.suggestMerchants('running shoes');
   * // → [
   * //   { domain: 'nike.com', name: 'Nike', categories: ['athletic', 'footwear'], relevanceScore: 0.95 },
   * //   { domain: 'hoka.com', name: 'HOKA', categories: ['running', 'footwear'], relevanceScore: 0.90 },
   * // ]
   * ```
   */
  async suggestMerchants(
    query: string,
    limit: number = 5
  ): Promise<DiscoveredMerchant[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Get all merchants
    const merchants = await this.registry.list({ limit: 100 });

    // Score each merchant
    const scored: Array<{ merchant: MerchantRegistration; score: number }> = [];

    for (const merchant of merchants) {
      let score = 0;

      // Check category matches
      for (const category of merchant.metadata.categories) {
        const categoryLower = category.toLowerCase();
        if (queryLower.includes(categoryLower)) {
          score += 0.5;
        }
        for (const word of queryWords) {
          if (categoryLower.includes(word)) {
            score += 0.3;
          }
        }
      }

      // Check description matches
      if (merchant.metadata.description) {
        const descLower = merchant.metadata.description.toLowerCase();
        for (const word of queryWords) {
          if (descLower.includes(word)) {
            score += 0.2;
          }
        }
      }

      // Boost verified merchants
      if (merchant.tier === 'verified') {
        score *= 1.2;
      }

      if (score > 0) {
        scored.push({ merchant, score });
      }
    }

    // Sort by score and return top results
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ merchant, score }) => ({
      domain: merchant.domain,
      name: merchant.metadata.name,
      categories: merchant.metadata.categories,
      tier: merchant.tier,
      relevanceScore: Math.min(1, score),
      logoUrl: merchant.metadata.logoUrl,
      capabilities: merchant.capabilities,
    }));
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if input likely contains a merchant reference.
   *
   * Useful for quick filtering before full parsing.
   */
  hasLikelyMerchantReference(input: string): boolean {
    // Check for URL
    if (/https?:\/\//i.test(input)) return true;

    // Check for .com/.org/.net etc
    if (/\.[a-z]{2,4}\b/i.test(input)) return true;

    // Check for action + capitalized word
    if (/(?:shop|search|find|browse)\s+[A-Z]/i.test(input)) return true;

    // Check for "at/on/from Brand"
    if (/(?:at|on|from)\s+[A-Z]/i.test(input)) return true;

    return false;
  }

  /**
   * Extract just the search query, ignoring merchant references.
   *
   * Useful when you want to search across all merchants.
   */
  extractQueryOnly(input: string): string {
    let remaining = input;

    // Remove URLs
    remaining = remaining.replace(this.URL_PATTERN, '');

    // Remove domain patterns
    this.DOMAIN_PATTERN.lastIndex = 0;
    remaining = remaining.replace(this.DOMAIN_PATTERN, '');

    // Remove brand patterns
    this.BRAND_AFTER_ACTION_PATTERN.lastIndex = 0;
    remaining = remaining.replace(this.BRAND_AFTER_ACTION_PATTERN, '');

    this.BRAND_PREPOSITION_PATTERN.lastIndex = 0;
    remaining = remaining.replace(this.BRAND_PREPOSITION_PATTERN, '');

    // Extract the actual query
    return this.extractQuery(remaining, '');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new IntentParser instance.
 *
 * @param options - Parser options
 * @returns IntentParser instance
 */
export function createIntentParser(options: IntentParserOptions): IntentParser {
  return new IntentParser(options);
}

