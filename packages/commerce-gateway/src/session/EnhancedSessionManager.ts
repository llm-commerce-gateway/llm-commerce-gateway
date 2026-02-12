/**
 * @betterdata/llm-gateway - Enhanced Session Manager
 * 
 * Full-featured session management with transfer, GDPR, and analytics.
 * 
 * @license MIT
 */

import type {
  Session,
  SessionCart,
  SessionPreferences,
  SessionMessage,
  SessionManagerConfig,
  CreateSessionOptions,
  TransferToken,
  TransferResult,
  UserDataExport,
  AnonymizationResult,
  LLMProvider,
} from './types';
import {
  generateTransferToken,
  isValidTransferToken,
  prepareSessionForTransfer,
  formatHistoryForProvider,
  InMemoryTransferTokenStore,
  type TransferTokenStore,
} from './transfer';

// ============================================================================
// Redis Client (Upstash-compatible)
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

  async set(key: string, value: string): Promise<void> {
    await this.command('SET', key, value);
  }

  async del(...keys: string[]): Promise<number> {
    const result = await this.command('DEL', ...keys);
    return result as number;
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.command('EXPIRE', key, seconds.toString());
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.command('EXISTS', key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const result = await this.command('KEYS', pattern);
    return (result as string[]) ?? [];
  }

  async scan(cursor: string, pattern: string, count: number = 100): Promise<[string, string[]]> {
    const result = await this.command('SCAN', cursor, 'MATCH', pattern, 'COUNT', count.toString());
    return result as [string, string[]];
  }
}

// ============================================================================
// Enhanced Session Manager
// ============================================================================

/**
 * Enhanced Session Manager with transfer, GDPR, and analytics support.
 */
export class EnhancedSessionManager {
  private redis: RedisClient;
  private config: Required<SessionManagerConfig>;
  private transferStore: TransferTokenStore;
  private prefix: string;
  private userPrefix: string;
  private transferPrefix: string;

  constructor(config: SessionManagerConfig) {
    this.config = {
      redis: config.redis,
      postgres: config.postgres,
      ttl: config.ttl ?? 86400, // 24 hours
      maxHistoryLength: config.maxHistoryLength ?? 50,
      enableTransfer: config.enableTransfer ?? true,
      transferTokenTTL: config.transferTokenTTL ?? 300, // 5 minutes
      debug: config.debug ?? false,
    } as Required<SessionManagerConfig>;

    this.redis = new RedisClient(config.redis.url, config.redis.token);
    this.prefix = config.redis.prefix ?? 'llm-gateway:session:';
    this.userPrefix = config.redis.prefix ?? 'llm-gateway:user:';
    this.transferPrefix = config.redis.prefix ?? 'llm-gateway:transfer:';
    
    // Use in-memory transfer store for now
    // In production, would use Redis
    this.transferStore = new InMemoryTransferTokenStore();
  }

