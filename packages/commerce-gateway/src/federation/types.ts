/**
 * @betterdata/commerce-gateway - Federation Types & Interfaces
 *
 * Core type definitions for the Federation Hub that routes shopping intent
 * to merchant-specific gateway instances.
 *
 * ## Security Model
 *
 * Federation uses JWT-based authentication for cross-gateway trust:
 *
 * 1. **Hub-to-Merchant**: Hub signs requests with Ed25519 private key.
 *    Merchants verify using hub's public key (from trustedIssuers).
 *
 * 2. **Token Security**:
 *    - Short expiration (5 minutes default)
 *    - Audience validation (prevents token reuse)
 *    - Issuer allowlist (prevents rogue hub attacks)
 *    - Clock skew tolerance (30 seconds default)
 *
 * 3. **Key Management**:
 *    - Generate keys offline using dev utilities
 *    - Store private keys in secure key management
 *    - Share public keys (JWKs) with federation partners
 *    - Rotate keys using key ID (kid) versioning
 *
 * 4. **Merchant Verification**:
 *    - DNS TXT records
 *    - Meta tag in page head
 *    - API callback challenge-response
 *
 * See `@betterdata/commerce-gateway/federation/auth` for implementation details.
 *
 * @example
 * ```typescript
 * import type { MerchantRegistration, FederatedResult } from '@betterdata/commerce-gateway/federation';
 *
 * const merchant: MerchantRegistration = {
 *   domain: 'vuoriclothing.com',
 *   aliases: ['vuori', 'vuori clothing'],
 *   gatewayUrl: 'https://api.vuori.com/llm-gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Vuori', categories: ['activewear', 'athleisure'] },
 * };
 * ```
 *
 * @license Apache-2.0
 */

// ============================================================================
// Merchant Tier
// ============================================================================

/**
 * Trust level for a registered merchant.
 *
 * - `verified`: Curated merchant with validated ownership and SLA. Featured in discovery.
 * - `registered`: Self-service signup, functional but not manually verified.
 * - `discovered`: Found via `.well-known/llm-gateway.json` with ownership validation.
 */
export type MerchantTier = 'verified' | 'registered' | 'discovered';

// ============================================================================
// Merchant Capabilities
// ============================================================================

/**
 * Declares which tools/features a merchant's gateway supports.
 *
 * The federation hub uses this to:
 * - Route only to gateways that support the requested action
 * - Inform the LLM about available capabilities
 * - Gracefully degrade when a capability is missing
 */
export interface MerchantCapabilities {
  /** Product search support (search_products tool) */
  search: boolean;

  /** Shopping cart support (add_to_cart, get_cart tools) */
  cart: boolean;

  /** Full checkout support (create_order tool) */
  checkout: boolean;

  /** Real-time inventory checking (check_inventory tool) */
  inventory: boolean;

  /** Product recommendations (get_recommendations tool) */
  recommendations: boolean;
}

// ============================================================================
// JSON Web Key (JWK) for Public Key Distribution
// ============================================================================

/**
 * JSON Web Key for verifying signed requests from the federation hub.
 *
 * Merchants publish their public keys so the federation hub can verify
 * responses, and the hub publishes keys so merchants can verify requests.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
export interface JWK {
  /** Key ID - unique identifier for key rotation */
  kid: string;

  /** Algorithm (e.g., "EdDSA", "RS256", "ES256") */
  alg: string;

  /** Key type (e.g., "OKP" for Ed25519, "RSA", "EC") */
  kty: string;

  /** Curve for EC/OKP keys (e.g., "Ed25519", "P-256") */
  crv?: string;

  /** X coordinate for EC/OKP keys (base64url encoded) */
  x?: string;

  /** Y coordinate for EC keys (base64url encoded) */
  y?: string;

  /** RSA modulus (base64url encoded) */
  n?: string;

  /** RSA exponent (base64url encoded) */
  e?: string;
}

// ============================================================================
// Merchant Verification
// ============================================================================

