/**
 * @betterdata/llm-gateway - Federation Hub
 *
 * The main orchestration class for the Federation Layer.
 * Combines registry, discovery, routing, and gateway client into a unified API.
 *
 * @example
 * ```typescript
 * import { FederationHub } from '@betterdata/llm-gateway/federation';
 *
 * // Create hub with all components
 * const hub = await FederationHub.create({
 *   registry: { type: 'memory' },
 *   discovery: { type: 'tag-based' },
 *   auth: { enabled: true, signingKey: '...', keyId: 'hub-1' },
 *   fallback: { suggestAlternatives: true, maxAlternatives: 5 },
 * });
 *
 * // Register merchants
 * await hub.registerMerchant({
 *   domain: 'vuoriclothing.com',
 *   aliases: ['vuori'],
 *   gatewayUrl: 'https://api.vuori.com/llm-gateway',
 *   tier: 'verified',
 *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
 *   metadata: { name: 'Vuori', categories: ['activewear'] },
 * });
 *
 * // Execute federated search
 * const result = await hub.search('shop vuori for joggers under $100');
 * ```
 *
 * @license MIT
 */

import type { MerchantRegistration, FederatedResult, DiscoveredMerchant, FederatedStatus } from './types';
import type { MerchantRegistry } from './registry/interface';
import { MemoryMerchantRegistry } from './registry/memory';
import { FileMerchantRegistry } from './registry/file';
import type { DiscoveryProvider } from './discovery/interface';
import { StaticDiscoveryProvider } from './discovery/static';
import { TagBasedDiscoveryProvider, type TagBasedDiscoveryOptions } from './discovery/tag-based';
import { GatewayClient, type GatewayClientOptions, type SearchResult } from './client/gateway-client';
import { IntentParser } from './router/intent-parser';
import { FederationJWTSigner, generateKeyPair, exportPublicKeyJWK } from './auth/jwt';
import {
  type GatewayCapabilities,
  DEFAULT_CAPABILITIES,
  hasCapabilities,
  mergeCapabilities,
} from '../capabilities';
import {
  CapabilityGate,
  createCloudCapabilityGate,
  createOSSCapabilityGate,
} from '../cloud/capability-gate';
import {
  CONTROL_PLANE_METRICS,
  emitControlPlaneMetric,
  getLogger,
} from '../observability/index';
import { VERSION } from '../version';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Registry configuration options.
 *
 * For cloud/distributed setups, pass a MerchantRegistry instance directly
 * (implement the interface with your own database backend).
 */
export type RegistryConfigOption =
  | MerchantRegistry
  | { type: 'memory'; initialMerchants?: MerchantRegistration[] }
  | { type: 'file'; filePath: string };

/**
 * Discovery configuration options.
 *
 * For ML-powered discovery, pass a DiscoveryProvider instance directly
 * (implement the interface with your own ranking service).
 */
export type DiscoveryConfigOption =
  | DiscoveryProvider
  | { type: 'static' }
  | { type: 'tag-based'; synonyms?: Record<string, string[]> };

/**
 * Authentication configuration.
 */
export interface AuthConfig {
  /** Enable JWT signing for cross-gateway requests */
  enabled: boolean;

  /** Ed25519 private key for signing (base64 or PEM) */
  signingKey?: string;

  /** Key ID for the signing key */
  keyId?: string;

  /** Issuer claim for JWTs */
  issuer?: string;

  /** Generate a new key pair if signingKey not provided */
  generateKey?: boolean;
}

/**
 * Fallback behavior configuration.
 */
export interface FallbackConfig {
  /** Suggest alternative merchants when requested one not found */
  suggestAlternatives: boolean;

  /** Maximum alternatives to suggest */
  maxAlternatives?: number;

  /** Message template for not found */
  notFoundMessage?: string;
}

/**
 * Cloud configuration for entitlement-based capability gating.
 */
export interface CloudConfig {
  /** Whether this is a Cloud deployment */
  enabled: boolean;

  /** Organization ID for entitlement checks */
  organizationId?: string;

  /**
   * Function to check if an entitlement is enabled.
   * Called for Cloud-only providers like RankedDiscovery, Analytics, etc.
   */
  checkEntitlement?: (key: string) => Promise<boolean>;
}

