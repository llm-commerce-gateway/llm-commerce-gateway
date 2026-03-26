/**
 * @betterdata/commerce-gateway - Rate Limiter
 * 
 * Redis-based rate limiting with support for multiple tiers.
 * 
 * @license Apache-2.0
 */

import type {
  RateLimiter,
  RateLimitResult,
  RateLimitsConfig,
  RateLimitConfig,
  AuthContext,
} from './types';

// ============================================================================
// Redis Client (for rate limiting)
// ============================================================================

class RateLimitRedisClient {
  private url: string;
  private token?: string;

  constructor(url: string, token?: string) {
    this.url = url;
    this.token = token;
  }

  private async command(...args: string[]): Promise<unknown> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Redis command failed: ${response.statusText}`);
    }

    const result = await response.json() as { result: unknown };
    return result.result;
  }

  async multi(...commands: string[][]): Promise<unknown[]> {
    // Upstash pipeline
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Redis pipeline failed: ${response.statusText}`);
    }

    const results = await response.json() as Array<{ result: unknown }>;
    return results.map(r => r.result);
  }

  async incr(key: string): Promise<number> {
    const result = await this.command('INCR', key);
    return result as number;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command('GET', key);
    return result as string | null;
  }

  async ttl(key: string): Promise<number> {
    const result = await this.command('TTL', key);
    return result as number;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.command('EXPIRE', key, seconds.toString());
  }

  async del(key: string): Promise<void> {
    await this.command('DEL', key);
  }
}

// ============================================================================
// Sliding Window Rate Limiter
// ============================================================================

/**
 * Redis-based sliding window rate limiter
 */
export class RedisRateLimiter implements RateLimiter {
  private redis: RateLimitRedisClient;
  private config: RateLimitsConfig;
  private prefix: string;

  constructor(config: {
    redis: { url: string; token?: string };
    limits: RateLimitsConfig;
    prefix?: string;
  }) {
    this.redis = new RateLimitRedisClient(config.redis.url, config.redis.token);
    this.config = config.limits;
    this.prefix = config.prefix ?? 'llm-gateway:ratelimit:';
  }

  /**
   * Get rate limit config for tier
   */
  private getLimit(tier: AuthContext['rateLimitTier']): RateLimitConfig {
    switch (tier) {
      case 'unlimited':
        return { requests: Number.MAX_SAFE_INTEGER, window: 60 };
      case 'premium':
        return this.config.premium ?? this.config.authenticated;
      case 'authenticated':
        return this.config.authenticated;
      case 'anonymous':
      default:
        return this.config.anonymous;
    }
  }

  /**
   * Check and consume rate limit
   */
  async check(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult> {
    const limit = this.getLimit(tier);
    const fullKey = `${this.prefix}${tier}:${key}`;

    // Get current count and TTL
    const [countStr, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.ttl(fullKey),
    ]);

    const currentCount = countStr ? parseInt(countStr, 10) : 0;

    // If no key exists or TTL expired, this is a new window
    if (!countStr || ttl <= 0) {
      await this.redis.incr(fullKey);
      await this.redis.expire(fullKey, limit.window);
      
      return {
        allowed: true,
        remaining: limit.requests - 1,
        resetIn: limit.window,
        limit: limit.requests,
      };
    }

    // Check if over limit
    if (currentCount >= limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: ttl,
        limit: limit.requests,
        retryAfter: ttl,
      };
    }

    // Increment count
    await this.redis.incr(fullKey);