/**
 * Supported methods for verifying merchant domain ownership.
 *
 * - `dns`: TXT record at `_llm-gateway.{domain}` containing verification token
 * - `meta_tag`: HTML meta tag on domain homepage
 * - `api_callback`: Webhook callback to merchant-provided URL
 */
export type VerificationMethod = 'dns' | 'meta_tag' | 'api_callback';

/**
 * Verification status for a merchant registration.
 */
export interface MerchantVerification {
  /** Which verification methods this merchant supports/completed */
  methods: VerificationMethod[];

  /** When verification was last confirmed */
  verifiedAt?: Date;

  /** When verification expires (requires re-verification) */
  expiresAt?: Date;

  /** Verification token (used during verification flow) */
  token?: string;
}

// ============================================================================
// Merchant Registration
// ============================================================================

/**
 * Complete merchant registration in the federation registry.
 *
 * This is the primary data structure for a connected merchant.
 * It includes routing information, capabilities, trust level, and metadata.
 *
 * @example
 * ```typescript
 * const merchant: MerchantRegistration = {
 *   domain: 'nike.com',
 *   aliases: ['nike', 'nike store', 'just do it'],
 *   gatewayUrl: 'https://llm.nike.com/gateway',
 *   tier: 'verified',
 *   capabilities: {
 *     search: true,
 *     cart: true,
 *     checkout: true,
 *     inventory: true,
 *     recommendations: true,
 *   },
 *   metadata: {
 *     name: 'Nike',
 *     description: 'Just Do It. World leader in athletic footwear and apparel.',
 *     categories: ['athletic', 'footwear', 'apparel', 'running'],
 *     logoUrl: 'https://nike.com/logo.svg',
 *   },
 * };
 * ```
 */
export interface MerchantRegistration {
  /** Primary domain (e.g., "vuoriclothing.com") - used as unique identifier */
  domain: string;

  /** Alternative identifiers for intent matching (brand names, common misspellings) */
  aliases: string[];

  /** Full URL to the merchant's LLM Gateway endpoint */
  gatewayUrl: string;

  /** API key for authenticating cross-gateway calls (legacy/fallback) */
  apiKey?: string;

  /** Trust level for this merchant */
  tier: MerchantTier;

  /** Which tools/features this gateway supports */
  capabilities: MerchantCapabilities;

  /** Merchant display information for LLM responses and UI */
  metadata: {
    /** Display name (e.g., "Vuori") */
    name: string;

    /** Brief description for discovery context */
    description?: string;

    /** Product categories for intent-based discovery */
    categories: string[];

    /** Logo URL for rich responses */
    logoUrl?: string;

    /** Brand primary color (hex) for UI theming */
    primaryColor?: string;
  };

  /** Public keys for JWT verification (federation hub verifies merchant responses) */
  publicKeys?: JWK[];

  /** Domain ownership verification status */
  verification?: MerchantVerification;

  /** When this registration was created */
  createdAt?: Date;

  /** When this registration was last updated */
  updatedAt?: Date;

  /** Whether this merchant is currently active */
  isActive?: boolean;
}

// ============================================================================
// Federated Operation Status
// ============================================================================

/**
 * Status codes for federated operations.
 *
 * Used in `FederatedResult` to indicate the outcome of a cross-gateway call.
 */
export type FederatedStatus =
  /** Operation succeeded */
  | 'ok'
  /** Merchant domain not found in registry */
  | 'merchant_not_connected'
  /** Merchant registered but not verified (tier check failed) */
  | 'merchant_not_verified'
  /** Merchant gateway did not respond or returned error */
  | 'merchant_unreachable'
  /** Merchant doesn't support the requested capability */
  | 'capability_not_supported'
  /** Authentication with merchant gateway failed */
  | 'auth_failed'
  /** Rate limit exceeded for merchant */
  | 'rate_limited';

// ============================================================================
// Federated Result
// ============================================================================

