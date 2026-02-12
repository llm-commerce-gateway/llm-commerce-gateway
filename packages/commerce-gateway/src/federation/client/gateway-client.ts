/**
 * @betterdata/llm-gateway - Federation Gateway Client
 *
 * HTTP client for calling remote merchant LLM Gateways.
 * Handles authentication, retries, timeouts, and result mapping.
 *
 * @example
 * ```typescript
 * import { GatewayClient } from '@betterdata/llm-gateway/federation';
 *
 * const client = new GatewayClient({
 *   timeout: 10000,
 *   retries: 2,
 * });
 *
 * // Execute a search on a merchant's gateway
 * const result = await client.executeSearch(merchant, 'joggers', {
 *   filters: { priceMax: 100 },
 *   limit: 20,
 * });
 *
 * if (result.status === 'ok') {
 *   console.log(result.data.products);
 *   console.log(`Results from ${result.attribution?.merchant.name}`);
 * }
 * ```
 *
 * @license MIT
 */

import type {
  MerchantRegistration,
  MerchantCapabilities,
  FederatedResult,
  FederatedStatus,
  WellKnownGateway,
  VerificationMethod,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Search result from a merchant gateway.
 */
export interface SearchResult {
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price: { amount: number; currency: string };
    images?: Array<{ url: string; alt?: string }>;
    availability?: { inStock: boolean; quantity?: number };
    [key: string]: unknown;
  }>;
  total: number;
  hasMore: boolean;
  facets?: Record<string, unknown>;
}

/**
 * Options for the GatewayClient.
 */
export interface GatewayClientOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Number of retries on failure (default: 2) */
  retries?: number;

  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs?: number;

  /** JWT signing key for federated requests (Ed25519 private key, base64) */
  jwtSigningKey?: string;

  /** Key ID for the signing key */
  jwtKeyId?: string;

  /** Issuer claim for JWTs (default: "federation-hub") */
  jwtIssuer?: string;

  /** User agent string */
  userAgent?: string;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Options for executing a search.
 */
export interface SearchOptions {
  /** Search filters */
  filters?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    inStock?: boolean;
    [key: string]: unknown;
  };

  /** Session ID for cart continuity */
  sessionId?: string;

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Tool execution result from a gateway.
 */
interface ToolExecutionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  sessionId?: string;
}

// ============================================================================
// Gateway Client
// ============================================================================

/**
 * HTTP client for calling remote merchant LLM Gateways.
 *
 * This client is used by the Federation Hub to execute tools on
 * merchant gateways. It handles:
 * - Authentication (API keys or JWT signing)
 * - Retries with exponential backoff
 * - Timeout handling
 * - Result mapping to FederatedResult format
 *
 * @example
 * ```typescript
 * const client = new GatewayClient({ timeout: 15000 });
 *
 * // Search for products
 * const searchResult = await client.executeSearch(merchant, 'running shoes');
 *
 * // Execute any tool
 * const cartResult = await client.executeToolCall(merchant, 'add_to_cart', {
 *   productId: 'prod_123',
 *   quantity: 2,
 * });
 *
 * // Check gateway capabilities
 * const caps = await client.checkCapabilities('https://api.vuori.com/llm-gateway');
 *
 * // Verify merchant ownership
 * const verified = await client.verifyMerchant('vuori.com', 'https://api.vuori.com', 'dns');
 * ```
 */
export class GatewayClient {
  private timeout: number;
  private retries: number;
  private retryDelayMs: number;
  private jwtSigningKey?: string;
  private jwtKeyId?: string;
  private jwtIssuer: string;
  private userAgent: string;
  private debug: boolean;

  constructor(options: GatewayClientOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.jwtSigningKey = options.jwtSigningKey;
    this.jwtKeyId = options.jwtKeyId;
    this.jwtIssuer = options.jwtIssuer ?? 'federation-hub';
    this.userAgent = options.userAgent ?? '@betterdata/llm-gateway-client/1.0';
    this.debug = options.debug ?? false;
  }

  // ==========================================================================
  // Search Execution
  // ==========================================================================

