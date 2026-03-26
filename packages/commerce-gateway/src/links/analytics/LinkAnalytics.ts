/**
 * @betterdata/commerce-gateway - Link Analytics
 * 
 * Track clicks, conversions, and gather metrics for short links.
 * 
 * @license Apache-2.0
 */

import type {
  LinkAnalytics as ILinkAnalytics,
  ClickContext,
  ConversionContext,
  LinkMetrics,
} from '../types';

// ============================================================================
// Storage Interface
// ============================================================================

interface AnalyticsStorage {
  /**
   * Increment a counter
   */
  incr(key: string): Promise<number>;

  /**
   * Add to a set
   */
  sadd(key: string, value: string): Promise<void>;

  /**
   * Get set size
   */
  scard(key: string): Promise<number>;

  /**
   * Increment hash field
   */
  hincrby(key: string, field: string, increment: number): Promise<void>;

  /**
   * Get all hash fields
   */
  hgetall(key: string): Promise<Record<string, string>>;

  /**
   * Get a value
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Add to sorted set
   */
  zadd(key: string, score: number, member: string): Promise<void>;

  /**
   * Get top members from sorted set
   */
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;

  /**
   * Get all keys matching pattern
   */
  keys(pattern: string): Promise<string[]>;
}

// ============================================================================
// Redis Analytics Storage
// ============================================================================

/**
 * Redis-based analytics storage
 */
export class RedisAnalyticsStorage implements AnalyticsStorage {
  private redis: {
    url: string;
    token?: string;
  };
  private prefix: string;

  constructor(config: { url: string; token?: string; prefix?: string }) {
    this.redis = { url: config.url, token: config.token };
    this.prefix = config.prefix ?? 'llm-gateway:analytics:';
  }

