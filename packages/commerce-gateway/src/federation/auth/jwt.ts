/**
 * @betterdata/commerce-gateway - Federation JWT Authentication
 *
 * JWT signing and verification utilities for federation trust.
 * Uses Ed25519 (EdDSA) for secure, compact signatures.
 *
 * @example
 * ```typescript
 * import {
 *   FederationJWTSigner,
 *   FederationJWTVerifier,
 *   generateKeyPair,
 *   exportPublicKeyJWK,
 * } from '@betterdata/commerce-gateway/federation';
 *
 * // Generate keys for a new federation hub
 * const { publicKey, privateKey } = await generateKeyPair();
 * const publicJWK = await exportPublicKeyJWK(publicKey, 'hub-key-1');
 *
 * // Sign requests
 * const signer = new FederationJWTSigner(privateKey, 'hub-key-1');
 * const token = await signer.sign({
 *   iss: 'federation-hub',
 *   aud: 'https://api.vuori.com/llm-gateway',
 *   merchant: 'vuori.com',
 * });
 *
 * // Verify requests (on merchant gateway)
 * const verifier = new FederationJWTVerifier([{ kid: 'hub-key-1', key: publicKey }]);
 * const payload = await verifier.verify(token, 'https://api.vuori.com/llm-gateway');
 * ```
 *
 * @license Apache-2.0
 */

import * as jose from 'jose';
import {
  CONTROL_PLANE_METRICS,
  emitControlPlaneMetric,
  getLogger,
} from '../../observability/index';

const metricsLogger = getLogger('FederationMetrics');

// ============================================================================
// Types
// ============================================================================

/**
 * Key-like type from jose library.
 */
export type KeyLike = jose.KeyLike;

/**
 * JWK type for public key distribution.
 */
export interface FederationJWK {
  /** Key ID */
  kid: string;
  /** Key type (OKP for Ed25519) */
  kty: string;
  /** Algorithm (EdDSA) */
  alg: string;
  /** Curve (Ed25519) */
  crv?: string;
  /** Public key X coordinate (base64url) */
  x?: string;
  /** Key use (sig for signature) */
  use?: string;
}

/**
 * JWT payload for federation requests.
 *
 * This payload is included in JWTs sent between the federation hub
 * and merchant gateways to establish trust.
 */
export interface FederationJWTPayload {
  /** Issuer - who created this token (e.g., "federation-hub" or merchant domain) */
  iss: string;

  /** Audience - intended recipient (target gateway URL) */
  aud: string;

  /** Subject - user ID if known */
  sub?: string;

  /** Session ID - for cart/session continuity */
  sid?: string;

  /** Target merchant domain */
  merchant?: string;

  /** Expiration timestamp (Unix seconds) */
  exp: number;

  /** Issued at timestamp (Unix seconds) */
  iat: number;

  /** Unique token ID - for replay protection */
  jti?: string;

  /** Additional custom claims */
  [key: string]: unknown;
}

/**
 * Options for signing a JWT.
 */
export interface SignOptions {
  /** Expiration time (default: "5m") */
  expiresIn?: string;

  /** Include a unique token ID for replay protection */
  includeJti?: boolean;
}

/**
 * Public key entry for the verifier.
 */
export interface PublicKeyEntry {
  /** Key ID */
  kid: string;
  /** Public key */
  key: KeyLike;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error for JWT-related failures.
 */
export class JWTError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JWTError';
  }
}

/**
 * Token has expired.
 */
export class JWTExpiredError extends JWTError {
  /** When the token expired */
  expiredAt: Date;

  constructor(expiredAt: Date) {
    super(`Token expired at ${expiredAt.toISOString()}`);
    this.name = 'JWTExpiredError';
    this.expiredAt = expiredAt;
  }
}

/**
 * Token signature is invalid.
 */
export class JWTInvalidSignatureError extends JWTError {
  constructor(message?: string) {
    super(message ?? 'Token signature verification failed');
    this.name = 'JWTInvalidSignatureError';
  }
}

/**
 * Token audience does not match expected value.
 */
export class JWTInvalidAudienceError extends JWTError {
  /** Expected audience */
  expected: string;
  /** Actual audience in token */
  actual: string;