/**
 * Standard result wrapper for all federated operations.
 *
 * Provides consistent error handling, attribution, and fallback suggestions
 * across all federation hub responses.
 *
 * @typeParam T - The data type returned on success
 *
 * @example
 * ```typescript
 * // Success case
 * const result: FederatedResult<ProductSearchResult> = {
 *   status: 'ok',
 *   data: { products: [...], total: 42, hasMore: true },
 *   attribution: {
 *     merchant: { domain: 'vuori.com', name: 'Vuori', tier: 'verified' },
 *   },
 * };
 *
 * // Failure with alternatives
 * const result: FederatedResult<never> = {
 *   status: 'merchant_not_connected',
 *   message: "I don't have access to randomstore.com's catalog.",
 *   alternatives: [
 *     { domain: 'vuori.com', name: 'Vuori', categories: ['activewear'], tier: 'verified' },
 *   ],
 * };
 * ```
 */
export interface FederatedResult<T> {
  /** Operation status code */
  status: FederatedStatus;

  /** Result data (present when status is 'ok') */
  data?: T;

  /** Human-readable message (especially for errors) */
  message?: string;

  /** Alternative merchants when the requested one isn't available */
  alternatives?: DiscoveredMerchant[];

  /** Source attribution for successful results */
  attribution?: {
    merchant: {
      domain: string;
      name: string;
      tier: MerchantTier;
      logoUrl?: string;
    };
  };

  /** Request timing information */
  timing?: {
    /** Total request duration in milliseconds */
    totalMs: number;
    /** Time spent on merchant gateway call */
    gatewayMs?: number;
  };
}

// ============================================================================
// Discovered Merchant
// ============================================================================

/**
 * Simplified merchant info returned from discovery operations.
 *
 * Used when suggesting alternatives or listing merchants by category.
 * Contains only the information needed for display and selection.
 */
export interface DiscoveredMerchant {
  /** Primary domain */
  domain: string;

  /** Display name */
  name: string;

  /** Product categories */
  categories: string[];

  /** Trust tier */
  tier: MerchantTier;

  /** Relevance score for ranked results (0-1) */
  relevanceScore?: number;

  /** Why this merchant was suggested */
  matchReason?: string;

  /** Logo URL for rich display */
  logoUrl?: string;

  /** Which capabilities are available */
  capabilities?: MerchantCapabilities;
}

// ============================================================================
// Well-Known Gateway Discovery
// ============================================================================

/**
 * Schema for `/.well-known/llm-gateway.json` file.
 *
 * Merchants can publish this file on their domain to enable automatic
 * discovery by the federation hub. This follows the well-known URI pattern
 * used by other web standards (robots.txt, security.txt, etc.).
 *
 * @example
 * ```json
 * // https://vuoriclothing.com/.well-known/llm-gateway.json
 * {
 *   "schemaVersion": "1.0",
 *   "domain": "vuoriclothing.com",
 *   "gatewayUrl": "https://api.vuori.com/llm-gateway",
 *   "capabilities": {
 *     "search": true,
 *     "cart": true,
 *     "checkout": true,
 *     "inventory": true,
 *     "recommendations": true
 *   },
 *   "verification": {
 *     "methods": ["dns", "api_callback"]
 *   },
 *   "metadata": {
 *     "name": "Vuori",
 *     "categories": ["activewear", "athleisure", "yoga"],
 *     "logoUrl": "https://vuoriclothing.com/logo.svg"
 *   }
 * }
 * ```
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8615
 */
export interface WellKnownGateway {
  /** Schema version for forward compatibility */
  schemaVersion: string;

  /** Domain this gateway serves (must match the domain hosting the file) */
  domain: string;

  /** Full URL to the LLM Gateway endpoint */
  gatewayUrl: string;

  /** Which tools/features this gateway supports */
  capabilities: MerchantCapabilities;

  /** Supported verification methods for domain ownership */
  verification: {
    methods: VerificationMethod[];
    /** Optional: Pre-shared verification token */
    token?: string;
  };

  /** Optional: Public keys for request/response verification */
  publicKeys?: JWK[];