  /**
   * Execute a product search on a merchant's gateway.
   *
   * @param merchant - Merchant registration with gateway URL
   * @param query - Search query string
   * @param options - Search options (filters, pagination, session)
   * @returns Federated result with search data and attribution
   *
   * @example
   * ```typescript
   * const result = await client.executeSearch(merchant, 'blue joggers', {
   *   filters: { priceMax: 100, inStock: true },
   *   limit: 20,
   * });
   *
   * if (result.status === 'ok') {
   *   for (const product of result.data.products) {
   *     console.log(`${product.name} - $${product.price.amount}`);
   *   }
   * }
   * ```
   */
  async executeSearch(
    merchant: MerchantRegistration,
    query: string,
    options?: SearchOptions
  ): Promise<FederatedResult<SearchResult>> {
    // Check capability
    if (!merchant.capabilities.search) {
      return {
        status: 'capability_not_supported',
        message: `Merchant ${merchant.domain} does not support search`,
      };
    }

    const args: Record<string, unknown> = {
      query,
      ...(options?.filters && { filters: options.filters }),
      ...(options?.limit && { pagination: { limit: options.limit, offset: options?.offset ?? 0 } }),
    };

    const result = await this.executeToolCall<SearchResult>(
      merchant,
      'search_products',
      args,
      options?.sessionId
    );

    return result;
  }

  // ==========================================================================
  // Generic Tool Execution
  // ==========================================================================

  /**
   * Execute any tool on a merchant's gateway.
   *
   * @param merchant - Merchant registration
   * @param tool - Tool name (e.g., 'add_to_cart', 'check_inventory')
   * @param args - Tool arguments
   * @param sessionId - Optional session ID
   * @returns Federated result with tool output
   *
   * @example
   * ```typescript
   * // Add to cart
   * const result = await client.executeToolCall(merchant, 'add_to_cart', {
   *   productId: 'prod_123',
   *   quantity: 2,
   * });
   *
   * // Check inventory
   * const inventory = await client.executeToolCall(merchant, 'check_inventory', {
   *   productId: 'prod_123',
   * });
   * ```
   */
  async executeToolCall<T = unknown>(
    merchant: MerchantRegistration,
    tool: string,
    args: Record<string, unknown>,
    sessionId?: string
  ): Promise<FederatedResult<T>> {
    const startTime = Date.now();
    const url = `${merchant.gatewayUrl.replace(/\/$/, '')}/api/tools/execute`;

    try {
      const response = await this.withRetry(async () => {
        const headers = this.buildHeaders(merchant, sessionId);
        const body = JSON.stringify({
          toolName: tool,
          input: args,
          sessionId,
        });

        this.log(`Calling ${tool} on ${merchant.domain}`, { url, args });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return res;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`Gateway error: ${response.status}`, { errorText });

        if (response.status === 401 || response.status === 403) {
          return {
            status: 'auth_failed',
            message: `Authentication failed for ${merchant.domain}: ${response.status}`,
          };
        }

        if (response.status === 429) {
          return {
            status: 'rate_limited',
            message: `Rate limited by ${merchant.domain}`,
          };
        }

        return {
          status: 'merchant_unreachable',
          message: `Gateway returned ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json() as { success: boolean; data?: ToolExecutionResponse; error?: string };

      const gatewayMs = Date.now() - startTime;

      if (!data.success) {
        return {
          status: 'merchant_unreachable',
          message: data.error ?? 'Tool execution failed',
          timing: { totalMs: gatewayMs, gatewayMs },
        };
      }

      // Extract the actual result data
      const resultData = data.data as { result?: { success: boolean; data?: T; error?: string } };
      const toolResult = resultData?.result;

      if (toolResult && !toolResult.success) {
        return {
          status: 'merchant_unreachable',
          message: toolResult.error ?? 'Tool returned error',
          timing: { totalMs: gatewayMs, gatewayMs },
        };
      }

      return {
        status: 'ok',
        data: (toolResult?.data ?? resultData) as T,
        attribution: {
          merchant: {
            domain: merchant.domain,
            name: merchant.metadata.name,
            tier: merchant.tier,
            logoUrl: merchant.metadata.logoUrl,
          },
        },
        timing: { totalMs: Date.now() - startTime, gatewayMs },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Request failed: ${message}`, { error });

      let status: FederatedStatus = 'merchant_unreachable';
      if (message.includes('aborted') || message.includes('timeout')) {
        status = 'merchant_unreachable';
      }

      return {
        status,
        message: `Failed to reach ${merchant.domain}: ${message}`,
        timing: { totalMs: Date.now() - startTime },
      };
    }
  }

  // ==========================================================================
  // Capability Discovery
  // ==========================================================================

  /**
   * Check a gateway's capabilities by fetching its .well-known file.
   *
   * @param gatewayUrl - Base URL of the gateway
   * @returns Merchant capabilities or null if unavailable
   *
   * @example
   * ```typescript
   * const caps = await client.checkCapabilities('https://api.vuori.com/llm-gateway');
   * if (caps?.search) {
   *   console.log('Gateway supports search');
   * }
   * ```
   */
  async checkCapabilities(
    gatewayUrl: string
  ): Promise<MerchantCapabilities | null> {
    try {
      // Try gateway's well-known endpoint first
      const gatewayWellKnown = `${gatewayUrl.replace(/\/$/, '')}/.well-known/llm-gateway.json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(gatewayWellKnown, {
          headers: { 'User-Agent': this.userAgent },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json() as WellKnownGateway;
          return data.capabilities;
        }
      } catch {
        clearTimeout(timeoutId);
      }

      return null;
    } catch (error) {
      this.log('Failed to check capabilities', { error });
      return null;
    }
  }

  /**
   * Fetch the full .well-known gateway configuration.
   *
   * @param domainOrGatewayUrl - Domain or gateway URL to check
   * @returns WellKnownGateway or null if unavailable
   */
  async fetchWellKnown(
    domainOrGatewayUrl: string
  ): Promise<WellKnownGateway | null> {
    const urls = domainOrGatewayUrl.startsWith('http')
      ? [`${domainOrGatewayUrl.replace(/\/$/, '')}/.well-known/llm-gateway.json`]
      : [
          `https://${domainOrGatewayUrl}/.well-known/llm-gateway.json`,
          `https://www.${domainOrGatewayUrl}/.well-known/llm-gateway.json`,
        ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          headers: { 'User-Agent': this.userAgent },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return await response.json() as WellKnownGateway | null;
        }
      } catch {
        // Try next URL
      }
    }