  constructor(expected: string, actual: string) {
    super(`Invalid audience: expected "${expected}", got "${actual}"`);
    this.name = 'JWTInvalidAudienceError';
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Token issuer is not trusted.
 */
export class JWTInvalidIssuerError extends JWTError {
  /** Actual issuer in token */
  issuer: string;

  constructor(issuer: string) {
    super(`Untrusted issuer: "${issuer}"`);
    this.name = 'JWTInvalidIssuerError';
    this.issuer = issuer;
  }
}

/**
 * No matching key found for verification.
 */
export class JWTKeyNotFoundError extends JWTError {
  /** Key ID that was not found */
  kid?: string;

  constructor(kid?: string) {
    super(kid ? `No key found with ID: ${kid}` : 'No matching key found');
    this.name = 'JWTKeyNotFoundError';
    this.kid = kid;
  }
}

// ============================================================================
// JWT Signer
// ============================================================================

/**
 * Signs JWTs for federation requests.
 *
 * Uses Ed25519 (EdDSA) for compact, secure signatures.
 *
 * @example
 * ```typescript
 * // Create signer with private key
 * const signer = new FederationJWTSigner(privateKey, 'my-key-1');
 *
 * // Sign a token
 * const token = await signer.sign({
 *   iss: 'federation-hub',
 *   aud: 'https://api.vuori.com/llm-gateway',
 *   merchant: 'vuori.com',
 *   sid: 'session-123',
 * });
 *
 * // Sign with custom expiration
 * const longToken = await signer.sign(payload, { expiresIn: '1h' });
 * ```
 */
export class FederationJWTSigner {
  private privateKey: KeyLike;
  private keyId: string;

  /**
   * Create a new JWT signer.
   *
   * @param privateKey - Ed25519 private key
   * @param keyId - Key ID for the header (kid claim)
   */
  constructor(privateKey: KeyLike, keyId: string) {
    this.privateKey = privateKey;
    this.keyId = keyId;
  }

  /**
   * Sign a JWT with the configured private key.
   *
   * @param payload - JWT payload (without iat/exp)
   * @param options - Signing options
   * @returns Signed JWT string
   *
   * @example
   * ```typescript
   * const token = await signer.sign({
   *   iss: 'federation-hub',
   *   aud: 'https://api.merchant.com/gateway',
   *   merchant: 'merchant.com',
   * });
   * ```
   */
  async sign(
    payload: Omit<FederationJWTPayload, 'iat' | 'exp'>,
    options?: SignOptions
  ): Promise<string> {
    const expiresIn = options?.expiresIn ?? '5m';

    const builder = new jose.SignJWT(payload as jose.JWTPayload)
      .setProtectedHeader({ alg: 'EdDSA', kid: this.keyId })
      .setIssuedAt()
      .setExpirationTime(expiresIn);

    // Add unique token ID if requested
    if (options?.includeJti) {
      builder.setJti(this.generateJti());
    }

    return await builder.sign(this.privateKey);
  }

  /**
   * Generate a unique token ID.
   */
  private generateJti(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  /**
   * Get the key ID for this signer.
   */
  getKeyId(): string {
    return this.keyId;
  }
}

// ============================================================================
// JWT Verifier
// ============================================================================

/**
 * Verifies JWTs from federation requests.
 *
 * Maintains a set of trusted public keys and validates tokens against them.
 *
 * ## Security Model
 *
 * This verifier implements the following security checks:
 * - **Signature verification**: Token must be signed by a trusted key
 * - **Expiration (exp)**: Tokens must not be expired (with clock skew tolerance)
 * - **Audience (aud)**: Token must be intended for this gateway (recommended)
 * - **Issuer (iss)**: Token must come from a trusted issuer (recommended)
 * - **Not Before (nbf)**: If present, token must be valid (with clock skew)
 *
 * ## Replay Protection
 *
 * For additional security, consider:
 * - Keep token expiration short (5 minutes or less)
 * - Track used JTI (token IDs) if `jti` claim is present
 * - Rate limit per issuer/session
 *
 * @example
 * ```typescript
 * // Create verifier with trusted public keys and issuers (RECOMMENDED)
 * const verifier = new FederationJWTVerifier(
 *   [
 *     { kid: 'hub-key-1', key: hubPublicKey },
 *     { kid: 'hub-key-2', key: hubPublicKey2 },
 *   ],
 *   {
 *     trustedIssuers: ['https://hub.example.com'],
 *     requireAudience: true,
 *     clockTolerance: 30, // 30 seconds
 *   }
 * );
 *
 * // Verify a token (ALWAYS pass expected audience)
 * try {
 *   const payload = await verifier.verify(token, 'https://api.mygateway.com');
 *   console.log(`Request from ${payload.iss} for merchant ${payload.merchant}`);
 * } catch (error) {
 *   if (error instanceof JWTExpiredError) {
 *     console.log('Token expired - possible replay attack');
 *   } else if (error instanceof JWTInvalidAudienceError) {
 *     console.log('Token not intended for this gateway');
 *   } else if (error instanceof JWTInvalidIssuerError) {
 *     console.log('Untrusted issuer');
 *   }
 * }
 *
 * // Add a new key during rotation
 * verifier.addKey('hub-key-3', newPublicKey);
 *
 * // Remove old key
 * verifier.removeKey('hub-key-1');
 * ```
 */
export class FederationJWTVerifier {
  private keys: Map<string, KeyLike> = new Map();
  private trustedIssuers?: Set<string>;
  private requireAudience: boolean;
  private clockTolerance: number;

  /**
   * Create a new JWT verifier.
   *
   * @param publicKeys - Array of trusted public keys with key IDs
   * @param options - Verifier options
   */
  constructor(
    publicKeys: PublicKeyEntry[],
    options?: {
      /**
       * List of trusted issuers.
       * SECURITY: Strongly recommended to set this in production.
       * If not set, all issuers are accepted (less secure).
       */
      trustedIssuers?: string[];

      /**
       * Require audience claim to be present and match.
       * SECURITY: Recommended to set to true.
       * @default true
       */
      requireAudience?: boolean;

      /**
       * Clock skew tolerance in seconds.
       * Helps with slight time differences between servers.
       * @default 30
       */
      clockTolerance?: number;
    }
  ) {
    for (const { kid, key } of publicKeys) {
      this.keys.set(kid, key);
    }

    if (options?.trustedIssuers) {
      this.trustedIssuers = new Set(options.trustedIssuers);
    }

    // Security defaults
    this.requireAudience = options?.requireAudience ?? true;
    this.clockTolerance = options?.clockTolerance ?? 30;

    // Warn if no trusted issuers configured
    if (!this.trustedIssuers && process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️  FederationJWTVerifier: No trustedIssuers configured. ' +
          'Consider setting this for production security.'
      );
    }
  }

  /**
   * Verify a JWT and return its payload.
   *
   * SECURITY: Always pass `expectedAudience` in production to prevent
   * tokens intended for other services from being accepted.
   *
   * @param token - JWT string to verify
   * @param expectedAudience - Expected audience (RECOMMENDED for security)
   * @returns Verified JWT payload
   * @throws {JWTExpiredError} Token has expired
   * @throws {JWTInvalidSignatureError} Signature verification failed
   * @throws {JWTInvalidAudienceError} Audience mismatch or missing when required
   * @throws {JWTInvalidIssuerError} Untrusted issuer
   * @throws {JWTKeyNotFoundError} No matching key for verification
   */
  async verify(
    token: string,
    expectedAudience?: string
  ): Promise<FederationJWTPayload> {
    // Security check: warn if audience not provided when required
    if (this.requireAudience && !expectedAudience) {
      console.warn(
        '⚠️  FederationJWTVerifier.verify() called without expectedAudience. ' +
          'Pass your gateway URL to prevent token confusion attacks.'
      );
    }

    // Decode header to get key ID
    const header = jose.decodeProtectedHeader(token);
    const kid = header.kid;

    // Verification options with clock tolerance
    const verifyOptions: jose.JWTVerifyOptions = {
      clockTolerance: this.clockTolerance,
    };

    // Find the key
    let verifyKey: KeyLike | undefined;

    if (kid) {
      verifyKey = this.keys.get(kid);
      if (!verifyKey) {
        throw new JWTKeyNotFoundError(kid);
      }
    } else {
      // No kid in header, try all keys
      for (const key of Array.from(this.keys.values())) {
        try {
          const result = await jose.jwtVerify(token, key, verifyOptions);
          const validated = this.validatePayload(result.payload as FederationJWTPayload, expectedAudience);
          emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.handshakeSuccessTotal, 1);
          return validated;
        } catch {
          // Try next key
        }
      }
      throw new JWTKeyNotFoundError();
    }

    try {
      const { payload } = await jose.jwtVerify(token, verifyKey, verifyOptions);
      const validated = this.validatePayload(payload as FederationJWTPayload, expectedAudience);
      emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.handshakeSuccessTotal, 1);
      return validated;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        const expClaim = jose.decodeJwt(token).exp;
        emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.handshakeFailTotal, 1);
        emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.tokenValidationFailTotal, 1);
        throw new JWTExpiredError(new Date((expClaim ?? 0) * 1000));
      }

      if (
        error instanceof jose.errors.JWSSignatureVerificationFailed ||
        error instanceof jose.errors.JWSInvalid
      ) {
        emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.handshakeFailTotal, 1);
        emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.signatureVerificationFailTotal, 1);
        throw new JWTInvalidSignatureError();
      }

      emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.handshakeFailTotal, 1);
      emitControlPlaneMetric(metricsLogger, CONTROL_PLANE_METRICS.federation.tokenValidationFailTotal, 1);
      throw error;
    }
  }

  /**
   * Validate payload claims.
   */
  private validatePayload(
    payload: FederationJWTPayload,
    expectedAudience?: string
  ): FederationJWTPayload {
    // Check audience - enforce if requireAudience is true
    if (expectedAudience) {
      if (payload.aud !== expectedAudience) {
        throw new JWTInvalidAudienceError(expectedAudience, payload.aud);
      }
    } else if (this.requireAudience && !payload.aud) {
      throw new JWTInvalidAudienceError('(any)', '(none)');
    }

    // Check issuer if trusted list is configured
    if (this.trustedIssuers && !this.trustedIssuers.has(payload.iss)) {
      throw new JWTInvalidIssuerError(payload.iss);
    }

    return payload;
  }

  /**
   * Add a new public key to the verifier.
   *
   * @param kid - Key ID
   * @param key - Public key
   */
  addKey(kid: string, key: KeyLike): void {
    this.keys.set(kid, key);
  }

  /**
   * Remove a public key from the verifier.
   *
   * @param kid - Key ID to remove
   * @returns true if key was found and removed
   */
  removeKey(kid: string): boolean {
    return this.keys.delete(kid);
  }

  /**
   * Check if a key exists.
   *
   * @param kid - Key ID
   * @returns true if key exists
   */
  hasKey(kid: string): boolean {
    return this.keys.has(kid);
  }

  /**
   * Get all key IDs.
   */
  getKeyIds(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Add a trusted issuer.
   */
  addTrustedIssuer(issuer: string): void {
    if (!this.trustedIssuers) {
      this.trustedIssuers = new Set();
    }
    this.trustedIssuers.add(issuer);
  }

  /**
   * Remove a trusted issuer.
   */
  removeTrustedIssuer(issuer: string): boolean {
    return this.trustedIssuers?.delete(issuer) ?? false;
  }
}

