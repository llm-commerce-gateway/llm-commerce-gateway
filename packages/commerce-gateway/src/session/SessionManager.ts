/**
 * @betterdata/commerce-gateway - Session Manager
 *
 * Manages conversation sessions with pluggable storage backends.
 * Supports Redis for fast access and optional Postgres for persistence.
 *
 * ## Contract (v0.1)
 *
 * All Redis/session keys MUST pass through a KeyDeriver.
 * OSS uses global keys; Cloud uses tenant-namespaced keys.
 *
 * @see docs/contracts/llm-gateway-release-contract.md
 * @license MIT
 */

import type {
  SessionData,
  SessionConfig,
  ConversationMessage,
  UserPreferences,
} from '../core/types';
import type { KeyDeriver } from '../extensions/interfaces';
import { OSSKeyDeriver } from '../extensions/oss-defaults';

// ============================================================================
// Session Store Interface
// ============================================================================

export interface SessionStore {
  get(sessionId: string): Promise<SessionData | null>;
  set(sessionId: string, data: SessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
  extend(sessionId: string, ttlSeconds: number): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
}

// ============================================================================
// Redis Session Store
// ============================================================================

export class RedisSessionStore implements SessionStore {
  private redis: RedisClient;
  private keyDeriver: KeyDeriver;
  private defaultTTL: number;

  /**
   * Create a Redis-backed session store.
   *
   * @param config - Redis configuration
   * @param keyDeriver - Key deriver for Redis keys (default: OSS global keys)
   */
  constructor(
    config: {
      url: string;
      token?: string;
      sessionTTL?: number;
    },
    keyDeriver?: KeyDeriver
  ) {
    this.keyDeriver = keyDeriver ?? new OSSKeyDeriver();
    this.defaultTTL = config.sessionTTL ?? 7 * 24 * 60 * 60; // 7 days

    // Initialize Redis client (using Upstash-compatible interface)
    this.redis = new RedisClient(config.url, config.token);
  }

  /**
   * Derive the Redis key for a session.
   * Uses KeyDeriver to support tenant isolation in Cloud mode.
   */
  private key(sessionId: string): string {
    return this.keyDeriver.deriveSessionKey(sessionId);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(this.key(sessionId));
    if (!data) return null;
    
    const session = JSON.parse(data) as SessionData;
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.updatedAt = new Date(session.updatedAt);
    session.expiresAt = new Date(session.expiresAt);
    
    return session;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    const ttl = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000);
    await this.redis.setex(
      this.key(sessionId),
      ttl > 0 ? ttl : this.defaultTTL,
      JSON.stringify(data)
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  async extend(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(this.key(sessionId), ttlSeconds);
    
    // Also update the expiresAt in the session data
    const session = await this.get(sessionId);
    if (session) {
      session.expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      session.updatedAt = new Date();
      await this.set(sessionId, session);
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    return await this.redis.exists(this.key(sessionId));
  }
}

// ============================================================================
// Simple Redis Client (Upstash-compatible)
// ============================================================================

class RedisClient {
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

  async get(key: string): Promise<string | null> {
    const result = await this.command('GET', key);
    return result as string | null;
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.command('SETEX', key, seconds.toString(), value);
  }

  async del(key: string): Promise<void> {
    await this.command('DEL', key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.command('EXPIRE', key, seconds.toString());
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.command('EXISTS', key);
    return result === 1;
  }
}

// ============================================================================
// In-Memory Session Store (for development/testing)
// ============================================================================

export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, { data: SessionData; expiresAt: number }> = new Map();

  async get(sessionId: string): Promise<SessionData | null> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return entry.data;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    this.sessions.set(sessionId, {
      data,
      expiresAt: data.expiresAt.getTime(),
    });
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async extend(sessionId: string, ttlSeconds: number): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
      entry.data.expiresAt = new Date(entry.expiresAt);
      entry.data.updatedAt = new Date();
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    return true;
  }
}

// ============================================================================
// Session Manager
// ============================================================================

/**
 * Extended session configuration with KeyDeriver support.
 */
export interface SessionManagerConfig extends SessionConfig {
  /**
   * Key deriver for Redis key namespacing.
   * OSS default: Global keys (no tenant isolation)
   * Cloud: Tenant-namespaced keys
   */
  keyDeriver?: KeyDeriver;
}

export class SessionManager {
  private store: SessionStore;
  private defaultTTL: number;
  private keyDeriver: KeyDeriver;