  /** Merchant display information */
  metadata: {
    name: string;
    description?: string;
    categories: string[];
    logoUrl?: string;
    primaryColor?: string;
  };

  /** Optional: Contact information for federation issues */
  contact?: {
    email?: string;
    supportUrl?: string;
  };
}

// ============================================================================
// Federation Hub Configuration
// ============================================================================

/**
 * Configuration for the Federation Hub.
 */
export interface FederationHubConfig {
  /** How the hub authenticates to merchant gateways */
  auth: {
    /** JWT issuer URL (this hub's identity) */
    issuer: string;

    /** Private key for signing JWTs (Ed25519 recommended) */
    privateKey: string;

    /** Key ID for the private key */
    keyId: string;

    /** JWT expiration time (default: "5m") */
    tokenExpiry?: string;
  };

  /** Registry storage configuration */
  registry: {
    /** Storage type */
    type: 'memory' | 'redis' | 'postgres';

    /** Redis URL (if type is 'redis') */
    redisUrl?: string;

    /** Postgres connection string (if type is 'postgres') */
    postgresUrl?: string;
  };

  /** Discovery configuration */
  discovery: {
    /** Enable automatic discovery via .well-known */
    enableWellKnown?: boolean;

    /** Cache TTL for discovered merchants (seconds) */
    cacheTtlSeconds?: number;

    /** Maximum merchants to return in discovery queries */
    maxDiscoveryResults?: number;
  };

  /** Fallback configuration */
  fallback: {
    /** Ordered list of fallback strategies */
    strategies: FallbackStrategy[];

    /** Maximum alternatives to suggest */
    maxAlternatives?: number;

    /** Enable web search as last resort */
    enableWebSearch?: boolean;
  };

  /** Timeout for cross-gateway calls (milliseconds) */
  gatewayTimeoutMs?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Fallback strategy when a merchant isn't available.
 */
export type FallbackStrategy =
  /** Explain the issue and stop */
  | 'fail_gracefully'
  /** Suggest similar connected stores */
  | 'suggest_alternatives'
  /** Offer to do a web search (no cart/inventory) */
  | 'offer_web_search'
  /** Log interest for sales/onboarding follow-up */
  | 'request_onboarding';

// ============================================================================
// Intent Parsing Types
// ============================================================================

/**
 * Parsed shopping intent from user input.
 *
 * The intent router extracts merchant and query from natural language.
 *
 * @example
 * ```typescript
 * // Input: "shop vuori for joggers under $100"
 * const intent: ParsedIntent = {
 *   merchant: 'vuoriclothing.com',
 *   merchantRaw: 'vuori',
 *   query: 'joggers',
 *   filters: { priceMax: 100 },
 *   confidence: 0.95,
 * };
 * ```
 */
export interface ParsedIntent {
  /** Resolved merchant domain (or null if not found) */
  merchant: string | null;

  /** Raw merchant string from user input */
  merchantRaw: string;

  /** Product search query */
  query: string;

  /** Extracted filters */
  filters?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    inStock?: boolean;
  };

  /** Confidence score (0-1) */
  confidence: number;
}

// ============================================================================
// Cross-Gateway Request/Response Types
// ============================================================================

/**
 * Request payload for federated tool execution.
 */
export interface FederatedToolRequest {
  /** Tool to execute on the merchant gateway */
  toolName: string;

  /** Tool input arguments */
  input: Record<string, unknown>;

  /** Session ID for cart continuity */
  sessionId?: string;

  /** User ID if authenticated */
  userId?: string;

  /** Request tracing ID */
  traceId?: string;
}

/**
 * Response from a federated tool execution.
 */
export interface FederatedToolResponse<T = unknown> {
  /** Whether the tool execution succeeded */
  success: boolean;

  /** Result data on success */
  data?: T;

  /** Error message on failure */
  error?: string;

  /** Error code for programmatic handling */
  errorCode?: string;
}

// ============================================================================
// Registry & Discovery Provider Interfaces
// ============================================================================