// ============================================================================
// Key Generation & Export
// ============================================================================

/**
 * Generate a new Ed25519 key pair for federation signing.
 *
 * ⚠️ PREFER: Use `generateKeyPairDev()` from `@betterdata/commerce-gateway/federation/auth/dev`
 * for clearer intent. This function is kept for backwards compatibility.
 *
 * For production:
 * - Pre-generate keys during setup (not at runtime)
 * - Store private keys in secure key management (AWS KMS, HashiCorp Vault)
 * - Load keys from environment/secrets at startup
 * - Never commit keys to version control
 *
 * @returns Public and private key pair
 *
 * @example
 * ```typescript
 * // ✅ CORRECT: One-time setup script
 * const { publicKey, privateKey } = await generateKeyPair();
 * // Store privateKey securely, share publicKey with partners
 *
 * // ❌ WRONG: Runtime generation
 * app.post('/sign', async () => {
 *   const { privateKey } = await generateKeyPair(); // DON'T DO THIS
 * });
 * ```
 *
 * @deprecated Use `generateKeyPairDev()` from `/auth/dev` for clearer intent
 */
export async function generateKeyPair(): Promise<{
  publicKey: KeyLike;
  privateKey: KeyLike;
}> {
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  generateKeyPair() called in production. ' +
        'Consider pre-generating keys and loading from secure storage.'
    );
  }

  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });

  return { publicKey, privateKey };
}