/**
 * Configuration options for the Federation Hub.
 */
export interface FederationHubOptions {
  /** Merchant registry configuration */
  registry: RegistryConfigOption;

  /** Discovery provider configuration */
  discovery?: DiscoveryConfigOption;

  /** Authentication configuration */
  auth?: AuthConfig;

  /** Gateway client configuration */
  client?: GatewayClientOptions;

  /** Fallback behavior configuration */
  fallback?: FallbackConfig;

  /**
   * Cloud configuration for entitlement-based capability gating.
   * If not provided, OSS mode is assumed (all checks bypassed).
   */
  cloud?: CloudConfig;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Search Options
// ============================================================================

/**
 * Options for search operations.
 */
export interface SearchOptions {
  /** Search filters */
  filters?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    inStock?: boolean;
  };

  /** Session ID for cart continuity */
  sessionId?: string;

  /** Maximum results */
  limit?: number;
}

// ============================================================================
// Federation Hub Class
// ============================================================================

/**
 * Main orchestration class for the Federation Layer.
 *
 * The Federation Hub ties together:
 * - Merchant Registry: Stores and indexes registered merchants
 * - Intent Parser: Extracts merchant + query from natural language
 * - Discovery Provider: Finds merchants by category/intent
 * - Gateway Client: Executes cross-gateway calls
 * - JWT Auth: Signs requests for trust
 *
 * @example
 * ```typescript
 * const hub = await FederationHub.create({
 *   registry: { type: 'file', filePath: './merchants.json' },
 *   discovery: { type: 'tag-based' },
 *   fallback: { suggestAlternatives: true },
 * });
 *
 * // Natural language search
 * const result = await hub.search('find running shoes at Nike');
 *
 * // Direct merchant search
 * const result = await hub.shopMerchant('nike.com', 'running shoes', { priceMax: 150 });
 *
 * // Discover merchants
 * const merchants = await hub.discoverMerchants('yoga pants');
 * ```
 */
export class FederationHub {
  private metricsLogger = getLogger('FederationMetrics');
  private registry: MerchantRegistry;
  private discovery: DiscoveryProvider;
  private client: GatewayClient;
  private parser: IntentParser;
  private _signer?: FederationJWTSigner;
  private fallbackConfig: FallbackConfig;
  private capabilityGate: CapabilityGate;
  private debug: boolean;

  // Generated key pair (if auth.generateKey is true)
  private generatedPublicKeyJWK?: object;

  /**
   * Create a new Federation Hub.
   *
   * Prefer using `FederationHub.create()` for async initialization.
   */
  constructor(
    registry: MerchantRegistry,
    discovery: DiscoveryProvider,
    client: GatewayClient,
    parser: IntentParser,
    options?: {
      signer?: FederationJWTSigner;
      fallback?: FallbackConfig;
      debug?: boolean;
      generatedPublicKeyJWK?: object;
      capabilityGate?: CapabilityGate;
    }
  ) {
    this.registry = registry;
    this.discovery = discovery;
    this.client = client;
    this.parser = parser;
    this._signer = options?.signer;
    void this._signer; // Suppress unused warning - reserved for future JWT signing
    this.capabilityGate = options?.capabilityGate ?? createOSSCapabilityGate();
    this.fallbackConfig = options?.fallback ?? {
      suggestAlternatives: true,
      maxAlternatives: 5,
    };
    this.debug = options?.debug ?? false;
    this.generatedPublicKeyJWK = options?.generatedPublicKeyJWK;
  }

  // ==========================================================================
  // Static Factory
  // ==========================================================================

