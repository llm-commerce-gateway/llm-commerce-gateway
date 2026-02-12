/**
 * @betterdata/llm-gateway - Well-Known Federation Routes
 *
 * Adds /.well-known/llm-gateway.json endpoint to merchant gateways
 * for federation discovery and verification.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createWellKnownRoutes } from '@betterdata/llm-gateway/federation';
 *
 * const app = new Hono();
 *
 * // Add federation discovery endpoint
 * app.route('/', createWellKnownRoutes({
 *   domain: 'vuoriclothing.com',
 *   name: 'Vuori',
 *   categories: ['activewear', 'athleisure'],
 * }));
 *
 * // Now available: GET /.well-known/llm-gateway.json
 * ```
 *
 * @license MIT
 */

import { Hono } from 'hono';
import type {
  MerchantCapabilities,
  WellKnownGateway,
  VerificationMethod,
} from '../types';
import type { FederationJWK } from '../auth/jwt';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the well-known endpoint.
 */
export interface WellKnownConfig {
  /** Primary domain this gateway serves (e.g., "vuoriclothing.com") */
  domain: string;

  /** Display name for the merchant */
  name: string;

  /** Product categories */
  categories: string[];

  /** Logo URL for rich display */
  logoUrl?: string;

  /** Brand primary color (hex) */
  primaryColor?: string;

  /** Description of the merchant */
  description?: string;

  /** Override capabilities (defaults are inferred from backends) */
  capabilities?: Partial<MerchantCapabilities>;

  /** Public keys for request verification */
  publicKeys?: FederationJWK[];

  /** Supported verification methods */
  verificationMethods?: VerificationMethod[];

  /** Gateway URL override (normally inferred from request) */
  gatewayUrl?: string;

  /** Schema version (default: "1.0") */
  schemaVersion?: string;

  /** Contact information */
  contact?: {
    email?: string;
    supportUrl?: string;
  };
}

/**
 * Backend availability for capability inference.
 */
export interface BackendAvailability {
  hasProducts: boolean;
  hasCart: boolean;
  hasOrders: boolean;
  hasRecommendations: boolean;
}

/**
 * Options for the well-known route handler.
 */
export interface WellKnownRouteOptions {
  /** Well-known configuration */
  config: WellKnownConfig;

  /** Backend availability for capability inference */
  backends?: BackendAvailability;

  /** Private key for signing verification callbacks (base64 or PEM) */
  privateKey?: string;

  /** Key ID for the private key */
  keyId?: string;

  /** Cache max-age in seconds (default: 3600) */
  cacheMaxAge?: number;
}

// ============================================================================
// Well-Known Route Handler
// ============================================================================

/**
 * Create a Hono router with well-known federation endpoints.
 *
 * Endpoints:
 * - GET /.well-known/llm-gateway.json - Federation discovery
 * - POST /api/federation/verify - Verification callback
 *
 * @param options - Route options
 * @returns Hono router
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createWellKnownRoutes } from '@betterdata/llm-gateway/federation';
 *
 * const app = new Hono();
 *
 * app.route('/', createWellKnownRoutes({
 *   config: {
 *     domain: 'vuoriclothing.com',
 *     name: 'Vuori',
 *     categories: ['activewear', 'athleisure'],
 *     logoUrl: 'https://vuoriclothing.com/logo.png',
 *   },
 *   backends: {
 *     hasProducts: true,
 *     hasCart: true,
 *     hasOrders: true,
 *     hasRecommendations: true,
 *   },
 * }));
 * ```
 */
export function createWellKnownRoutes(options: WellKnownRouteOptions): Hono {
  const app = new Hono();
  const { config, backends, privateKey, keyId, cacheMaxAge = 3600 } = options;

  // ==========================================================================
  // GET /.well-known/llm-gateway.json
  // ==========================================================================

  app.get('/.well-known/llm-gateway.json', (c) => {
    // Determine gateway URL
    const gatewayUrl = config.gatewayUrl ?? inferGatewayUrl(c.req.url);

    // Build capabilities
    const capabilities: MerchantCapabilities = {
      search: config.capabilities?.search ?? backends?.hasProducts ?? true,
      cart: config.capabilities?.cart ?? backends?.hasCart ?? false,
      checkout: config.capabilities?.checkout ?? backends?.hasOrders ?? false,
      inventory: config.capabilities?.inventory ?? backends?.hasProducts ?? true,
      recommendations: config.capabilities?.recommendations ?? backends?.hasRecommendations ?? false,
    };

    // Build response
    const response: WellKnownGateway = {
      schemaVersion: config.schemaVersion ?? '1.0',
      domain: config.domain,
      gatewayUrl,
      capabilities,
      verification: {
        methods: config.verificationMethods ?? ['api_callback'],
      },
      publicKeys: config.publicKeys,
      metadata: {
        name: config.name,
        description: config.description,
        categories: config.categories,
        logoUrl: config.logoUrl,
        primaryColor: config.primaryColor,
      },
      contact: config.contact,
    };

    // Set headers
    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', `public, max-age=${cacheMaxAge}`);
    c.header('Access-Control-Allow-Origin', '*');

    return c.json(response);
  });

  // ==========================================================================
  // POST /api/federation/verify
  // ==========================================================================

  app.post('/api/federation/verify', async (c) => {
    try {
      const body = await c.req.json<{
        challenge: string;
        hubUrl?: string;
        timestamp?: number;
      }>();

      if (!body.challenge) {
        return c.json(
          { error: 'Missing challenge' },
          400
        );
      }

      // If we have a private key, sign the challenge
      let signature: string | undefined;

      if (privateKey) {
        signature = await signChallenge(body.challenge, privateKey, keyId);
      }

      // Return verification response
      return c.json({
        verified: true,
        domain: config.domain,
        challenge: body.challenge,
        signature,
        timestamp: Date.now(),
        keyId,
      });
    } catch (error) {
      return c.json(
        {
          verified: false,
          error: error instanceof Error ? error.message : 'Verification failed',
        },
        500
      );
    }
  });

  // ==========================================================================
  // OPTIONS for CORS
  // ==========================================================================

  app.options('/.well-known/llm-gateway.json', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    return c.body(null, 204);
  });

  app.options('/api/federation/verify', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return c.body(null, 204);
  });

  return app;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer the gateway URL from the request URL.
 */