/**
 * Export a public key as JWK for sharing with federation partners.
 *
 * @param publicKey - Public key to export
 * @param kid - Key ID to include in the JWK
 * @returns JWK representation of the public key
 *
 * @example
 * ```typescript
 * const jwk = await exportPublicKeyJWK(publicKey, 'hub-key-2024');
 * // Share this JWK with merchant gateways
 * console.log(JSON.stringify(jwk));
 * ```
 */
export async function exportPublicKeyJWK(
  publicKey: KeyLike,
  kid: string
): Promise<FederationJWK> {
  const jwk = await jose.exportJWK(publicKey);

  return {
    ...jwk,
    kid,
    alg: 'EdDSA',
    use: 'sig',
  } as FederationJWK;
}

/**
 * Import a JWK as a public key for verification.
 *
 * @param jwk - JWK to import
 * @returns Public key for use with verifier
 *
 * @example
 * ```typescript
 * // Received JWK from federation hub
 * const hubJWK = { kid: 'hub-key-1', kty: 'OKP', crv: 'Ed25519', x: '...' };
 * const publicKey = await importPublicKeyJWK(hubJWK);
 *
 * const verifier = new FederationJWTVerifier([
 *   { kid: hubJWK.kid, key: publicKey },
 * ]);
 * ```
 */