/**
 * Simplified merchant info for registry operations.
 */
export interface MerchantInfo {
  /** Primary domain */
  domain: string;
  /** Display name */
  name: string;
  /** Gateway URL */
  gatewayUrl: string;
  /** Trust tier */
  tier: MerchantTier;
  /** Product categories */
  categories: string[];
  /** Logo URL */
  logoUrl?: string;
  /** Capabilities */
  capabilities: MerchantCapabilities;
}

/**
 * Interface for merchant registry implementations.
 */
export interface MerchantRegistry {
  /** Register a new merchant */
  register(merchant: {
    domain: string;
    gatewayUrl: string;
    name: string;
    description?: string;
    categories?: string[];
    capabilities?: MerchantCapabilities;
  }): Promise<MerchantInfo>;
  /** Unregister a merchant */
  unregister?(domain: string): Promise<void>;
  /** Get merchant by domain */
  get(domain: string): Promise<MerchantInfo | null>;
  /** List all merchants */
  list(options?: {
    tier?: MerchantTier;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MerchantInfo[]>;
  /** Find merchants by alias */
  findByAlias(alias: string): Promise<MerchantInfo | null>;
  /** Find merchants by category */
  findByCategory(category: string, limit?: number): Promise<MerchantInfo[]>;
  /** Update merchant tier */
  updateTier?(domain: string, tier: MerchantTier): Promise<void>;
  /** Update merchant capabilities */
  updateCapabilities?(domain: string, capabilities: MerchantCapabilities): Promise<void>;
}

/**
 * Interface for merchant discovery providers.
 */
export interface DiscoveryProvider {
  /** Discover merchants matching a query intent */
  discoverByIntent?(
    query: string,
    categories?: string[],
    options?: { limit?: number; tiers?: MerchantTier[] }
  ): Promise<DiscoveredMerchant[]>;
  /** Suggest alternatives when a merchant is unavailable */
  suggestAlternatives?(
    failedDomain: string,
    context?: { query?: string; category?: string }
  ): Promise<DiscoveredMerchant[]>;
  /** Search merchants by text query */
  search(searchTerm: string, limit?: number): Promise<DiscoveredMerchant[]>;
  /** Get top merchants in a category */
  getTopMerchants?(category?: string, limit?: number): Promise<DiscoveredMerchant[]>;
  /** Get recommended merchants */
  getRecommendations?(context: {
    recentCategories?: string[];
    recentMerchants?: string[];
    limit?: number;
  }): Promise<DiscoveredMerchant[]>;
}

/**
 * Interface for analytics sink implementations.
 */
export interface AnalyticsSink {
  /** Track a search event */
  trackSearch?(event: {
    merchantId: string;
    merchantDomain?: string;
    query: string;
    success: boolean;
    latencyMs: number;
    resultCount?: number;
    errorType?: string;
    errorMessage?: string;
    timestamp?: string;
  }): void;
  /** Track a resolution event */
  trackResolution?(event: {
    input: string;
    resolvedMerchantId?: string;
    resolvedDomain?: string;
    method: 'domain' | 'alias' | 'discovery' | 'not_found';
    latencyMs: number;
    timestamp?: string;
  }): void;
  /** Track a gateway health event */
  trackHealth?(event: {
    merchantId: string;
    gatewayUrl: string;
    success: boolean;
    latencyMs: number;
    error?: string;
    timestamp?: string;
  }): void;
  /** Flush any pending events */
  flush(): Promise<void>;
  /** Stop the analytics sink */
  stop?(): Promise<void>;
  /** Get buffer size for monitoring */
  getBufferSize?(): number;
}

/**
 * Analytics event for federation tracking.
 */
export interface AnalyticsEvent {
  /** Event name */
  name: string;
  /** Event properties */
  properties: Record<string, unknown>;
  /** Timestamp */
  timestamp?: Date;
  /** Merchant domain */
  merchantDomain?: string;
  /** Session ID */
  sessionId?: string;
}

// All types are exported inline at their definition sites above.