  // ============================================================================
  // Core Session Operations
  // ============================================================================

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 12);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Create a new session
   */
  async create(options: CreateSessionOptions = {}): Promise<Session> {
    const sessionId = options.sessionId ?? this.generateSessionId();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      llmProvider: options.llmProvider ?? 'custom',
      userId: options.userId,
      organizationId: options.organizationId,
      cart: options.cart,
      preferences: {
        language: 'en',
        currency: 'USD',
        ...options.preferences,
      },
      conversationHistory: [],
      metadata: options.metadata ?? {},
      anonymous: options.anonymous ?? true,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttl * 1000),
    };

    await this.save(session);

    // Track user session if authenticated
    if (session.userId) {
      await this.linkSessionToUser(session.userId, sessionId);
    }

    this.log(`Created session: ${sessionId}`);
    return session;
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    const data = await this.redis.get(`${this.prefix}${sessionId}`);
    if (!data) return null;

    const session = this.deserialize(data);
    
    // Check expiry
    if (new Date() > session.expiresAt) {
      await this.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Get or create a session
   */
  async getOrCreate(sessionId?: string, options?: CreateSessionOptions): Promise<Session> {
    if (sessionId) {
      const existing = await this.get(sessionId);
      if (existing) return existing;
    }
    return this.create({ ...options, sessionId });
  }

  /**
   * Save a session
   */
  async save(session: Session): Promise<void> {
    session.updatedAt = new Date();
    const ttl = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    await this.redis.setex(
      `${this.prefix}${session.id}`,
      ttl > 0 ? ttl : this.config.ttl,
      this.serialize(session)
    );
  }

  /**
   * Update a session
   */
  async update(
    sessionId: string,
    updates: Partial<Pick<Session, 'cart' | 'preferences' | 'metadata' | 'userId' | 'organizationId'>>
  ): Promise<Session | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    Object.assign(session, updates);
    await this.save(session);

    return session;
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (session?.userId) {
      await this.unlinkSessionFromUser(session.userId, sessionId);
    }
    await this.redis.del(`${this.prefix}${sessionId}`);
    this.log(`Deleted session: ${sessionId}`);
  }

  /**
   * Extend session TTL
   */
  async extend(sessionId: string, additionalSeconds?: number): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    const ttl = additionalSeconds ?? this.config.ttl;
    session.expiresAt = new Date(Date.now() + ttl * 1000);
    await this.save(session);
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    return await this.redis.exists(`${this.prefix}${sessionId}`);
  }

  // ============================================================================
  // Cart Operations
  // ============================================================================

  /**
   * Update cart in session
   */
  async updateCart(sessionId: string, cart: SessionCart): Promise<Session | null> {
    return this.update(sessionId, { cart });
  }

  /**
   * Clear cart from session
   */
  async clearCart(sessionId: string): Promise<Session | null> {
    const session = await this.get(sessionId);
    if (!session) return null;

    session.cart = undefined;
    await this.save(session);

    return session;
  }

  // ============================================================================
  // Conversation History
  // ============================================================================

  /**
   * Add message to conversation history
   */
  async addMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'timestamp'>
  ): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    const fullMessage: SessionMessage = {
      ...message,
      timestamp: new Date(),
    };

    session.conversationHistory.push(fullMessage);

    // Trim history if too long
    if (session.conversationHistory.length > this.config.maxHistoryLength) {
      session.conversationHistory = session.conversationHistory.slice(-this.config.maxHistoryLength);
    }

    await this.save(session);
  }

  /**
   * Get conversation history
   */
  async getHistory(sessionId: string, limit?: number): Promise<SessionMessage[]> {
    const session = await this.get(sessionId);
    if (!session) return [];

    const history = session.conversationHistory;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear conversation history
   */
  async clearHistory(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    session.conversationHistory = [];
    await this.save(session);
  }

  // ============================================================================
  // Preferences
  // ============================================================================

  /**
   * Update user preferences
   */
  async updatePreferences(
    sessionId: string,
    preferences: Partial<SessionPreferences>
  ): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) return;

    session.preferences = {
      ...session.preferences,
      ...preferences,
    };
    await this.save(session);
  }

  // ============================================================================
  // Cross-Platform Transfer
  // ============================================================================

  /**
   * Create a transfer token for cross-platform continuity
   */
  async createTransferToken(
    sessionId: string,
    targetProvider?: LLMProvider
  ): Promise<string> {
    if (!this.config.enableTransfer) {
      throw new Error('Session transfer is not enabled');
    }

    const session = await this.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const token = generateTransferToken();
    const transferToken: TransferToken = {
      token,
      sessionId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.transferTokenTTL * 1000),
      targetProvider,
    };

    // Store in Redis with expiry
    await this.redis.setex(
      `${this.transferPrefix}${token}`,
      this.config.transferTokenTTL,
      JSON.stringify(transferToken)
    );

    // Also store in memory for fast lookup
    await this.transferStore.create(transferToken);

    this.log(`Created transfer token for session: ${sessionId}`);
    return token;
  }

  /**
   * Transfer a session to a new platform using a transfer token
   */
  async transferSession(
    token: string,
    newProvider: LLMProvider
  ): Promise<TransferResult> {
    if (!this.config.enableTransfer) {
      throw new Error('Session transfer is not enabled');
    }

    if (!isValidTransferToken(token)) {
      throw new Error('Invalid transfer token format');
    }

    // Get transfer token
    const tokenData = await this.redis.get(`${this.transferPrefix}${token.toUpperCase()}`);
    if (!tokenData) {
      throw new Error('Transfer token not found or expired');
    }

    const transferToken = JSON.parse(tokenData) as TransferToken;

    // Get original session
    const originalSession = await this.get(transferToken.sessionId);
    if (!originalSession) {
      throw new Error('Original session not found');
    }

    // Check if token specifies a provider and it matches
    if (transferToken.targetProvider && transferToken.targetProvider !== newProvider) {
      throw new Error(`Transfer token is restricted to ${transferToken.targetProvider}`);
    }

    // Prepare transfer data
    const transferData = prepareSessionForTransfer(originalSession, newProvider);
    const formattedHistory = formatHistoryForProvider(
      originalSession.conversationHistory,
      newProvider
    );

    // Create new session
    const newSession = await this.create({
      llmProvider: newProvider,
      userId: originalSession.userId,
      organizationId: originalSession.organizationId,
      cart: transferData.cart,
      preferences: originalSession.preferences,
      anonymous: originalSession.anonymous,
      metadata: {
        ...originalSession.metadata,
        transferredFrom: originalSession.llmProvider,
        transferredAt: new Date().toISOString(),
        originalSessionId: originalSession.id,
      },
    });

    // Add formatted history
    newSession.conversationHistory = formattedHistory;
    newSession.originalProvider = originalSession.llmProvider;
    await this.save(newSession);

    // Invalidate transfer token (one-time use)
    await this.redis.del(`${this.transferPrefix}${token.toUpperCase()}`);
    await this.transferStore.delete(token);

    // Mark original session as transferred
    originalSession.metadata = {
      ...originalSession.metadata,
      transferredTo: newProvider,
      newSessionId: newSession.id,
      transferredAt: new Date().toISOString(),
    };
    await this.save(originalSession);

    this.log(`Transferred session ${originalSession.id} → ${newSession.id}`);

    return {
      session: newSession,
      cartTransferred: !!newSession.cart,
      historyTransferred: newSession.conversationHistory.length > 0,
      transferredAt: new Date(),
    };
  }

  // ============================================================================
  // User Session Tracking
  // ============================================================================

  /**
   * Link a session to a user
   */
  private async linkSessionToUser(userId: string, sessionId: string): Promise<void> {
    const key = `${this.userPrefix}sessions:${userId}`;
    const sessions = await this.getUserSessionIds(userId);
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      await this.redis.set(key, JSON.stringify(sessions));
    }
  }

  /**
   * Unlink a session from a user
   */
  private async unlinkSessionFromUser(userId: string, sessionId: string): Promise<void> {
    const key = `${this.userPrefix}sessions:${userId}`;
    const sessions = await this.getUserSessionIds(userId);
    const filtered = sessions.filter(id => id !== sessionId);
    await this.redis.set(key, JSON.stringify(filtered));
  }

  /**
   * Get all session IDs for a user
   */
  private async getUserSessionIds(userId: string): Promise<string[]> {
    const key = `${this.userPrefix}sessions:${userId}`;
    const data = await this.redis.get(key);
    if (!data) return [];
    return JSON.parse(data) as string[];
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = await this.getUserSessionIds(userId);
    const sessions: Session[] = [];

    for (const id of sessionIds) {
      const session = await this.get(id);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  // ============================================================================
  // GDPR Compliance
  // ============================================================================

  /**
   * Export all user data (GDPR Art. 20 - Data Portability)
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const sessions = await this.getUserSessions(userId);

    // Aggregate preferences across sessions
    const aggregatedPreferences: SessionPreferences = {};
    for (const session of sessions) {
      Object.assign(aggregatedPreferences, session.preferences);
    }

    // Count total interactions
    const totalInteractions = sessions.reduce(
      (sum, s) => sum + s.conversationHistory.length,
      0
    );

    return {
      userId,
      exportedAt: new Date(),
      sessions,
      preferences: aggregatedPreferences,
      totalInteractions,
    };
  }

  /**
   * Delete all user data (GDPR Art. 17 - Right to Erasure)
   */
  async deleteUserData(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);

    // Delete all sessions
    for (const id of sessionIds) {
      await this.redis.del(`${this.prefix}${id}`);
    }

    // Delete user session list
    await this.redis.del(`${this.userPrefix}sessions:${userId}`);

    this.log(`Deleted all data for user: ${userId}`);
  }

  /**
   * Anonymize user data (keep analytics, remove PII)
   */
  async anonymize(userId: string): Promise<AnonymizationResult> {
    const sessions = await this.getUserSessions(userId);
    let sessionsAnonymized = 0;
    const fieldsRemoved: string[] = [];

    for (const session of sessions) {
      // Remove user association
      session.userId = undefined;
      session.anonymous = true;

      // Remove PII from preferences
      if (session.preferences.custom) {
        delete session.preferences.custom;
        if (!fieldsRemoved.includes('preferences.custom')) {
          fieldsRemoved.push('preferences.custom');
        }
      }

      // Remove PII from metadata
      const sensitiveFields = ['email', 'phone', 'name', 'address', 'ip'];
      for (const field of sensitiveFields) {
        if (session.metadata[field]) {
          delete session.metadata[field];
          if (!fieldsRemoved.includes(`metadata.${field}`)) {
            fieldsRemoved.push(`metadata.${field}`);
          }
        }
      }

      // Anonymize conversation content (remove specific user mentions)
      for (const msg of session.conversationHistory) {
        if (msg.metadata) {
          delete msg.metadata.userAgent;
          delete msg.metadata.ipAddress;
        }
      }

      // Add anonymization marker
      session.metadata.anonymized = true;
      session.metadata.anonymizedAt = new Date().toISOString();

      await this.save(session);
      sessionsAnonymized++;
    }

    // Remove user session tracking
    await this.redis.del(`${this.userPrefix}sessions:${userId}`);

    return {
      sessionsAnonymized,
      fieldsRemoved,
      anonymizedAt: new Date(),
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private serialize(session: Session): string {
    return JSON.stringify(session);
  }

  private deserialize(data: string): Session {
    const session = JSON.parse(data) as Session;
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.updatedAt = new Date(session.updatedAt);
    session.expiresAt = new Date(session.expiresAt);
    
    // Convert message timestamps
    for (const msg of session.conversationHistory) {
      msg.timestamp = new Date(msg.timestamp);
    }
    
    return session;
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[SessionManager] ${message}`);
    }
  }
}

