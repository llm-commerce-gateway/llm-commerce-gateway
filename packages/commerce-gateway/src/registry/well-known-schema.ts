/**
 * @betterdata/commerce-gateway - .well-known Schema
 * 
 * Type definitions and validation for the .well-known/commerce-gateway.json schema
 * See: commerce-gateway-implementation-spec.md Appendix A
 * 
 * @license MIT
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Schema for `/.well-known/commerce-gateway.json`
 * 
 * @example
 * ```json
 * {
 *   "version": "1.0",
 *   "brand": "Example Brand",
 *   "gateway": {
 *     "endpoint": "https://api.example.com/llm/v1",
 *     "protocol": "mcp",
 *     "capabilities": {
 *       "catalog_search": true,
 *       "pricing": "public",
 *       "inventory": "real_time",
 *       "checkout": false
 *     },
 *     "auth": {
 *       "type": "none"
 *     }
 *   },
 *   "gtins": {
 *     "prefixes": ["0012345", "0012346"]
 *   },
 *   "categories": ["beauty.makeup", "beauty.skincare"],
 *   "contact": "commerce@example.com"
 * }
 * ```
 */
export interface WellKnownCommerceGateway {
  /** Schema version */
  version: string;
  
  /** Brand name */
  brand: string;
  
  /** Gateway configuration */
  gateway: {
    /** Gateway endpoint URL */
    endpoint: string;
    
    /** Protocol type (mcp, rest, openapi, graphql) */
    protocol: 'mcp' | 'rest' | 'openapi' | 'graphql';
    
    /** Gateway capabilities */
    capabilities: {
      catalog_search: boolean;
      pricing: 'public' | 'private' | 'none';
      inventory: 'real_time' | 'cached' | 'none';
      checkout: boolean;
    };
    
    /** Authentication configuration */
    auth: {
      type: 'none' | 'api_key' | 'oauth2' | 'bearer';
      [key: string]: unknown;
    };
  };
  
  /** GTIN information (optional) */
  gtins?: {
    /** GS1 company prefixes */
    prefixes?: string[];
  };
  
  /** Category paths (optional) */
  categories?: string[];
  
  /** Contact email (optional) */
  contact?: string;
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate that data matches the .well-known schema
 */
export function isValidWellKnownSchema(data: unknown): data is WellKnownCommerceGateway {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Required fields
  if (typeof obj.version !== 'string') {
    return false;
  }

  if (typeof obj.brand !== 'string') {
    return false;
  }

  // Gateway object
  if (typeof obj.gateway !== 'object' || obj.gateway === null) {
    return false;
  }

  const gateway = obj.gateway as Record<string, unknown>;

  if (typeof gateway.endpoint !== 'string') {
    return false;
  }

  if (typeof gateway.protocol !== 'string' || 
      !['mcp', 'rest', 'openapi', 'graphql'].includes(gateway.protocol)) {
    return false;
  }

  // Capabilities (required)
  if (typeof gateway.capabilities !== 'object' || gateway.capabilities === null) {
    return false;
  }

  const capabilities = gateway.capabilities as Record<string, unknown>;
  
  if (typeof capabilities.catalog_search !== 'boolean') {
    return false;
  }

  if (typeof capabilities.pricing !== 'string' ||
      !['public', 'private', 'none'].includes(capabilities.pricing)) {
    return false;
  }

  if (typeof capabilities.inventory !== 'string' ||
      !['real_time', 'cached', 'none'].includes(capabilities.inventory)) {
    return false;
  }

  if (typeof capabilities.checkout !== 'boolean') {
    return false;
  }

  // Auth (required)
  if (typeof gateway.auth !== 'object' || gateway.auth === null) {
    return false;
  }

  const auth = gateway.auth as Record<string, unknown>;
  
  if (typeof auth.type !== 'string' ||
      !['none', 'api_key', 'oauth2', 'bearer'].includes(auth.type)) {
    return false;
  }

  // Optional fields validation
  if (obj.gtins !== undefined) {
    if (typeof obj.gtins !== 'object' || obj.gtins === null) {
      return false;
    }

    const gtins = obj.gtins as Record<string, unknown>;
    
    if (gtins.prefixes !== undefined) {
      if (!Array.isArray(gtins.prefixes)) {
        return false;
      }
      
      if (!gtins.prefixes.every((p: unknown) => typeof p === 'string')) {
        return false;
      }
    }
  }

  if (obj.categories !== undefined) {
    if (!Array.isArray(obj.categories)) {
      return false;
    }
    
    if (!obj.categories.every((c: unknown) => typeof c === 'string')) {
      return false;
    }
  }

  if (obj.contact !== undefined && typeof obj.contact !== 'string') {
    return false;
  }

  return true;
}

/**
 * Parse and validate .well-known data
 */
export function parseWellKnownSchema(data: unknown): WellKnownCommerceGateway | null {
  if (!isValidWellKnownSchema(data)) {
    return null;
  }

  return data;
}

