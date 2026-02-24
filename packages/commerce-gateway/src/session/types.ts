/**
 * @betterdata/commerce-gateway - Session Types
 * 
 * Type definitions for session management.
 * 
 * @license MIT
 */

import type { CartItem } from '../backends/interfaces';

// ============================================================================
// LLM Providers
// ============================================================================

export type LLMProvider = 'claude' | 'openai' | 'grok' | 'google' | 'custom';

// ============================================================================
// Session Types
// ============================================================================

/**
 * Core session data structure
 */
export interface Session {
  /** Unique session ID */
  id: string;
  
  /** LLM provider (claude, openai, grok, etc.) */
  llmProvider: LLMProvider;
  
  /** User ID if authenticated */
  userId?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Current shopping cart */
  cart?: SessionCart;
  
  /** User preferences */
  preferences: SessionPreferences;
  
  /** Conversation history */
  conversationHistory: SessionMessage[];
  
  /** Custom metadata */
  metadata: Record<string, unknown>;
  
  /** Is anonymous session */
  anonymous: boolean;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
  
  /** Session expiry */
  expiresAt: Date;
  
  /** Transfer token (if pending transfer) */
  transferToken?: string;
  
  /** Original provider before transfer */
  originalProvider?: LLMProvider;
}

/**
 * Session cart (simplified for storage)
 */
export interface SessionCart {
  id: string;
  items: CartItem[];
  subtotal: number;
  currency: string;
  itemCount: number;
  reservedUntil?: Date;
  checkoutUrl?: string;
}

/**
 * User preferences stored in session
 */
export interface SessionPreferences {
  /** Preferred language */
  language?: string;
  
  /** Preferred currency */
  currency?: string;
  
  /** Communication style */
  communicationStyle?: 'formal' | 'casual' | 'concise';
  
  /** Product interests */
  interests?: string[];
  
  /** Price range */
  priceRange?: {
    min?: number;
    max?: number;
  };
  
  /** Custom preferences */
  custom?: Record<string, unknown>;
}

/**
 * Message in conversation history
 */
export interface SessionMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system' | 'tool';
  
  /** Message content */
  content: string;
  
  /** Tool calls (if any) */
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }>;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Session Manager Configuration
// ============================================================================

/**
 * Redis configuration
 */
export interface RedisConfig {
  /** Redis URL */
  url: string;
  
  /** Auth token (for Upstash) */
  token?: string;
  
  /** Key prefix */
  prefix?: string;
  
  /** Connection name */
  name?: string;
}

/**
 * Postgres configuration (for historical data)
 */
export interface PostgresConfig {
  /** Connection string */
  connectionString: string;
  
  /** Pool size */
  poolSize?: number;
  
  /** Table name */
  tableName?: string;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  /** Redis configuration (required) */
  redis: RedisConfig;
  
  /** Postgres configuration (optional) */
  postgres?: PostgresConfig;
  
  /** Session TTL in seconds (default: 86400 = 24 hours) */
  ttl?: number;
  
  /** Maximum conversation history length */
  maxHistoryLength?: number;
  
  /** Enable session transfer */
  enableTransfer?: boolean;
  
  /** Transfer token TTL in seconds (default: 300 = 5 minutes) */
  transferTokenTTL?: number;
  
  /** Debug mode */
  debug?: boolean;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  /** Custom session ID */
  sessionId?: string;
  
  /** LLM provider */
  llmProvider?: LLMProvider;
  
  /** Is anonymous session */
  anonymous?: boolean;
  
  /** User ID */
  userId?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Initial cart */
  cart?: SessionCart;
  
  /** Initial preferences */
  preferences?: Partial<SessionPreferences>;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Transfer Types
// ============================================================================

/**
 * Session transfer token
 */
export interface TransferToken {
  /** Token ID */
  token: string;
  
  /** Original session ID */
  sessionId: string;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Expiry timestamp */
  expiresAt: Date;
  
  /** Target provider (if specified) */
  targetProvider?: LLMProvider;
}

/**
 * Transfer result
 */
export interface TransferResult {
  /** New session */
  session: Session;
  
  /** Was cart transferred */
  cartTransferred: boolean;
  
  /** Was history transferred */
  historyTransferred: boolean;
  
  /** Transfer timestamp */
  transferredAt: Date;
}

// ============================================================================
// GDPR Types
// ============================================================================

/**
 * User data export
 */
export interface UserDataExport {
  /** User ID */
  userId: string;
  
  /** Export timestamp */
  exportedAt: Date;
  
  /** Sessions */
  sessions: Session[];
  
  /** Order history (if available) */
  orders?: unknown[];
  
  /** Preferences across sessions */
  preferences: SessionPreferences;
  
  /** Total interactions */
  totalInteractions: number;
}

/**
 * Anonymization result
 */
export interface AnonymizationResult {
  /** Number of sessions anonymized */
  sessionsAnonymized: number;
  
  /** Fields removed */
  fieldsRemoved: string[];
  
  /** Anonymization timestamp */
  anonymizedAt: Date;
}

