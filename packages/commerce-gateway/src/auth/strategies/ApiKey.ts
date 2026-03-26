/**
 * @betterdata/commerce-gateway - API Key Strategy
 * 
 * Simple and secure API key authentication.
 * 
 * @license Apache-2.0
 */

import type {
  ApiKeyConfig,
  AuthUser,
  AuthRequest,
  AuthStrategyContext,
} from '../types';

// ============================================================================
// API Key Strategy
// ============================================================================

/**
 * API Key authentication strategy
 */
export class ApiKeyStrategy {
  private config: Required<ApiKeyConfig>;
  private keySet: Set<string>;

  constructor(config: ApiKeyConfig) {
    this.config = {
      keys: config.keys,
      headerName: config.headerName ?? 'x-api-key',
      queryParam: config.queryParam ?? 'api_key',
      allowBearer: config.allowBearer ?? true,
      prefix: config.prefix ?? '',
    };

    // Create set for O(1) lookup
    this.keySet = new Set(config.keys);
  }

  /**
   * Extract API key from request
   */
  extractKey(request: AuthRequest): string | null {
    // Check header (primary method)
    let key = request.headers[this.config.headerName.toLowerCase()];

    // Check Authorization header (Bearer format)
    if (!key && this.config.allowBearer) {
      const authHeader = request.headers['authorization'];
      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        key = authHeader.substring(7);
      }
    }

    // Check query param (fallback)
    if (!key && this.config.queryParam) {
      key = request.query?.[this.config.queryParam];
    }

    if (!key) return null;

    // Strip prefix if configured
    if (this.config.prefix && key.startsWith(this.config.prefix)) {
      key = key.substring(this.config.prefix.length);
    }

    return key;
  }

  /**
   * Validate API key and return user context
   */
  async validate(
    request: AuthRequest,
    _context?: AuthStrategyContext
  ): Promise<AuthUser | null> {
    const key = this.extractKey(request);
    if (!key) return null;

    // Validate key exists
    if (!this.keySet.has(key)) {
      return null;
    }

    // Create user context
    // In production, you might look up user details from a database
    return {
      id: `apikey_${this.hashKey(key)}`,
      authMethod: 'apiKey',
      anonymous: false,
      claims: {
        apiKeyId: this.hashKey(key),
      },
    };
  }

  /**
   * Hash key for identification (not security)
   */
  private hashKey(key: string): string {
    // Simple hash for identifying the key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  /**
   * Add a new API key at runtime
   */
  addKey(key: string): void {
    this.keySet.add(key);
    this.config.keys.push(key);
  }

  /**
   * Remove an API key at runtime
   */
  removeKey(key: string): void {
    this.keySet.delete(key);
    this.config.keys = this.config.keys.filter(k => k !== key);
  }

  /**
   * Check if a key is valid without creating user context
   */
  isValidKey(key: string): boolean {
    return this.keySet.has(key);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an API key strategy
 */
export function createApiKeyStrategy(config: ApiKeyConfig): ApiKeyStrategy {
  return new ApiKeyStrategy(config);
}

/**
 * Generate a new API key
 */
export function generateApiKey(prefix: string = 'sk'): string {
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random1}${random2}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string, prefix?: string): boolean {
  if (prefix) {
    return key.startsWith(`${prefix}_`);
  }
  return /^[a-z]{2}_[a-z0-9]{6,}_[a-z0-9]{20,}$/i.test(key);
}