function inferGatewayUrl(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://localhost:3000';
  }
}

/**
 * Sign a challenge with the private key.
 *
 * Uses HMAC-SHA256 for simplicity. In production, use Ed25519 with jose.
 */
async function signChallenge(
  challenge: string,
  privateKey: string,
  keyId?: string
): Promise<string> {
  // Create a simple signature using the challenge + timestamp
  const message = `${challenge}:${Date.now()}:${keyId ?? 'default'}`;

  // Use Web Crypto if available
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(privateKey);
    const messageData = encoder.encode(message);

    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await globalThis.crypto.subtle.sign('HMAC', key, messageData);
    const signatureArray = Array.from(new Uint8Array(signature));
    return btoa(String.fromCharCode.apply(null, signatureArray));
  }

  // Node.js fallback
  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', privateKey);
    hmac.update(message);
    return hmac.digest('base64');
  } catch {
    // No crypto available, return message hash
    return Buffer.from(message).toString('base64');
  }
}

// ============================================================================
// Gateway Integration
// ============================================================================

/**
 * Federation configuration for LLMGateway.
 */
export interface FederationConfig {
  /** Enable federation endpoints */
  enabled: boolean;

  /** Well-known configuration */
  config: WellKnownConfig;

  /** Private key for signing verification callbacks */
  privateKey?: string;

  /** Key ID for the private key */
  keyId?: string;

  /** Cache max-age in seconds */
  cacheMaxAge?: number;
}

/**
 * Add federation routes to an existing Hono app.
 *
 * @param app - Hono app to add routes to
 * @param federationConfig - Federation configuration
 * @param backends - Backend availability
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { addFederationRoutes } from '@betterdata/llm-gateway/federation';
 *
 * const app = new Hono();
 *
 * addFederationRoutes(app, {
 *   enabled: true,
 *   config: {
 *     domain: 'vuoriclothing.com',
 *     name: 'Vuori',
 *     categories: ['activewear'],
 *   },
 * });
 * ```
 */
export function addFederationRoutes(
  app: Hono,
  federationConfig: FederationConfig,
  backends?: BackendAvailability
): void {
  if (!federationConfig.enabled) {
    return;
  }

  const wellKnownRoutes = createWellKnownRoutes({
    config: federationConfig.config,
    backends,
    privateKey: federationConfig.privateKey,
    keyId: federationConfig.keyId,
    cacheMaxAge: federationConfig.cacheMaxAge,
  });

  app.route('/', wellKnownRoutes);
}

// ============================================================================
// Utility: Generate Well-Known Response
// ============================================================================

/**
 * Generate a WellKnownGateway response object.
 *
 * Useful for testing or custom implementations.
 */
export function generateWellKnownResponse(
  config: WellKnownConfig,
  backends?: BackendAvailability
): WellKnownGateway {
  const capabilities: MerchantCapabilities = {
    search: config.capabilities?.search ?? backends?.hasProducts ?? true,
    cart: config.capabilities?.cart ?? backends?.hasCart ?? false,
    checkout: config.capabilities?.checkout ?? backends?.hasOrders ?? false,
    inventory: config.capabilities?.inventory ?? backends?.hasProducts ?? true,
    recommendations: config.capabilities?.recommendations ?? backends?.hasRecommendations ?? false,
  };

  return {
    schemaVersion: config.schemaVersion ?? '1.0',
    domain: config.domain,
    gatewayUrl: config.gatewayUrl ?? `https://${config.domain}/api`,
    capabilities,
    verification: {
      methods: config.verificationMethods ?? ['api_callback'],
    },
    publicKeys: config.publicKeys,
    metadata: {
      name: config.name,
      description: config.description,
      categories: config.categories,
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor,
    },
    contact: config.contact,
  };
}