export async function importPublicKeyJWK(jwk: FederationJWK): Promise<KeyLike> {
  const key = await jose.importJWK(jwk as jose.JWK, 'EdDSA');
  // EdDSA always returns KeyLike, not Uint8Array
  return key as KeyLike;
}

/**
 * Export a private key as JWK (for secure storage).
 *
 * WARNING: Private keys should be stored securely and never shared.
 *
 * @param privateKey - Private key to export
 * @param kid - Key ID
 * @returns JWK representation of the private key
 */
export async function exportPrivateKeyJWK(
  privateKey: KeyLike,
  kid: string
): Promise<jose.JWK> {
  const jwk = await jose.exportJWK(privateKey);
  return {
    ...jwk,
    kid,
    alg: 'EdDSA',
    use: 'sig',
  };
}

/**
 * Import a JWK as a private key for signing.
 *
 * @param jwk - JWK to import (must include private key material)
 * @returns Private key for use with signer
 */
export async function importPrivateKeyJWK(jwk: jose.JWK): Promise<KeyLike> {
  const key = await jose.importJWK(jwk, 'EdDSA');
  // EdDSA always returns KeyLike, not Uint8Array
  return key as KeyLike;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Decode a JWT without verification (for inspection only).
 *
 * WARNING: Do not trust claims from an unverified token.
 *
 * @param token - JWT string
 * @returns Decoded payload (unverified)
 */
export function decodeToken(token: string): FederationJWTPayload {
  return jose.decodeJwt(token) as FederationJWTPayload;
}

/**
 * Decode the protected header of a JWT.
 *
 * @param token - JWT string
 * @returns Header with algorithm and key ID
 */
export function decodeHeader(token: string): { alg: string; kid?: string } {
  return jose.decodeProtectedHeader(token) as { alg: string; kid?: string };
}

/**
 * Check if a token is expired (without full verification).
 *
 * @param token - JWT string
 * @returns true if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = jose.decodeJwt(token);
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Get the expiration time of a token.
 *
 * @param token - JWT string
 * @returns Expiration date or null if no exp claim
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const payload = jose.decodeJwt(token);
    if (!payload.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

