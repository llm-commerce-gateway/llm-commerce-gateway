/**
 * @betterdata/commerce-gateway - Auth Module
 * 
 * Unified authentication and authorization for the LLM Gateway.
 * Supports API keys, OAuth, JWT, and custom strategies.
 * 
 * @example
 * ```typescript
 * import { Auth } from '@betterdata/commerce-gateway/auth';
 * 
 * const auth = new Auth({
 *   strategies: {
 *     apiKey: {
 *       keys: [process.env.API_KEY!],
 *     },
 *     oauth: {
 *       google: {
 *         clientId: process.env.GOOGLE_CLIENT_ID!,
 *         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *       },
 *     },
 *   },
 *   rateLimits: {
 *     anonymous: { requests: 10, window: 60 },
 *     authenticated: { requests: 100, window: 60 },
 *   },
 * });
 * 
 * // Use as middleware
 * app.use(auth.middleware());
 * ```
 * 
 * @license MIT
 */

import type {
  AuthConfig,
  AuthContext,
  AuthUser,
  AuthRequest,
  AuthMiddlewareOptions,
  RateLimiter,
  RateLimitResult,
  CustomAuthStrategy,
} from './types';
import { AuthError } from './types';
import { ApiKeyStrategy } from './strategies/ApiKey';
import { OAuthStrategy } from './strategies/OAuth';
import { JWTStrategy } from './strategies/JWT';
import { createRateLimiter, InMemoryRateLimiter } from './rateLimiter';

// ============================================================================
// Auth Module
// ============================================================================

/**
 * Unified authentication module
 */
export class Auth {
  private config: AuthConfig;
  private apiKeyStrategy?: ApiKeyStrategy;
  private oauthStrategy?: OAuthStrategy;
  private jwtStrategy?: JWTStrategy;
  private customStrategies: CustomAuthStrategy[] = [];
  private rateLimiter: RateLimiter;