  /**
   * Create a Federation Hub with async initialization.
   *
   * @param options - Hub configuration
   * @returns Initialized FederationHub
   *
   * @example
   * ```typescript
   * const hub = await FederationHub.create({
   *   registry: { type: 'memory' },
   *   discovery: { type: 'tag-based' },
   *   auth: { enabled: true, generateKey: true },
   * });
   * ```
   */
  static async create(options: FederationHubOptions): Promise<FederationHub> {
    // Initialize capability gate for entitlement checks
    const capabilityGate = options.cloud?.enabled && options.cloud.checkEntitlement
      ? createCloudCapabilityGate(
          options.cloud.organizationId || 'unknown',
          options.cloud.checkEntitlement,
          { debug: options.debug }
        )
      : createOSSCapabilityGate({ debug: options.debug });

    // Initialize registry (with capability check for cloud registries)
    const registry = await FederationHub.initializeRegistryWithGate(
      options.registry,
      capabilityGate
    );

    // Initialize discovery (with capability check for ranked discovery)
    const discovery = await FederationHub.initializeDiscoveryWithGate(
      options.discovery,
      registry,
      capabilityGate
    );

    // Initialize auth signer
    let signer: FederationJWTSigner | undefined;
    let generatedPublicKeyJWK: object | undefined;

    if (options.auth?.enabled) {
      if (options.auth.signingKey) {
        // Use provided key
        signer = new FederationJWTSigner(
          options.auth.signingKey as any,
          options.auth.keyId ?? 'federation-hub-1'
        );
      } else if (options.auth.generateKey) {
        // Generate new key pair
        const { publicKey, privateKey } = await generateKeyPair();
        const keyId = options.auth.keyId ?? `hub-${Date.now()}`;

        signer = new FederationJWTSigner(privateKey, keyId);
        generatedPublicKeyJWK = await exportPublicKeyJWK(publicKey, keyId);

        if (options.debug) {
          console.log('[FederationHub] Generated key pair with ID:', keyId);
          console.log('[FederationHub] Public key JWK:', generatedPublicKeyJWK);
        }
      }
    }

    // Initialize gateway client
    const client = new GatewayClient({
      ...options.client,
      jwtSigningKey: options.auth?.signingKey,
      jwtKeyId: options.auth?.keyId,
      jwtIssuer: options.auth?.issuer ?? 'federation-hub',
      debug: options.debug,
    });

    // Initialize intent parser
    const parser = new IntentParser({
      registry,
      strictMode: false,
      fuzzyMatching: true,
    });

    return new FederationHub(registry, discovery, client, parser, {
      signer,
      fallback: options.fallback,
      debug: options.debug,
      generatedPublicKeyJWK,
      capabilityGate,
    });
  }

  /**
   * Initialize registry with capability gate validation.
   */
  private static async initializeRegistryWithGate(
    config: RegistryConfigOption,
    gate: CapabilityGate
  ): Promise<MerchantRegistry> {
    // Check if registry is a custom implementation
    if ('registerMerchant' in config) {
      // Custom registry - check if it requires cloud capabilities
      const providerName = config.constructor?.name || 'CustomRegistry';
      if (
        providerName.includes('BetterData') ||
        providerName.includes('Cloud')
      ) {
        await gate.requireCapability('cloudRegistry', providerName);
      }
      return config as MerchantRegistry;
    }

    // Built-in registries don't require cloud capabilities
    return FederationHub.initializeRegistry(config);
  }

  /**
   * Initialize discovery with capability gate validation.
   */
  private static async initializeDiscoveryWithGate(
    config: DiscoveryConfigOption | undefined,
    registry: MerchantRegistry,
    gate: CapabilityGate
  ): Promise<DiscoveryProvider> {
    // Check if discovery is a custom implementation
    if (config && 'discoverMerchants' in config) {
      // Custom discovery - check if it requires cloud capabilities
      const providerName = config.constructor?.name || 'CustomDiscovery';
      if (
        providerName.includes('Ranked') ||
        providerName.includes('ML') ||
        providerName.includes('BetterData')
      ) {
        await gate.requireCapability('rankedDiscovery', providerName);
      }
      return config as DiscoveryProvider;
    }

    // Built-in discovery doesn't require cloud capabilities
    return FederationHub.initializeDiscovery(config, registry);
  }

  // ==========================================================================
  // Capability Operations
  // ==========================================================================

  /**
   * Check if a capability is enabled.
   *
   * @param capability - Capability key to check
   * @returns Check result with allowed status and reason
   *
   * @example
   * ```typescript
   * const result = await hub.checkCapability('rankedDiscovery');
   * if (result.allowed) {
   *   // Use ranked discovery
   * }
   * ```
   */
  async checkCapability(capability: string) {
    return this.capabilityGate.checkCapability(capability);
  }