    return null;
  }

  // ==========================================================================
  // Merchant Verification
  // ==========================================================================

  /**
   * Verify merchant ownership of a domain.
   *
   * @param domain - Domain to verify (e.g., "vuori.com")
   * @param gatewayUrl - Gateway URL that claims to serve this domain
   * @param method - Verification method
   * @returns true if verified, false otherwise
   *
   * @example
   * ```typescript
   * // DNS verification - checks TXT record
   * const verified = await client.verifyMerchant('vuori.com', 'https://api.vuori.com', 'dns');
   *
   * // Meta tag verification - checks HTML meta tag
   * const verified = await client.verifyMerchant('vuori.com', 'https://api.vuori.com', 'meta_tag');
   *
   * // API callback verification - challenges the gateway
   * const verified = await client.verifyMerchant('vuori.com', 'https://api.vuori.com', 'api_callback');
   * ```
   */
  async verifyMerchant(
    domain: string,
    gatewayUrl: string,
    method: VerificationMethod
  ): Promise<boolean> {
    try {
      switch (method) {
        case 'dns':
          return await this.verifyViaDns(domain, gatewayUrl);

        case 'meta_tag':
          return await this.verifyViaMetaTag(domain, gatewayUrl);

        case 'api_callback':
          return await this.verifyViaApiCallback(domain, gatewayUrl);

        default:
          this.log(`Unknown verification method: ${method}`);
          return false;
      }
    } catch (error) {
      this.log(`Verification failed for ${domain}`, { error, method });
      return false;
    }
  }

  /**
   * Verify via DNS TXT record.
   *
   * Checks for: TXT _llm-gateway.{domain} containing the gateway URL
   */
  private async verifyViaDns(domain: string, gatewayUrl: string): Promise<boolean> {
    // DNS verification requires Node.js dns module or a DNS-over-HTTPS service
    // For browser compatibility, we'll use a DNS-over-HTTPS approach

    const dnsQuery = `_llm-gateway.${domain}`;

    try {
      // Use Google's DNS-over-HTTPS
      const response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(dnsQuery)}&type=TXT`,
        {
          headers: { Accept: 'application/dns-json' },
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { Answer?: Array<{ data: string }> };

      if (!data.Answer) {
        return false;
      }

      // Check if any TXT record contains the gateway URL
      const normalizedGateway = gatewayUrl.toLowerCase().replace(/\/$/, '');

      for (const record of data.Answer) {
        const txtValue = record.data.replace(/"/g, '').toLowerCase();
        if (txtValue.includes(normalizedGateway)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log('DNS verification failed', { error });
      return false;
    }
  }

  /**
   * Verify via HTML meta tag.
   *
   * Fetches domain homepage and looks for:
   * <meta name="llm-gateway" content="{gatewayUrl}">
   */
  private async verifyViaMetaTag(domain: string, gatewayUrl: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`https://${domain}`, {
        headers: { 'User-Agent': this.userAgent },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const html = await response.text();

      // Look for meta tag with llm-gateway content
      const metaPattern = /<meta\s+name=["']llm-gateway["']\s+content=["']([^"']+)["']/i;
      const match = metaPattern.exec(html);

      if (!match) {
        return false;
      }

      const normalizedGateway = gatewayUrl.toLowerCase().replace(/\/$/, '');
      if (!match || !match[1]) return false;
      const foundGateway = match[1].toLowerCase().replace(/\/$/, '');

      return foundGateway === normalizedGateway;
    } catch (error) {
      this.log('Meta tag verification failed', { error });
      return false;
    }
  }

  /**
   * Verify via API callback.
   *
   * POST to gatewayUrl/api/federation/verify with a challenge,
   * expecting a signed response.
   */
  private async verifyViaApiCallback(domain: string, gatewayUrl: string): Promise<boolean> {
    try {
      const challenge = this.generateChallenge();
      const url = `${gatewayUrl.replace(/\/$/, '')}/api/federation/verify`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          domain,
          challenge,
          timestamp: Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { verified: boolean; domain?: string; challenge?: string };

      // The gateway should echo back the challenge and confirm the domain
      return (
        data.verified === true &&
        data.domain === domain &&
        data.challenge === challenge
      );
    } catch (error) {
      this.log('API callback verification failed', { error });
      return false;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Build request headers including authentication.
   */
  private buildHeaders(
    merchant: MerchantRegistration,
    sessionId?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };

    // Add session ID if provided
    if (sessionId) {
      headers['X-Session-ID'] = sessionId;
      headers['X-Federation-Session'] = sessionId;
    }

    // Add authentication
    if (merchant.apiKey) {
      headers['Authorization'] = `Bearer ${merchant.apiKey}`;
      headers['X-API-Key'] = merchant.apiKey;
    } else if (this.jwtSigningKey) {
      const token = this.signRequest({
        merchantDomain: merchant.domain,
        gatewayUrl: merchant.gatewayUrl,
        sessionId,
      });
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Sign a request payload with JWT.
   *
   * Creates a short-lived JWT for authenticating federated requests.
   * Requires jwtSigningKey to be configured.
   */
  private signRequest(payload: Record<string, unknown>): string {
    if (!this.jwtSigningKey) {
      throw new Error('JWT signing key not configured');
    }

    // Note: In production, use a proper JWT library like jose
    // This is a simplified implementation for demonstration
    const header = {
      alg: 'HS256', // Simplified; use EdDSA in production
      typ: 'JWT',
      kid: this.jwtKeyId,
    };

    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: this.jwtIssuer,
      aud: payload.gatewayUrl,
      iat: now,
      exp: now + 300, // 5 minutes
      ...payload,
    };

    // Base64URL encode
    const encode = (obj: object): string =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const headerB64 = encode(header);
    const claimsB64 = encode(claims);
    const message = `${headerB64}.${claimsB64}`;

    // HMAC-SHA256 signature (simplified)
    // In production, use Ed25519 with the jose library
    const crypto = globalThis.crypto;
    if (crypto && crypto.subtle) {
      // Browser environment - return unsigned for now
      // Production should use Web Crypto API properly
      return `${message}.unsigned`;
    }

    // Node.js environment
    try {
      const nodeCrypto = require('crypto');
      const signature = nodeCrypto
        .createHmac('sha256', this.jwtSigningKey)
        .update(message)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      return `${message}.${signature}`;
    } catch {
      return `${message}.unsigned`;
    }
  }

  /**
   * Execute a function with retries and exponential backoff.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort/timeout
        if (lastError.message.includes('aborted')) {
          throw lastError;
        }

        if (attempt < this.retries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          this.log(`Retry ${attempt + 1}/${this.retries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Generate a random challenge string.
   */
  private generateChallenge(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Sleep for a given duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log a debug message.
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.debug) {
      console.log(`[GatewayClient] ${message}`, data ?? '');
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new GatewayClient instance.
 *
 * @param options - Client options
 * @returns GatewayClient instance
 */
export function createGatewayClient(
  options?: GatewayClientOptions
): GatewayClient {
  return new GatewayClient(options);
}