    return {
      allowed: true,
      remaining: limit.requests - currentCount - 1,
      resetIn: ttl,
      limit: limit.requests,
    };
  }

  /**
   * Get current usage without consuming
   */
  async peek(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult> {
    const limit = this.getLimit(tier);
    const fullKey = `${this.prefix}${tier}:${key}`;

    const [countStr, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.ttl(fullKey),
    ]);

    const currentCount = countStr ? parseInt(countStr, 10) : 0;
    const resetIn = ttl > 0 ? ttl : limit.window;

    return {
      allowed: currentCount < limit.requests,
      remaining: Math.max(0, limit.requests - currentCount),
      resetIn,
      limit: limit.requests,
      retryAfter: currentCount >= limit.requests ? resetIn : undefined,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    // Delete all tier variants
    const tiers = ['anonymous', 'authenticated', 'premium'];
    for (const tier of tiers) {
      await this.redis.del(`${this.prefix}${tier}:${key}`);
    }
  }

  /**
   * Check rate limit for a specific tool
   */
  async checkTool(
    key: string,
    toolName: string,
    tier: AuthContext['rateLimitTier']
  ): Promise<RateLimitResult> {
    // Get tool-specific limit or fall back to tier limit
    const toolLimit = this.config.tools?.[toolName];
    if (!toolLimit) {
      return this.check(key, tier);
    }

    const fullKey = `${this.prefix}tool:${toolName}:${key}`;

    const [countStr, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.ttl(fullKey),
    ]);

    const currentCount = countStr ? parseInt(countStr, 10) : 0;

    if (!countStr || ttl <= 0) {
      await this.redis.incr(fullKey);
      await this.redis.expire(fullKey, toolLimit.window);
      
      return {
        allowed: true,
        remaining: toolLimit.requests - 1,
        resetIn: toolLimit.window,
        limit: toolLimit.requests,
      };
    }

    if (currentCount >= toolLimit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: ttl,
        limit: toolLimit.requests,
        retryAfter: ttl,
      };
    }

    await this.redis.incr(fullKey);

    return {
      allowed: true,
      remaining: toolLimit.requests - currentCount - 1,
      resetIn: ttl,
      limit: toolLimit.requests,
    };
  }
}

// ============================================================================
// In-Memory Rate Limiter (for development)
// ============================================================================

/**
 * In-memory rate limiter for development and testing
 */
export class InMemoryRateLimiter implements RateLimiter {
  private config: RateLimitsConfig;
  private windows: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(config: RateLimitsConfig) {
    this.config = config;

    // Clean up expired windows periodically
    setInterval(() => this.cleanup(), 60000);
  }

  private getLimit(tier: AuthContext['rateLimitTier']): RateLimitConfig {
    switch (tier) {
      case 'unlimited':
        return { requests: Number.MAX_SAFE_INTEGER, window: 60 };
      case 'premium':
        return this.config.premium ?? this.config.authenticated;
      case 'authenticated':
        return this.config.authenticated;
      case 'anonymous':
      default:
        return this.config.anonymous;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }

  async check(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult> {
    const limit = this.getLimit(tier);
    const fullKey = `${tier}:${key}`;
    const now = Date.now();

    let window = this.windows.get(fullKey);

    // Create new window if doesn't exist or expired
    if (!window || window.resetAt <= now) {
      window = {
        count: 0,
        resetAt: now + limit.window * 1000,
      };
      this.windows.set(fullKey, window);
    }

    // Check if over limit
    if (window.count >= limit.requests) {
      const resetIn = Math.ceil((window.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: limit.requests,
        retryAfter: resetIn,
      };
    }

    // Increment
    window.count++;

    const resetIn = Math.ceil((window.resetAt - now) / 1000);
    return {
      allowed: true,
      remaining: limit.requests - window.count,
      resetIn,
      limit: limit.requests,
    };
  }

  async peek(key: string, tier: AuthContext['rateLimitTier']): Promise<RateLimitResult> {
    const limit = this.getLimit(tier);
    const fullKey = `${tier}:${key}`;
    const now = Date.now();

    const window = this.windows.get(fullKey);

    if (!window || window.resetAt <= now) {
      return {
        allowed: true,
        remaining: limit.requests,
        resetIn: limit.window,
        limit: limit.requests,
      };
    }

    const resetIn = Math.ceil((window.resetAt - now) / 1000);
    return {
      allowed: window.count < limit.requests,
      remaining: Math.max(0, limit.requests - window.count),
      resetIn,
      limit: limit.requests,
      retryAfter: window.count >= limit.requests ? resetIn : undefined,
    };
  }

  async reset(key: string): Promise<void> {
    const tiers = ['anonymous', 'authenticated', 'premium'];
    for (const tier of tiers) {
      this.windows.delete(`${tier}:${key}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a rate limiter
 */
export function createRateLimiter(config: {
  redis?: { url: string; token?: string };
  limits: RateLimitsConfig;
  prefix?: string;
}): RateLimiter {
  if (config.redis) {
    return new RedisRateLimiter({
      redis: config.redis,
      limits: config.limits,
      prefix: config.prefix,
    });
  }

  console.warn('No Redis configuration provided, using in-memory rate limiter');
  return new InMemoryRateLimiter(config.limits);
}