  /**
   * Require a capability to be enabled, throwing if not.
   *
   * @param capability - Capability key to require
   * @param providerType - Provider type for error message
   * @throws CapabilityNotEnabledError if capability not enabled
   */
  async requireCapability(capability: string, providerType: string): Promise<void> {
    return this.capabilityGate.requireCapability(capability, providerType);
  }

  /**
   * Check if running in OSS mode (all capabilities allowed).
   */
  isOSSMode(): boolean {
    return this.capabilityGate.isOSSMode();
  }

  /**
   * Get the capability gate for advanced usage.
   */
  getCapabilityGate(): CapabilityGate {
    return this.capabilityGate;
  }

  // ==========================================================================
  // Registry Operations
  // ==========================================================================

  /**
   * Register a new merchant in the registry.
   *
   * @param merchant - Merchant registration data
   *
   * @example
   * ```typescript
   * await hub.registerMerchant({
   *   domain: 'nike.com',
   *   aliases: ['nike', 'nike store'],
   *   gatewayUrl: 'https://llm.nike.com/gateway',
   *   tier: 'registered',
   *   capabilities: { search: true, cart: true, checkout: true, inventory: true, recommendations: true },
   *   metadata: { name: 'Nike', categories: ['athletic', 'footwear'] },
   * });
   * ```
   */
  async registerMerchant(merchant: MerchantRegistration): Promise<void> {
    // Validate required fields
    if (!merchant.domain) {
      throw new Error('Merchant domain is required');
    }
    if (!merchant.gatewayUrl) {
      throw new Error('Merchant gatewayUrl is required');
    }
    if (!merchant.metadata?.name) {
      throw new Error('Merchant metadata.name is required');
    }

    // Set defaults
    const registration: MerchantRegistration = {
      ...merchant,
      domain: merchant.domain.toLowerCase(),
      tier: merchant.tier ?? 'registered',
      capabilities: merchant.capabilities ?? {
        search: true,
        cart: false,
        checkout: false,
        inventory: true,
        recommendations: false,
      },
      aliases: merchant.aliases ?? [],
      isActive: merchant.isActive ?? true,
    };

    await this.registry.register(registration);

    this.log(`Registered merchant: ${registration.domain}`);
  }

  /**
   * Unregister a merchant.
   *
   * @param domain - Domain to unregister
   * @returns true if merchant was found and removed
   */
  async unregisterMerchant(domain: string): Promise<boolean> {
    const result = await this.registry.unregister(domain);
    if (result) {
      this.log(`Unregistered merchant: ${domain}`);
    }
    return result;
  }

  /**
   * Get a merchant by domain.
   */
  async getMerchant(domain: string): Promise<MerchantRegistration | null> {
    return this.registry.get(domain);
  }

  /**
   * List all registered merchants.
   */
  async listMerchants(options?: {
    tier?: 'verified' | 'registered' | 'discovered';
    limit?: number;
  }): Promise<MerchantRegistration[]> {
    return this.registry.list(options);
  }

  // ==========================================================================
  // Merchant Resolution
  // ==========================================================================