  constructor(config: AuthConfig) {
    this.config = {
      allowAnonymous: true,
      anonymousTier: 'anonymous',
      debug: false,
      ...config,
    };

    // Initialize strategies
    if (config.strategies.apiKey) {
      this.apiKeyStrategy = new ApiKeyStrategy(config.strategies.apiKey);
    }

    if (config.strategies.oauth) {
      this.oauthStrategy = new OAuthStrategy(config.strategies.oauth);
    }

    if (config.strategies.jwt) {
      this.jwtStrategy = new JWTStrategy(config.strategies.jwt);
    }

    if (config.strategies.custom) {
      this.customStrategies = config.strategies.custom;
    }

    // Initialize rate limiter
    this.rateLimiter = config.redis
      ? createRateLimiter({
          redis: config.redis,
          limits: config.rateLimits,
        })
      : new InMemoryRateLimiter(config.rateLimits);
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Authenticate a request
   */
  async authenticate(request: AuthRequest): Promise<AuthContext> {
    let user: AuthUser | null = null;

    // Try API key first (most common for programmatic access)
    if (this.apiKeyStrategy && !user) {
      user = await this.apiKeyStrategy.validate(request);
      if (user) {
        this.log('Authenticated via API key');
      }
    }

    // Try JWT
    if (this.jwtStrategy && !user) {
      user = await this.jwtStrategy.validate(request);
      if (user) {
        this.log('Authenticated via JWT');
      }
    }

    // Try OAuth
    if (this.oauthStrategy && !user) {
      user = await this.oauthStrategy.validate(request);
      if (user) {
        this.log('Authenticated via OAuth');
      }
    }

    // Try custom strategies
    for (const strategy of this.customStrategies) {
      if (!user) {
        user = await strategy.validate(request, { rateLimiter: this.rateLimiter });
        if (user) {
          this.log(`Authenticated via custom strategy: ${strategy.name}`);
        }
      }
    }

    // Build context
    const context: AuthContext = {
      user,
      authenticated: !!user,
      rateLimitTier: user
        ? (user.roles?.includes('premium') ? 'premium' : 'authenticated')
        : (this.config.anonymousTier ?? 'anonymous'),
      apiKeyId: user?.claims?.apiKeyId as string | undefined,
      oauthProvider: user?.claims?.provider as string | undefined,
    };

    return context;
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(
    key: string,
    context: AuthContext
  ): Promise<RateLimitResult> {
    return this.rateLimiter.check(key, context.rateLimitTier);
  }

  /**
   * Get rate limit status without consuming
   */
  async getRateLimitStatus(
    key: string,
    context: AuthContext
  ): Promise<RateLimitResult> {
    return this.rateLimiter.peek(key, context.rateLimitTier);
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<void> {
    return this.rateLimiter.reset(key);
  }

  // ============================================================================
  // Middleware
  // ============================================================================

  /**
   * Create authentication middleware
   */
  middleware(options: AuthMiddlewareOptions = {}) {
    return async (
      req: AuthRequest & { auth?: AuthContext },
      res: {
        status: (code: number) => { json: (data: unknown) => void };
        setHeader?: (name: string, value: string) => void;
      },
      next: () => void | Promise<void>
    ) => {
      try {
        // Authenticate
        const context = await this.authenticate(req);
        req.auth = context;

        // Check if authentication is required
        if (options.required && !context.authenticated) {
          if (!this.config.allowAnonymous) {
            throw new AuthError('Authentication required', 'UNAUTHORIZED', 401);
          }
        }

        // Check roles
        if (options.roles && context.user) {
          const hasRole = options.roles.some(
            role => context.user?.roles?.includes(role)
          );
          if (!hasRole) {
            throw new AuthError('Insufficient permissions', 'FORBIDDEN', 403);
          }
        }

        // Custom authorization
        if (options.authorize) {
          const authorized = await options.authorize(context);
          if (!authorized) {
            throw new AuthError('Access denied', 'FORBIDDEN', 403);
          }
        }

        // Get rate limit key (prefer user ID, fall back to session/IP)
        const rateLimitKey = context.user?.id
          ?? req.headers['x-session-id']
          ?? req.headers['x-forwarded-for']?.split(',')[0]
          ?? 'anonymous';

        // Check rate limit
        const rateLimit = await this.checkRateLimit(rateLimitKey, context);

        // Set rate limit headers
        if (res.setHeader) {
          res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
          res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
          res.setHeader('X-RateLimit-Reset', rateLimit.resetIn.toString());
        }

        if (!rateLimit.allowed) {
          if (res.setHeader && rateLimit.retryAfter) {
            res.setHeader('Retry-After', rateLimit.retryAfter.toString());
          }
          throw new AuthError(
            `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds`,
            'RATE_LIMITED',
            429
          );
        }

        await next();
      } catch (error) {
        if (error instanceof AuthError) {
          res.status(error.statusCode).json({
            error: error.code,
            message: error.message,
          });
        } else {
          throw error;
        }
      }
    };
  }

  /**
   * Create Hono-compatible middleware
   */
  honoMiddleware(options: AuthMiddlewareOptions = {}) {
    return async (c: {
      req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined };
      set: (key: string, value: unknown) => void;
      header: (name: string, value: string) => void;
      json: (data: unknown, status?: number) => Response;
    }, next: () => Promise<void>) => {
      const request: AuthRequest = {
        headers: {},
        query: {},
      };

      // Extract headers
      for (const name of ['authorization', 'x-api-key', 'x-session-id', 'x-forwarded-for']) {
        const value = c.req.header(name);
        if (value) {
          request.headers[name] = value;
        }
      }

      // Extract query params
      for (const name of ['api_key', 'token']) {
        const value = c.req.query(name);
        if (value) {
          request.query![name] = value;
        }
      }

      // Authenticate
      const context = await this.authenticate(request);
      c.set('auth', context);

      // Check requirements
      if (options.required && !context.authenticated && !this.config.allowAnonymous) {
        return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
      }

      if (options.roles && context.user) {
        const hasRole = options.roles.some(role => context.user?.roles?.includes(role));
        if (!hasRole) {
          return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403);
        }
      }

      if (options.authorize) {
        const authorized = await options.authorize(context);
        if (!authorized) {
          return c.json({ error: 'FORBIDDEN', message: 'Access denied' }, 403);
        }
      }

      // Rate limiting
      const rateLimitKey = context.user?.id
        ?? request.headers['x-session-id']
        ?? request.headers['x-forwarded-for']?.split(',')[0]
        ?? 'anonymous';

      const rateLimit = await this.checkRateLimit(rateLimitKey, context);

      c.header('X-RateLimit-Limit', rateLimit.limit.toString());
      c.header('X-RateLimit-Remaining', rateLimit.remaining.toString());
      c.header('X-RateLimit-Reset', rateLimit.resetIn.toString());

      if (!rateLimit.allowed) {
        if (rateLimit.retryAfter) {
          c.header('Retry-After', rateLimit.retryAfter.toString());
        }
        return c.json({
          error: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds`,
        }, 429);
      }

      await next();
      return;
    };
  }

  // ============================================================================
  // OAuth Helpers
  // ============================================================================

  /**
   * Get OAuth authorization URL
   */
  getOAuthAuthorizationUrl(
    provider: string,
    state: string,
    redirectUri?: string
  ): string {
    if (!this.oauthStrategy) {
      throw new Error('OAuth not configured');
    }
    return this.oauthStrategy.getAuthorizationUrl(provider, state, redirectUri);
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string,
    redirectUri?: string
  ): Promise<{ user: AuthUser; tokens: { access_token: string } }> {
    if (!this.oauthStrategy) {
      throw new Error('OAuth not configured');
    }
    return this.oauthStrategy.handleCallback(provider, code, state, redirectUri);
  }

  /**
   * Get available OAuth providers
   */
  getOAuthProviders(): string[] {
    return this.oauthStrategy?.getProviders() ?? [];
  }

  // ============================================================================
  // JWT Helpers
  // ============================================================================

  /**
   * Create a JWT token
   */
  async createToken(payload: { sub: string; [key: string]: unknown }): Promise<string> {
    if (!this.jwtStrategy) {
      throw new Error('JWT not configured');
    }
    return this.jwtStrategy.createToken(payload);
  }

  /**
   * Verify a JWT token
   */
  async verifyToken(token: string): Promise<{ sub: string; [key: string]: unknown } | null> {
    if (!this.jwtStrategy) {
      throw new Error('JWT not configured');
    }
    return this.jwtStrategy.verifyToken(token);
  }

  /**
   * Refresh a JWT token
   */
  async refreshToken(token: string): Promise<string | null> {
    if (!this.jwtStrategy) {
      throw new Error('JWT not configured');
    }
    return this.jwtStrategy.refreshToken(token);
  }

  // ============================================================================
  // API Key Helpers
  // ============================================================================

  /**
   * Validate an API key
   */
  isValidApiKey(key: string): boolean {
    return this.apiKeyStrategy?.isValidKey(key) ?? false;
  }

  /**
   * Add an API key at runtime
   */
  addApiKey(key: string): void {
    this.apiKeyStrategy?.addKey(key);
  }

  /**
   * Remove an API key at runtime
   */
  removeApiKey(key: string): void {
    this.apiKeyStrategy?.removeKey(key);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[Auth] ${message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an Auth instance
 */
export function createAuth(config: AuthConfig): Auth {
  return new Auth(config);
}

