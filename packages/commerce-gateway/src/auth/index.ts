/**
 * @betterdata/commerce-gateway/auth
 * 
 * Authentication and authorization module for the LLM Gateway.
 * 
 * @example
 * ```typescript
 * import { Auth, createAuth } from '@betterdata/commerce-gateway/auth';
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
 * // Hono middleware
 * app.use('*', auth.honoMiddleware());
 * 
 * // Or Express middleware
 * app.use(auth.middleware());
 * ```
 * 
 * @license MIT
 */

// Main Auth class
export { Auth, createAuth } from './Auth';

// Strategies
export {
  ApiKeyStrategy,
  createApiKeyStrategy,
  generateApiKey,
  isValidApiKeyFormat,
} from './strategies/ApiKey';

export {
  OAuthStrategy,
  createOAuthStrategy,
  generateOAuthState,
} from './strategies/OAuth';

export {
  JWTStrategy,
  createJWTStrategy,
  generateJWTSecret,
} from './strategies/JWT';

// Rate limiting
export {
  RedisRateLimiter,
  InMemoryRateLimiter,
  createRateLimiter,
} from './rateLimiter';

// Types
export type {
  AuthConfig,
  AuthContext,
  AuthUser,
  AuthRequest,
  AuthMiddlewareOptions,
  ApiKeyConfig,
  OAuthConfig,
  OAuthProviderConfig,
  JWTConfig,
  CustomAuthStrategy,
  RateLimiter,
  RateLimitConfig,
  RateLimitsConfig,
  RateLimitResult,
  AuthStrategyContext,
} from './types';

export { AuthError } from './types';