  /**
   * Create a session manager.
   *
   * @param config - Session configuration including optional KeyDeriver
   */
  constructor(config: SessionManagerConfig) {
    this.defaultTTL = config.ttl ?? 7 * 24 * 60 * 60; // 7 days
    this.keyDeriver = config.keyDeriver ?? new OSSKeyDeriver();

    // Use Redis store if configured, otherwise use in-memory
    if (config.redis?.url) {
      this.store = new RedisSessionStore(
        {
          url: config.redis.url,
          token: config.redis.token,
          sessionTTL: this.defaultTTL,
        },
        this.keyDeriver
      );
    } else {
      console.warn('No Redis configuration provided, using in-memory session store');
      this.store = new InMemorySessionStore();
    }
  }

  /**
   * Get the KeyDeriver used by this session manager.
   */
  getKeyDeriver(): KeyDeriver {
    return this.keyDeriver;
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `sess_${timestamp}_${randomPart}`;
  }

  /**
   * Create a new session
   */
  async create(options?: {
    sessionId?: string;
    userId?: string;
    cartId?: string;
    provider?: string;
    preferences?: UserPreferences;
    metadata?: Record<string, unknown>;
  }): Promise<SessionData> {
    const sessionId = options?.sessionId ?? this.generateSessionId();
    const now = new Date();
    
    const session: SessionData = {
      id: sessionId,
      userId: options?.userId,
      cartId: options?.cartId,
      provider: options?.provider as SessionData['provider'],
      preferences: options?.preferences,
      conversationHistory: [],
      metadata: options?.metadata,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.defaultTTL * 1000),
    };

    await this.store.set(sessionId, session);
    return session;
  }

  /**
   * Get an existing session
   */
  async get(sessionId: string): Promise<SessionData | null> {
    return await this.store.get(sessionId);
  }

  /**
   * Get or create a session
   */
  async getOrCreate(sessionId?: string): Promise<SessionData> {
    if (sessionId) {
      const existing = await this.get(sessionId);
      if (existing) return existing;
    }
    
    return await this.create({ sessionId });
  }

  /**
   * Update session data
   */
  async update(
    sessionId: string,
    updates: Partial<Pick<SessionData, 'cartId' | 'userId' | 'provider' | 'preferences' | 'metadata'>>
  ): Promise<SessionData | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    const updatedSession: SessionData = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    await this.store.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Add a message to conversation history
   */
  async addMessage(
    sessionId: string,
    message: Omit<ConversationMessage, 'timestamp'>
  ): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    const fullMessage: ConversationMessage = {
      ...message,
      timestamp: new Date(),
    };

    session.conversationHistory = session.conversationHistory ?? [];
    session.conversationHistory.push(fullMessage);
    session.updatedAt = new Date();

    // Keep only last 50 messages to prevent bloat
    if (session.conversationHistory.length > 50) {
      session.conversationHistory = session.conversationHistory.slice(-50);
    }

    await this.store.set(sessionId, session);
  }

  /**
   * Get conversation history
   */
  async getHistory(
    sessionId: string,
    limit?: number
  ): Promise<ConversationMessage[]> {
    const session = await this.get(sessionId);
    if (!session?.conversationHistory) return [];

    const history = session.conversationHistory;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    sessionId: string,
    preferences: Partial<UserPreferences>
  ): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    session.preferences = {
      ...session.preferences,
      ...preferences,
    };
    session.updatedAt = new Date();

    await this.store.set(sessionId, session);
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }

  /**
   * Extend session TTL
   */
  async extend(sessionId: string, additionalSeconds?: number): Promise<void> {
    const ttl = additionalSeconds ?? this.defaultTTL;
    await this.store.extend(sessionId, ttl);
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    return await this.store.exists(sessionId);
  }

  /**
   * Link a cart to a session
   */
  async linkCart(sessionId: string, cartId: string): Promise<void> {
    await this.update(sessionId, { cartId });
  }

  /**
   * Link a user to a session
   */
  async linkUser(sessionId: string, userId: string): Promise<void> {
    await this.update(sessionId, { userId });
  }
}

// Export default session manager factory
export function createSessionManager(config: SessionManagerConfig): SessionManager {
  return new SessionManager(config);
}

// Re-export KeyDeriver for convenience
export type { KeyDeriver } from '../extensions/interfaces';