  /**
   * Resolve a merchant from natural language input.
   *
   * @param input - User input (e.g., "vuori", "nike.com", "shop macy's")
   * @returns Resolved merchant or null
   *
   * @example
   * ```typescript
   * const merchant = await hub.resolveMerchant('vuori');
   * // → { domain: 'vuoriclothing.com', ... }
   *
   * const merchant = await hub.resolveMerchant('shop nike for shoes');
   * // → { domain: 'nike.com', ... }
   * ```
   */
  async resolveMerchant(input: string): Promise<MerchantRegistration | null> {
    // Try direct lookup first
    const direct = await this.registry.get(input.toLowerCase());
    if (direct) {
      return direct;
    }

    // Try alias lookup
    const byAlias = await this.registry.findByAlias(input);
    if (byAlias) {
      return byAlias;
    }

    // Try intent parsing
    const intent = await this.parser.parse(input);
    if (intent?.merchant.domain) {
      return this.registry.get(intent.merchant.domain);
    }

    return null;
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Execute a federated search from natural language input.
   *
   * Parses the input to extract merchant and query, then routes
   * to the appropriate merchant gateway.
   *
   * @param input - Natural language search (e.g., "shop vuori for joggers")
   * @param options - Search options
   * @returns Federated search result
   *
   * @example
   * ```typescript
   * const result = await hub.search('find running shoes at Nike under $150');
   *
   * if (result.status === 'ok') {
   *   for (const product of result.data.products) {
   *     console.log(`${product.name} - $${product.price.amount}`);
   *   }
   * } else if (result.status === 'merchant_not_connected') {
   *   console.log('Alternatives:', result.alternatives);
   * }
   * ```
   */
  async search(
    input: string,
    options?: SearchOptions
  ): Promise<FederatedResult<SearchResult>> {
    // Parse intent
    const intent = await this.parser.parse(input);

    if (!intent) {
      // No merchant detected
      if (this.fallbackConfig.suggestAlternatives) {
        const alternatives = await this.discoverMerchants(input, {
          limit: this.fallbackConfig.maxAlternatives,
        });

        return this.buildFallbackResult(
          'merchant_not_connected',
          "I couldn't determine which store you want to search. Here are some options:",
          { alternatives }
        );
      }

      return this.buildFallbackResult(
        'merchant_not_connected',
        'Please specify a store or brand to search.'
      );
    }

    // Resolve merchant
    const merchant = await this.registry.get(intent.merchant.domain);

    if (!merchant) {
      // Merchant not registered
      if (this.fallbackConfig.suggestAlternatives) {
        const alternatives = await this.discovery.suggestAlternatives(
          intent.merchant.matchedValue,
          {
            query: intent.query,
            limit: this.fallbackConfig.maxAlternatives,
          }
        );

        return this.buildFallbackResult(
          'merchant_not_connected',
          `I don't have access to "${intent.merchant.matchedValue}" yet. ${
            alternatives.length > 0 ? 'Here are some similar stores:' : ''
          }`,
          { alternatives }
        );
      }

      return this.buildFallbackResult(
        'merchant_not_connected',
        `"${intent.merchant.matchedValue}" is not a connected store.`
      );
    }

    // Merge filters from intent with options
    const mergedFilters = {
      ...intent.filters,
      ...options?.filters,
    };

    // Execute search
    emitControlPlaneMetric(this.metricsLogger, CONTROL_PLANE_METRICS.federation.fanoutDepth, 1);
    return this.client.executeSearch(merchant, intent.query, {
      filters: mergedFilters,
      sessionId: options?.sessionId,
      limit: options?.limit,
    });
  }

  /**
   * Execute a direct merchant search without intent parsing.
   *
   * @param merchantRef - Merchant domain or alias
   * @param query - Product search query
   * @param options - Search options
   * @returns Federated search result
   *
   * @example
   * ```typescript
   * const result = await hub.shopMerchant('nike.com', 'running shoes', {
   *   filters: { priceMax: 150 },
   *   limit: 20,
   * });
   * ```
   */
  async shopMerchant(
    merchantRef: string,
    query: string,
    options?: SearchOptions
  ): Promise<FederatedResult<SearchResult>> {
    // Resolve merchant
    const merchant = await this.resolveMerchant(merchantRef);

    if (!merchant) {
      if (this.fallbackConfig.suggestAlternatives) {
        const alternatives = await this.discovery.suggestAlternatives(
          merchantRef,
          {
            query,
            limit: this.fallbackConfig.maxAlternatives,
          }
        );

        return this.buildFallbackResult(
          'merchant_not_connected',
          `I don't have access to "${merchantRef}" yet.`,
          { alternatives }
        );
      }

      return this.buildFallbackResult(
        'merchant_not_connected',
        `"${merchantRef}" is not a connected store.`
      );
    }

    // Check capabilities
    if (!merchant.capabilities.search) {
      return this.buildFallbackResult(
        'capability_not_supported',
        `${merchant.metadata.name} doesn't support product search.`
      );
    }

    // Execute search
    return this.client.executeSearch(merchant, query, {
      filters: options?.filters,
      sessionId: options?.sessionId,
      limit: options?.limit,
    });
  }

  // ==========================================================================
  // Discovery Operations
  // ==========================================================================

  /**
   * Discover merchants matching a query.
   *
   * @param query - Search query or category
   * @param options - Discovery options
   * @returns List of relevant merchants
   *
   * @example
   * ```typescript
   * const merchants = await hub.discoverMerchants('running shoes', {
   *   category: 'athletic',
   *   limit: 10,
   * });
   *
   * for (const m of merchants) {
   *   console.log(`${m.name} (${m.relevanceScore})`);
   * }
   * ```
   */
  async discoverMerchants(
    query: string,
    options?: {
      category?: string;
      limit?: number;
      tier?: 'verified' | 'registered' | 'discovered';
    }
  ): Promise<DiscoveredMerchant[]> {
    return this.discovery.discoverByIntent(query, {
      categories: options?.category ? [options.category] : undefined,
      limit: options?.limit,
      tier: options?.tier,
    });
  }

  // ==========================================================================
  // Verification Operations
  // ==========================================================================

  /**
   * Verify a merchant's domain ownership.
   *
   * @param domain - Domain to verify
   * @param method - Verification method (default: "api_callback")
   * @returns true if verified successfully
   *
   * @example
   * ```typescript
   * const verified = await hub.verifyMerchant('vuoriclothing.com');
   * if (verified) {
   *   console.log('Merchant verified!');
   * }
   * ```
   */
  async verifyMerchant(
    domain: string,
    method: 'dns' | 'meta_tag' | 'api_callback' = 'api_callback'
  ): Promise<boolean> {
    const merchant = await this.registry.get(domain);

    if (!merchant) {
      this.log(`Cannot verify unknown merchant: ${domain}`);
      return false;
    }

    const verified = await this.client.verifyMerchant(
      domain,
      merchant.gatewayUrl,
      method
    );

    if (verified) {
      // Update tier to verified
      await this.registry.updateTier(domain, 'verified');
      this.log(`Merchant verified: ${domain}`);
    }

    return verified;
  }

  /**
   * Discover a merchant's capabilities from their .well-known file.
   *
   * @param gatewayUrl - Gateway URL to check
   * @returns Discovered capabilities or null
   */
  async discoverCapabilities(gatewayUrl: string) {
    return this.client.checkCapabilities(gatewayUrl);
  }

  // ==========================================================================
  // Tool Execution
  // ==========================================================================

  /**
   * Execute any tool on a merchant gateway.
   *
   * @param merchantRef - Merchant domain or alias
   * @param tool - Tool name
   * @param args - Tool arguments
   * @param sessionId - Optional session ID
   * @returns Tool execution result
   */
  async executeToolOnMerchant<T = unknown>(
    merchantRef: string,
    tool: string,
    args: Record<string, unknown>,
    sessionId?: string
  ): Promise<FederatedResult<T>> {
    const merchant = await this.resolveMerchant(merchantRef);

    if (!merchant) {
      return this.buildFallbackResult(
        'merchant_not_connected',
        `Merchant "${merchantRef}" not found.`
      );
    }

    return this.client.executeToolCall<T>(merchant, tool, args, sessionId);
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /**
   * Get the merchant registry.
   */
  getRegistry(): MerchantRegistry {
    return this.registry;
  }

  /**
   * Get the discovery provider.
   */
  getDiscovery(): DiscoveryProvider {
    return this.discovery;
  }

  /**
   * Get the gateway client.
   */
  getClient(): GatewayClient {
    return this.client;
  }

  /**
   * Get the intent parser.
   */
  getParser(): IntentParser {
    return this.parser;
  }

  /**
   * Get the generated public key JWK (if auth.generateKey was true).
   */
  getPublicKeyJWK(): object | undefined {
    return this.generatedPublicKeyJWK;
  }

  // ==========================================================================
  // Capability Discovery
  // ==========================================================================

  /**
   * Get the combined capabilities of this federation hub.
   *
   * This method aggregates capabilities from all underlying providers
   * (registry, discovery, analytics) and returns the intersection.
   *
   * Use this to determine what features are available before attempting
   * operations that may not be supported.
   *
   * @returns Promise resolving to the hub's capabilities
   *
   * @example
   * ```typescript
   * const caps = await hub.getCapabilities();
   *
   * if (!caps.features.discovery.rankedResults) {
   *   console.warn('Ranked results not available, using default sort');
   * }
   *
   * if (!caps.features.verification.manualReview) {
   *   console.log('Manual verification requires Better Data Cloud');
   * }
   * ```
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    const capabilities: GatewayCapabilities[] = [];

    // Collect capabilities from registry
    if (hasCapabilities(this.registry)) {
      try {
        capabilities.push(await this.registry.getCapabilities());
      } catch (error) {
        this.log('Failed to get registry capabilities', { error });
      }
    }

    // Collect capabilities from discovery provider
    if (hasCapabilities(this.discovery)) {
      try {
        capabilities.push(await this.discovery.getCapabilities());
      } catch (error) {
        this.log('Failed to get discovery capabilities', { error });
      }
    }

    // If we got capabilities from providers, merge them
    if (capabilities.length > 0) {
      const merged = mergeCapabilities(capabilities);
      // Override version with actual gateway version
      merged.gatewayVersion = VERSION;
      return merged;
    }

    // Return defaults with actual version
    return {
      ...DEFAULT_CAPABILITIES,
      gatewayVersion: VERSION,
    };
  }

  /**
   * Cache for capabilities (to avoid repeated async calls).
   * Populated on first call to getCapabilities() if caching is enabled.
   */
  private cachedCapabilities?: GatewayCapabilities;

  /**
   * Get capabilities with caching.
   *
   * Use this for performance when capabilities are checked frequently.
   * The cache is cleared when providers are updated.
   *
   * @returns Promise resolving to cached capabilities
   */
  async getCachedCapabilities(): Promise<GatewayCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    this.cachedCapabilities = await this.getCapabilities();
    return this.cachedCapabilities;
  }

  /**
   * Clear the capabilities cache.
   *
   * Call this if you update providers and need fresh capabilities.
   */
  clearCapabilitiesCache(): void {
    this.cachedCapabilities = undefined;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Initialize registry from config.
   */
  private static initializeRegistry(config: RegistryConfigOption): MerchantRegistry {
    // If it's already a registry, return it
    if (typeof config === 'object' && 'get' in config && 'register' in config) {
      return config as MerchantRegistry;
    }

    const typedConfig = config as { type: string; [key: string]: unknown };

    switch (typedConfig.type) {
      case 'memory':
        return new MemoryMerchantRegistry(
          typedConfig.initialMerchants as MerchantRegistration[] | undefined
        );

      case 'file':
        return new FileMerchantRegistry(typedConfig.filePath as string);

      default:
        throw new Error(
          `Unknown registry type: ${typedConfig.type}. ` +
          `For cloud/distributed setups, pass a MerchantRegistry instance directly.`
        );
    }
  }

  /**
   * Initialize discovery provider from config.
   */
  private static initializeDiscovery(
    config: DiscoveryConfigOption | undefined,
    registry: MerchantRegistry
  ): DiscoveryProvider {
    // Default to tag-based
    if (!config) {
      return new TagBasedDiscoveryProvider(registry);
    }

    // If it's already a provider, return it
    if (
      typeof config === 'object' &&
      'discoverByIntent' in config &&
      'suggestAlternatives' in config
    ) {
      return config as DiscoveryProvider;
    }

    const typedConfig = config as { type: string; [key: string]: unknown };

    switch (typedConfig.type) {
      case 'static':
        return new StaticDiscoveryProvider(registry);

      case 'tag-based':
        return new TagBasedDiscoveryProvider(registry, {
          synonyms: typedConfig.synonyms as Record<string, string[]> | undefined,
        } as TagBasedDiscoveryOptions);

      default:
        throw new Error(
          `Unknown discovery type: ${typedConfig.type}. ` +
          `For ML-powered discovery, pass a DiscoveryProvider instance directly.`
        );
    }
  }

  /**
   * Build a fallback result for error cases.
   */
  private buildFallbackResult<T>(
    status: FederatedStatus,
    message: string,
    context?: { alternatives?: DiscoveredMerchant[] }
  ): FederatedResult<T> {
    return {
      status,
      message,
      alternatives: context?.alternatives,
    };
  }

  /**
   * Log a debug message.
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.debug) {
      console.log(`[FederationHub] ${message}`, data ?? '');
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Federation Hub with minimal configuration.
 *
 * @param options - Hub options
 * @returns Initialized FederationHub
 */
export async function createFederationHub(
  options: FederationHubOptions
): Promise<FederationHub> {
  return FederationHub.create(options);
}

