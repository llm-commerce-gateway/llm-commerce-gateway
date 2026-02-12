/**
 * @betterdata/llm-gateway/session
 * 
 * Production-grade session management with Redis and optional Postgres.
 * 
 * @example
 * ```typescript
 * import { SessionManager } from '@betterdata/llm-gateway/session';
 * 
 * const sessions = new SessionManager({
 *   redis: { url: process.env.REDIS_URL },
 *   ttl: 86400, // 24 hours
 * });
 * 
 * // Create a session
 * const session = await sessions.create({
 *   llmProvider: 'claude',
 *   anonymous: true,
 * });
 * 
 * // Update cart
 * await sessions.updateCart(session.id, cart);
 * 
 * // Transfer to another platform
 * const token = await sessions.createTransferToken(session.id);
 * const newSession = await sessions.transferSession(token, 'openai');
 * ```
 * 
 * @license MIT
 */

// Re-export from existing SessionManager with enhancements
export { 
  SessionManager, 
  createSessionManager,
  RedisSessionStore,
  InMemorySessionStore,
} from './SessionManager';

export type { SessionStore } from './SessionManager';

// Export new types
export type {
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
  RedisConfig,
  PostgresConfig,
} from './types';

// Export transfer utilities
export {
  generateTransferToken,
  isValidTransferToken,
  prepareSessionForTransfer,
  formatHistoryForProvider,
  createTransferSummary,
  InMemoryTransferTokenStore,
} from './transfer';

export type { TransferTokenStore } from './transfer';

// Export enhanced session manager
export { EnhancedSessionManager } from './EnhancedSessionManager';

