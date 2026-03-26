/**
 * @betterdata/commerce-gateway - Session Transfer
 * 
 * Enables cross-platform session continuity.
 * Start a conversation in Claude, continue in ChatGPT.
 * 
 * @license Apache-2.0
 */

import type {
  Session,
  TransferToken,
  LLMProvider,
} from './types';

// ============================================================================
// Transfer Token Generation
// ============================================================================

/**
 * Generate a secure transfer token
 */
export function generateTransferToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
  let token = '';
  
  // Generate 4 groups of 4 characters
  for (let g = 0; g < 4; g++) {
    if (g > 0) token += '-';
    for (let i = 0; i < 4; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return token; // e.g., "ABCD-EFGH-JKLM-NPQR"
}

/**
 * Validate transfer token format
 */
export function isValidTransferToken(token: string): boolean {
  return /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/i.test(token);
}

// ============================================================================
// Session Transfer Logic
// ============================================================================

/**
 * Prepare session data for transfer
 */
export function prepareSessionForTransfer(
  session: Session,
  targetProvider: LLMProvider
): Partial<Session> {
  return {
    // Preserve cart
    cart: session.cart,
    
    // Preserve preferences
    preferences: session.preferences,
    
    // Preserve conversation history (last 20 messages)
    conversationHistory: session.conversationHistory.slice(-20),
    
    // Preserve user association
    userId: session.userId,
    organizationId: session.organizationId,
    
    // Update provider
    llmProvider: targetProvider,
    
    // Mark original provider
    originalProvider: session.llmProvider,
    
    // Preserve anonymous status
    anonymous: session.anonymous,
    
    // Transfer metadata (selective)
    metadata: {
      ...session.metadata,
      transferredFrom: session.llmProvider,
      transferredAt: new Date().toISOString(),
      originalSessionId: session.id,
    },
  };
}

/**
 * Format conversation history for new provider
 */
export function formatHistoryForProvider(
  history: Session['conversationHistory'],
  _targetProvider: LLMProvider
): Session['conversationHistory'] {
  // Different providers may have different message format requirements
  return history.map(msg => ({
    ...msg,
    // Ensure content is string
    content: typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content),
    // Add transfer metadata
    metadata: {
      ...msg.metadata,
      transferred: true,
    },
  }));
}

/**
 * Create transfer summary for user
 */
export function createTransferSummary(
  originalSession: Session,
  newSession: Session
): string {
  const itemCount = originalSession.cart?.itemCount ?? 0;
  const historyCount = originalSession.conversationHistory.length;
  
  return `Session transferred from ${originalSession.llmProvider} to ${newSession.llmProvider}:
- Cart: ${itemCount} item${itemCount !== 1 ? 's' : ''} transferred
- Conversation: ${historyCount} message${historyCount !== 1 ? 's' : ''} transferred
- Preferences: Preserved

Continue where you left off!`;
}

// ============================================================================
// Transfer Token Store Interface
// ============================================================================

export interface TransferTokenStore {
  /**
   * Store a transfer token
   */
  create(token: TransferToken): Promise<void>;
  
  /**
   * Get and validate a transfer token
   */
  get(token: string): Promise<TransferToken | null>;
  
  /**
   * Delete a transfer token (after use)
   */
  delete(token: string): Promise<void>;
  
  /**
   * Check if token exists
   */
  exists(token: string): Promise<boolean>;
}

/**
 * In-memory transfer token store
 */
export class InMemoryTransferTokenStore implements TransferTokenStore {
  private tokens: Map<string, TransferToken> = new Map();

  async create(token: TransferToken): Promise<void> {
    this.tokens.set(token.token, token);
  }

  async get(token: string): Promise<TransferToken | null> {
    const stored = this.tokens.get(token.toUpperCase());
    if (!stored) return null;
    
    // Check expiry
    if (new Date() > stored.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    
    return stored;
  }

  async delete(token: string): Promise<void> {
    this.tokens.delete(token.toUpperCase());
  }

  async exists(token: string): Promise<boolean> {
    return this.tokens.has(token.toUpperCase());
  }
}

