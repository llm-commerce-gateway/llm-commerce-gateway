/**
 * @betterdata/commerce-gateway - Auth Types
 * 
 * Type definitions for authentication and authorization.
 * 
 * @license MIT
 */

// ============================================================================
// Core Auth Types
// ============================================================================

/**
 * Authenticated user context
 */
export interface AuthUser {
  /** User ID */
  id: string;
  
  /** Email (if available) */
  email?: string;
  
  /** Display name */
  name?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Roles */
  roles?: string[];
  
  /** Custom claims */
  claims?: Record<string, unknown>;
  
  /** Auth method used */
  authMethod: 'apiKey' | 'oauth' | 'jwt' | 'custom';
  
  /** Is anonymous */
  anonymous: boolean;
}

/**
 * Auth context attached to requests
 */
export interface AuthContext {
  /** Authenticated user (null if anonymous) */
  user: AuthUser | null;
  
  /** Session ID */
  sessionId?: string;
  
  /** Is authenticated */
  authenticated: boolean;
  
  /** Rate limit tier */
  rateLimitTier: 'anonymous' | 'authenticated' | 'premium' | 'unlimited';
  
  /** API key ID (if API key auth) */
  apiKeyId?: string;
  
  /** OAuth provider (if OAuth auth) */
  oauthProvider?: string;
}

// ============================================================================
// Auth Strategy Types
// ============================================================================

/**
 * API Key strategy configuration
 */
export interface ApiKeyConfig {
  /** Valid API keys */
  keys: string[];
  
  /** Header name (default: x-api-key) */
  headerName?: string;
  
  /** Query param name (alternative) */
  queryParam?: string;
  
  /** Enable Bearer token format */
  allowBearer?: boolean;
  
  /** Key prefix to strip */
  prefix?: string;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  /** OAuth client ID */
  clientId: string;
  
  /** OAuth client secret */
  clientSecret: string;
  
  /** Authorization URL */
  authorizationUrl?: string;
  
  /** Token URL */
  tokenUrl?: string;
  
  /** User info URL */
  userInfoUrl?: string;
  
  /** Scopes */
  scopes?: string[];
  
  /** Callback URL */
  callbackUrl?: string;
}

/**
 * OAuth strategies configuration
 */
export interface OAuthConfig {
  /** Google OAuth */
  google?: OAuthProviderConfig;
  
  /** GitHub OAuth */
  github?: OAuthProviderConfig;
  
  /** Custom OAuth providers */
  custom?: Record<string, OAuthProviderConfig>;
}

/**
 * JWT configuration
 */
export interface JWTConfig {
  /** JWT secret or public key */
  secret: string;
  
  /** Algorithm (default: HS256) */
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  
  /** Issuer */
  issuer?: string;
  
  /** Audience */
  audience?: string;
  
  /** Token expiry in seconds */
  expiresIn?: number;
}

/**
 * Custom auth strategy
 */
export interface CustomAuthStrategy {
  /** Strategy name */
  name: string;
  
  /** Validate function */
  validate: (
    request: AuthRequest,
    context: AuthStrategyContext
  ) => Promise<AuthUser | null>;
}

/**
 * Auth request (simplified HTTP request)
 */
export interface AuthRequest {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: unknown;
  method?: string;
  url?: string;
}

/**
 * Auth strategy context
 */
export interface AuthStrategyContext {
  /** Rate limiter */
  rateLimiter?: RateLimiter;
  
  /** Session manager */
  sessionManager?: unknown;
  
  /** Custom context */
  custom?: Record<string, unknown>;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per window */
  requests: number;
  
  /** Window size in seconds */
  window: number;
}

/**
 * Rate limits by tier
 */
export interface RateLimitsConfig {
  /** Anonymous users */
  anonymous: RateLimitConfig;
  
  /** Authenticated users */
  authenticated: RateLimitConfig;
  
  /** Premium users */
  premium?: RateLimitConfig;
  
  /** Per-tool rate limits */
  tools?: Record<string, RateLimitConfig>;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Is allowed */
  allowed: boolean;
  
  /** Remaining requests */
  remaining: number;
  
  /** Seconds until reset */
  resetIn: number;
  
  /** Total limit */
  limit: number;
  
  /** Retry after header value (if blocked) */
  retryAfter?: number;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /** Check and consume rate limit */
  check(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult>;
  
  /** Get current usage without consuming */
  peek(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult>;
  
  /** Reset rate limit for a key */
  reset(key: string): Promise<void>;
}

// ============================================================================
// Auth Module Configuration
// ============================================================================

/**
 * Full auth module configuration
 */
export interface AuthConfig {
  /** Auth strategies */
  strategies: {
    /** API key authentication */
    apiKey?: ApiKeyConfig;
    
    /** OAuth authentication */
    oauth?: OAuthConfig;
    
    /** JWT authentication */
    jwt?: JWTConfig;
    
    /** Custom strategies */
    custom?: CustomAuthStrategy[];
  };
  
  /** Rate limits */
  rateLimits: RateLimitsConfig;
  
  /** Redis configuration (for rate limiting) */
  redis?: {
    url: string;
    token?: string;
    prefix?: string;
  };
  
  /** Allow anonymous access */
  allowAnonymous?: boolean;
  
  /** Default rate limit tier for anonymous */
  anonymousTier?: 'anonymous' | 'authenticated';
  
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /** Required authentication */
  required?: boolean;
  
  /** Required roles */
  roles?: string[];
  
  /** Required scopes */
  scopes?: string[];
  
  /** Custom authorization check */
  authorize?: (context: AuthContext) => boolean | Promise<boolean>;
}

/**
 * Auth error
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INVALID_TOKEN',
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