  private async command(...args: string[]): Promise<unknown> {
    const response = await fetch(this.redis.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.redis.token ? { Authorization: `Bearer ${this.redis.token}` } : {}),
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Redis command failed: ${response.statusText}`);
    }

    const result = await response.json() as { result: unknown };
    return result.result;
  }

  async incr(key: string): Promise<number> {
    const result = await this.command('INCR', this.prefix + key);
    return result as number;
  }

  async sadd(key: string, value: string): Promise<void> {
    await this.command('SADD', this.prefix + key, value);
  }

  async scard(key: string): Promise<number> {
    const result = await this.command('SCARD', this.prefix + key);
    return result as number;
  }

  async hincrby(key: string, field: string, increment: number): Promise<void> {
    await this.command('HINCRBY', this.prefix + key, field, increment.toString());
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const result = await this.command('HGETALL', this.prefix + key) as string[];
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      const hashKey = result[i];
      const value = result[i + 1];
      if (hashKey !== undefined && value !== undefined) {
        obj[hashKey] = value;
      }
    }
    return obj;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command('GET', this.prefix + key);
    return result as string | null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.command('SET', this.prefix + key, value);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.command('ZADD', this.prefix + key, score.toString(), member);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const result = await this.command('ZREVRANGE', this.prefix + key, start.toString(), stop.toString());
    return result as string[];
  }

  async keys(pattern: string): Promise<string[]> {
    const result = await this.command('KEYS', this.prefix + pattern);
    return (result as string[]).map(k => k.replace(this.prefix, ''));
  }
}

// ============================================================================
// In-Memory Analytics Storage
// ============================================================================

/**
 * In-memory analytics storage for development/testing
 */
export class InMemoryAnalyticsStorage implements AnalyticsStorage {
  private counters: Map<string, number> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private hashes: Map<string, Map<string, number>> = new Map();
  private strings: Map<string, string> = new Map();
  private sortedSets: Map<string, Array<{ score: number; member: string }>> = new Map();

  async incr(key: string): Promise<number> {
    const current = this.counters.get(key) ?? 0;
    const newValue = current + 1;
    this.counters.set(key, newValue);
    return newValue;
  }

  async sadd(key: string, value: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(value);
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async hincrby(key: string, field: string, increment: number): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const current = this.hashes.get(key)!.get(field) ?? 0;
    this.hashes.get(key)!.set(field, current + increment);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const obj: Record<string, string> = {};
    for (const [k, v] of hash) {
      obj[k] = v.toString();
    }
    return obj;
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, []);
    }
    const set = this.sortedSets.get(key)!;
    const existing = set.findIndex(item => item.member === member);
    if (existing >= 0) {
      const item = set[existing];
      if (item) {
        item.score = score;
      }
    } else {
      set.push({ score, member });
    }
    set.sort((a, b) => b.score - a.score);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const set = this.sortedSets.get(key) ?? [];
    return set.slice(start, stop + 1).map(item => item.member);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const allKeys = [
      ...this.counters.keys(),
      ...this.sets.keys(),
      ...this.hashes.keys(),
      ...this.strings.keys(),
      ...this.sortedSets.keys(),
    ];
    return [...new Set(allKeys)].filter(k => regex.test(k));
  }
}

// ============================================================================
// Link Analytics Implementation
// ============================================================================

/**
 * Link analytics implementation
 * 
 * @example
 * ```typescript
 * import { LinkAnalytics } from '@betterdata/commerce-gateway/links';
 * 
 * const analytics = new LinkAnalytics({
 *   storage: new RedisAnalyticsStorage({
 *     url: process.env.REDIS_URL!,
 *   }),
 * });
 * 
 * // Track a click
 * await analytics.trackClick(linkId, {
 *   userAgent: req.headers['user-agent'],
 *   ip: req.ip,
 * });
 * 
 * // Get metrics
 * const metrics = await analytics.getMetrics(linkId);
 * ```
 */
export class LinkAnalytics implements ILinkAnalytics {
  private storage: AnalyticsStorage;

  constructor(config: { storage: AnalyticsStorage }) {
    this.storage = config.storage;
  }

  /**
   * Track a click event
   */
  async trackClick(linkId: string, context: ClickContext): Promise<void> {
    const timestamp = context.timestamp ?? new Date();
    const dateKey = timestamp.toISOString().slice(0, 10);
    const visitorId = this.hashVisitor(context);

    // Total clicks
    await this.storage.incr(`link:${linkId}:clicks`);

    // Unique visitors
    await this.storage.sadd(`link:${linkId}:visitors`, visitorId);

    // Clicks by day
    await this.storage.hincrby(`link:${linkId}:clicks_by_day`, dateKey, 1);

    // Track first/last click
    const firstClick = await this.storage.get(`link:${linkId}:first_click`);
    if (!firstClick) {
      await this.storage.set(`link:${linkId}:first_click`, timestamp.toISOString());
    }
    await this.storage.set(`link:${linkId}:last_click`, timestamp.toISOString());

    // Track by country
    if (context.country) {
      await this.storage.hincrby(`link:${linkId}:countries`, context.country, 1);
    }

    // Track by device
    if (context.device) {
      await this.storage.hincrby(`link:${linkId}:devices`, context.device, 1);
    }

    // Track by browser
    if (context.browser) {
      await this.storage.hincrby(`link:${linkId}:browsers`, context.browser, 1);
    }

    // Track by referer
    if (context.referer) {
      await this.storage.hincrby(`link:${linkId}:referers`, context.referer, 1);
    }

    // Update global rankings
    const totalClicks = await this.storage.incr(`link:${linkId}:clicks`) - 1;
    await this.storage.zadd('links:by_clicks', totalClicks + 1, linkId);
  }

  /**
   * Track a conversion event
   */
  async trackConversion(linkId: string, context: ConversionContext): Promise<void> {
    const timestamp = context.timestamp ?? new Date();

    // Total conversions
    await this.storage.incr(`link:${linkId}:conversions`);

    // Revenue
    const revenueKey = `link:${linkId}:revenue`;
    const currentRevenue = parseFloat(await this.storage.get(revenueKey) ?? '0');
    await this.storage.set(revenueKey, (currentRevenue + context.orderTotal).toString());

    // Currency
    await this.storage.set(`link:${linkId}:currency`, context.currency);

    // Track by day
    const dateKey = timestamp.toISOString().slice(0, 10);
    await this.storage.hincrby(`link:${linkId}:conversions_by_day`, dateKey, 1);

    // Update global rankings
    const totalRevenue = currentRevenue + context.orderTotal;
    await this.storage.zadd('links:by_revenue', totalRevenue, linkId);
    
    const conversions = parseInt(await this.storage.get(`link:${linkId}:conversions`) ?? '0');
    await this.storage.zadd('links:by_conversions', conversions, linkId);
  }

  /**
   * Get metrics for a link
   */
  async getMetrics(linkId: string): Promise<LinkMetrics> {
    const [
      clicks,
      uniqueClicks,
      conversions,
      revenue,
      currency,
      clicksByCountry,
      clicksByDevice,
      clicksByBrowser,
      clicksByDay,
      referers,
      firstClick,
      lastClick,
    ] = await Promise.all([
      this.storage.get(`link:${linkId}:clicks`).then(v => parseInt(v ?? '0')),
      this.storage.scard(`link:${linkId}:visitors`),
      this.storage.get(`link:${linkId}:conversions`).then(v => parseInt(v ?? '0')),
      this.storage.get(`link:${linkId}:revenue`).then(v => parseFloat(v ?? '0')),
      this.storage.get(`link:${linkId}:currency`).then(v => v ?? 'USD'),
      this.storage.hgetall(`link:${linkId}:countries`),
      this.storage.hgetall(`link:${linkId}:devices`),
      this.storage.hgetall(`link:${linkId}:browsers`),
      this.storage.hgetall(`link:${linkId}:clicks_by_day`),
      this.storage.hgetall(`link:${linkId}:referers`),
      this.storage.get(`link:${linkId}:first_click`),
      this.storage.get(`link:${linkId}:last_click`),
    ]);

    // Format clicks by day
    const clicksByDayArray = Object.entries(clicksByDay)
      .map(([date, clicksStr]) => ({ date, clicks: parseInt(clicksStr) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format top referers
    const topReferers = Object.entries(referers)
      .map(([referer, clicksStr]) => ({ referer, clicks: parseInt(clicksStr) }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Calculate conversion rate
    const conversionRate = clicks > 0 ? conversions / clicks : 0;

    return {
      linkId,
      clicks,
      uniqueClicks,
      conversions,
      conversionRate,
      revenue,
      currency,
      clicksByCountry: this.parseIntValues(clicksByCountry),
      clicksByDevice: this.parseIntValues(clicksByDevice),
      clicksByBrowser: this.parseIntValues(clicksByBrowser),
      clicksByDay: clicksByDayArray,
      topReferers,
      firstClick: firstClick ? new Date(firstClick) : undefined,
      lastClick: lastClick ? new Date(lastClick) : undefined,
    };
  }

  /**
   * Get metrics for multiple links
   */
  async getBatchMetrics(linkIds: string[]): Promise<Map<string, LinkMetrics>> {
    const results = new Map<string, LinkMetrics>();
    
    await Promise.all(
      linkIds.map(async linkId => {
        const metrics = await this.getMetrics(linkId);
        results.set(linkId, metrics);
      })
    );

    return results;
  }

  /**
   * Get top performing links
   */
  async getTopLinks(options?: {
    limit?: number;
    sortBy?: 'clicks' | 'conversions' | 'revenue';
    timeRange?: { start: Date; end: Date };
  }): Promise<LinkMetrics[]> {
    const limit = options?.limit ?? 10;
    const sortBy = options?.sortBy ?? 'clicks';
    
    const setKey = `links:by_${sortBy}`;
    const topLinkIds = await this.storage.zrevrange(setKey, 0, limit - 1);

    const metrics = await Promise.all(
      topLinkIds.map(linkId => this.getMetrics(linkId))
    );

    return metrics;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Generate a hash for visitor identification
   */
  private hashVisitor(context: ClickContext): string {
    const data = [
      context.ip ?? 'unknown',
      context.userAgent ?? 'unknown',
    ].join(':');

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Parse string values to integers
   */
  private parseIntValues(obj: Record<string, string>): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = parseInt(value);
    }
    return result;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create link analytics with Redis storage
 */
export function createLinkAnalytics(config: {
  redis?: { url: string; token?: string; prefix?: string };
}): LinkAnalytics {
  const storage = config.redis
    ? new RedisAnalyticsStorage(config.redis)
    : new InMemoryAnalyticsStorage();

  return new LinkAnalytics({ storage });
}

