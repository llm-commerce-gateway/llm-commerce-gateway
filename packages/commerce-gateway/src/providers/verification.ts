/**
 * @betterdata/commerce-gateway - Verification Provider Interface
 *
 * Verifies merchant domain ownership for trust establishment.
 * OSS: TrustAllProvider (no verification, for dev)
 * Cloud: Full DNS, meta tag, well-known file verification
 *
 * @example
 * ```typescript
 * import type { VerificationProvider } from '@betterdata/commerce-gateway/providers';
 *
 * class MyVerificationProvider implements VerificationProvider {
 *   async initiateChallenge(domain, method) {
 *     // Generate challenge
 *     return { id: '...', domain, method, instructions: '...', value: '...' };
 *   }
 * }
 * ```
 *
 * @license MIT
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Verification method options.
 */
export type VerificationMethod = 'dns' | 'meta_tag' | 'well_known' | 'api_callback';

/**
 * Challenge state.
 */
export type ChallengeStatus = 'pending' | 'verified' | 'failed' | 'expired';

/**
 * Verification challenge.
 */
export interface Challenge {
  /** Unique challenge ID */
  id: string;

  /** Domain being verified */
  domain: string;

  /** Verification method */
  method: VerificationMethod;

  /** Human-readable instructions */
  instructions: string;

  /**
   * The value to be placed.
   * - DNS: TXT record value
   * - Meta tag: content attribute value
   * - Well-known: file contents
   * - API callback: expected response
   */
  value: string;

  /** Where to place the value */
  placement?: {
    /** For DNS: record name (e.g., "_betterdata-verification") */
    recordName?: string;

    /** For meta tag: tag name */
    tagName?: string;

    /** For well-known: file path */
    filePath?: string;

    /** For API: callback URL */
    callbackUrl?: string;
  };

  /** When the challenge expires (ISO format) */
  expiresAt: string;

  /** Current status */
  status: ChallengeStatus;

  /** When the challenge was created */
  createdAt: string;

  /** When the challenge was last checked */
  lastCheckedAt?: string;
}

/**
 * Result of checking a challenge.
 */
export interface ChallengeResult {
  /** Whether the domain is verified */
  verified: boolean;

  /** Verification method used */
  method: VerificationMethod;

  /** When verification completed (if verified) */
  verifiedAt?: string;

  /** Error message (if failed) */
  error?: string;

  /** Number of check attempts */
  attempts?: number;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Verification Provider Interface.
 *
 * Implement this to add domain verification for merchant trust.
 * The provider manages challenge generation, checking, and status.
 *
 * @example
 * ```typescript
 * // OSS baseline (no verification)
 * class TrustAllVerificationProvider implements VerificationProvider {
 *   async initiateChallenge(domain, method) {
 *     return {
 *       id: 'trust-all',
 *       domain,
 *       method,
 *       instructions: 'No verification required in dev mode',
 *       value: 'trusted',
 *       expiresAt: new Date(Date.now() + 86400000).toISOString(),
 *       status: 'verified',
 *       createdAt: new Date().toISOString(),
 *     };
 *   }
 *
 *   async checkChallenge() {
 *     return { verified: true, method: 'api_callback' };
 *   }
 * }
 *
 * // Cloud implementation
 * class BetterDataVerificationProvider implements VerificationProvider {
 *   async initiateChallenge(domain, method) {
 *     // Generate unique challenge value
 *     // Store in database
 *     // Return challenge with instructions
 *   }
 *
 *   async checkChallenge(challengeId) {
 *     // Fetch challenge from DB
 *     // Check DNS/meta/well-known/callback
 *     // Update status
 *     // Return result
 *   }
 * }
 * ```
 */
export interface VerificationProvider {
  /**
   * Initiate a new verification challenge.
   *
   * @param domain - Domain to verify
   * @param method - Verification method to use
   * @returns Challenge with instructions
   */
  initiateChallenge(domain: string, method: VerificationMethod): Promise<Challenge>;

  /**
   * Check if a challenge has been completed.
   *
   * @param challengeId - Challenge ID to check
   * @returns Verification result
   */
  checkChallenge(challengeId: string): Promise<ChallengeResult>;

  /**
   * Cancel a pending challenge.
   *
   * @param challengeId - Challenge ID to cancel
   */
  cancelChallenge(challengeId: string): Promise<void>;

  /**
   * Get an existing challenge by ID.
   */
  getChallenge?(challengeId: string): Promise<Challenge | null>;

  /**
   * Get all pending challenges for a domain.
   */
  getPendingChallenges?(domain: string): Promise<Challenge[]>;

  /**
   * Optional: Health check for the verification service.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

// ============================================================================
// Baseline Implementation
// ============================================================================

/**
 * Trust-all verification provider for development.
 *
 * Immediately marks all domains as verified without any actual verification.
 * ONLY use in development - never in production.
 */
export class TrustAllVerificationProvider implements VerificationProvider {
  private challenges: Map<string, Challenge> = new Map();

  async initiateChallenge(
    domain: string,
    method: VerificationMethod
  ): Promise<Challenge> {
    const challenge: Challenge = {
      id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      domain,
      method,
      instructions: 'Development mode: No verification required. Domain automatically trusted.',
      value: 'trusted',
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      status: 'verified', // Immediately verified in dev
      createdAt: new Date().toISOString(),
    };

    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  async checkChallenge(challengeId: string): Promise<ChallengeResult> {
    const challenge = this.challenges.get(challengeId);

    if (!challenge) {
      return {
        verified: false,
        method: 'api_callback',
        error: 'Challenge not found',
      };
    }

    return {
      verified: true,
      method: challenge.method,
      verifiedAt: new Date().toISOString(),
    };
  }

  async cancelChallenge(challengeId: string): Promise<void> {
    this.challenges.delete(challengeId);
  }

  async getChallenge(challengeId: string): Promise<Challenge | null> {
    return this.challenges.get(challengeId) ?? null;
  }

  async getPendingChallenges(domain: string): Promise<Challenge[]> {
    return Array.from(this.challenges.values()).filter(
      c => c.domain === domain && c.status === 'pending'
    );
  }
}
