/**
 * @betterdata/commerce-gateway - @shop Query Parser
 * 
 * Parses @shop queries to extract brand, product query, or GTIN
 * 
 * @license MIT
 */

// ============================================================================
// Types
// ============================================================================

export interface ParsedShopQuery {
  type: 'brand' | 'gtin';
  brand?: string;
  productQuery?: string;
  gtin?: string;
}

// ============================================================================
// Query Parser
// ============================================================================

/**
 * Parse a @shop query string
 * 
 * Examples:
 * - "@shop Nike" → { type: "brand", brand: "Nike" }
 * - "@shop Nike Air Max" → { type: "brand", brand: "Nike", productQuery: "Air Max" }
 * - "@shop 012345678901" → { type: "gtin", gtin: "012345678901" }
 */
export function parseShopQuery(query: string): ParsedShopQuery {
  // Remove @shop prefix if present
  const cleaned = query.replace(/^@shop\s*/i, '').trim();

  // Check if it's a GTIN (8, 12, 13, or 14 digits)
  if (/^\d{8}$|^\d{12,14}$/.test(cleaned)) {
    return { type: 'gtin', gtin: cleaned };
  }

  // Check for brand + product query
  // Heuristic: Try progressively longer brand names
  const words = cleaned.split(/\s+/);

  // Try progressively longer brand names (from longest to shortest)
  for (let i = words.length; i >= 1; i--) {
    const possibleBrand = words.slice(0, i).join(' ');
    const productQuery = words.slice(i).join(' ');

    // If we have a product query, assume the brand is the first part
    if (productQuery) {
      return {
        type: 'brand',
        brand: possibleBrand,
        productQuery,
      };
    }

    // If no product query, check if it looks like a brand
    if (looksLikeBrand(possibleBrand)) {
      return {
        type: 'brand',
        brand: possibleBrand,
      };
    }
  }

  // Default: treat entire query as brand
  return { type: 'brand', brand: cleaned };
}

/**
 * Check if a string looks like a brand name
 * 
 * Heuristics:
 * - Not all digits
 * - Has at least one letter
 * - Not too long (reasonable brand name length)
 */
function looksLikeBrand(str: string): boolean {
  // Not all digits
  if (/^\d+$/.test(str)) {
    return false;
  }

  // Has at least one letter
  if (!/[a-zA-Z]/.test(str)) {
    return false;
  }

  // Reasonable length (1-50 characters)
  if (str.length < 1 || str.length > 50) {
    return false;
  }

  return true;
}

