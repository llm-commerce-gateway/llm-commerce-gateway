import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { keys } from '../keys';

// ============================================================================
// Redis Client
// ============================================================================

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  
  const config = keys();
  if (!config.UPSTASH_REDIS_REST_URL || !config.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[Rate Limiter] Redis not configured, rate limiting disabled');
    return null;
  }

  redis = new Redis({
    url: config.UPSTASH_REDIS_REST_URL,
    token: config.UPSTASH_REDIS_REST_TOKEN,
  });

  return redis;
}

// ============================================================================
// Rate Limiter Instances
// ============================================================================

interface RateLimitConfig {
  requests: number;
  windowSeconds: number;
  prefix?: string;
}

const rateLimiters = new Map<string, Ratelimit>();

function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  const key = `${config.prefix ?? 'llm-gateway'}:${config.requests}:${config.windowSeconds}`;
  
  if (!rateLimiters.has(key)) {
    rateLimiters.set(
      key,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSeconds} s`),
        prefix: config.prefix ?? 'llm-gateway',
        analytics: true,
      })
    );
  }

  return rateLimiters.get(key)!;
}

// ============================================================================
// Rate Limit Middleware
// ============================================================================

export interface RateLimitOptions {
  requests?: number;
  windowSeconds?: number;
  keyGenerator?: (c: Context) => string;
  skip?: (c: Context) => boolean;
  onRateLimited?: (c: Context, resetTime: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RateLimitOptions, 'onRateLimited' | 'skip' | 'keyGenerator'>> = {
  requests: 100,
  windowSeconds: 60,
};

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = (options: RateLimitOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return createMiddleware(async (c: Context, next: Next) => {
    // Check if we should skip rate limiting
    if (options.skip?.(c)) {
      return next();
    }

    const rateLimiter = getRateLimiter({
      requests: config.requests,
      windowSeconds: config.windowSeconds,
    });

    // If rate limiter not available, allow request
    if (!rateLimiter) {
      return next();
    }

    // Generate rate limit key
    const identifier = options.keyGenerator?.(c) ?? getRateLimitKey(c);

    // Check rate limit
    const result = await rateLimiter.limit(identifier);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.success) {
      const resetTime = Math.ceil((result.reset - Date.now()) / 1000);
      
      options.onRateLimited?.(c, resetTime);

      throw new HTTPException(429, {
        message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      });
    }

    return next();
  });
};

/**
 * Generate rate limit key from request context
 */
function getRateLimitKey(c: Context): string {
  const auth = c.get('auth');
  
  // Use organization ID if available (API key auth)
  if (auth?.type === 'apiKey' && auth.payload?.organizationId) {
    return `org:${auth.payload.organizationId}`;
  }

  // Use user ID if available (session auth)
  if (auth?.type === 'session' && auth.payload?.userId) {
    return `user:${auth.payload.userId}`;
  }

  // Fall back to IP address
  const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
             c.req.header('X-Real-IP') ??
             'anonymous';
  
  return `ip:${ip}`;
}

// ============================================================================
// Tool-Specific Rate Limiters
// ============================================================================

/**
 * Rate limit configuration per tool
 */
export const TOOL_RATE_LIMITS: Record<string, RateLimitConfig> = {
  search_products: { requests: 100, windowSeconds: 60, prefix: 'tool:search' },
  get_product_details: { requests: 200, windowSeconds: 60, prefix: 'tool:details' },
  add_to_cart: { requests: 50, windowSeconds: 60, prefix: 'tool:cart' },
  check_inventory: { requests: 200, windowSeconds: 60, prefix: 'tool:inventory' },
  get_recommendations: { requests: 100, windowSeconds: 60, prefix: 'tool:recommend' },
  create_order: { requests: 10, windowSeconds: 60, prefix: 'tool:order' },
};

/**
 * Get rate limiter for a specific tool
 */
export function getToolRateLimiter(toolName: string): Ratelimit | null {
  const config = TOOL_RATE_LIMITS[toolName] ?? {
    requests: 50,
    windowSeconds: 60,
    prefix: `tool:${toolName}`,
  };
  
  return getRateLimiter(config);
}

/**
 * Check rate limit for a specific tool
 */
export async function checkToolRateLimit(
  toolName: string,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const rateLimiter = getToolRateLimiter(toolName);
  
  if (!rateLimiter) {
    return { success: true, remaining: -1, reset: 0 };
  }

  const result = await rateLimiter.limit(`${toolName}:${identifier}`);
  
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// ============================================================================
// Provider Rate Limiters
// ============================================================================

/**
 * Rate limits per LLM provider
 */
export const PROVIDER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  anthropic: { requests: 1000, windowSeconds: 60, prefix: 'provider:anthropic' },
  openai: { requests: 1000, windowSeconds: 60, prefix: 'provider:openai' },
  google: { requests: 500, windowSeconds: 60, prefix: 'provider:google' },
  grok: { requests: 500, windowSeconds: 60, prefix: 'provider:grok' },
};

/**
 * Provider-specific rate limiting middleware
 */
export const providerRateLimitMiddleware = () => {
  return createMiddleware(async (c: Context, next: Next) => {
    const provider = c.get('provider') as string;
    if (!provider) {
      return next();
    }

    const config = PROVIDER_RATE_LIMITS[provider];
    if (!config) {
      return next();
    }

    const rateLimiter = getRateLimiter(config);
    if (!rateLimiter) {
      return next();
    }

    const identifier = getRateLimitKey(c);
    const result = await rateLimiter.limit(`${provider}:${identifier}`);

    c.header('X-Provider-RateLimit-Limit', String(result.limit));
    c.header('X-Provider-RateLimit-Remaining', String(result.remaining));

    if (!result.success) {
      throw new HTTPException(429, {
        message: `Provider rate limit exceeded for ${provider}`,
      });
    }

    return next();
  });
};

