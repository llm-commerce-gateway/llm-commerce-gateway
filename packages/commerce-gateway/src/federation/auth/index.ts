/**
 * @betterdata/commerce-gateway - Federation Authentication Module
 *
 * JWT signing and verification utilities for establishing trust
 * between the federation hub and merchant gateways.
 *
 * ## Security Model
 *
 * **Hub (Signer)**: The federation hub signs requests to merchant gateways.
 * - Uses a private key stored in secure key management
 * - Signs short-lived tokens (5 minutes by default)
 *
 * **Merchant Gateway (Verifier)**: Merchant gateways verify hub requests.
 * - Maintains a list of trusted hub public keys
 * - Validates audience, issuer, and expiration
 *
 * ## Key Management Best Practices
 *
 * 1. **Generate keys offline** using the dev utilities
 * 2. **Store private keys** in AWS KMS, HashiCorp Vault, or similar
 * 3. **Share public keys** (JWKs) with federation partners
 * 4. **Rotate keys** periodically using key ID (kid) versioning
 * 5. **Never** commit keys to version control
 *
 * @example
 * ```typescript
 * // Hub side: Sign requests
 * import { FederationJWTSigner, importPrivateKeyJWK } from '@betterdata/commerce-gateway/federation';
 *
 * const privateKey = await importPrivateKeyJWK(JSON.parse(process.env.PRIVATE_KEY_JWK!));
 * const signer = new FederationJWTSigner(privateKey, 'hub-key-1');
 *
 * const token = await signer.sign({
 *   iss: 'https://hub.example.com',
 *   aud: 'https://api.merchant.com',
 *   merchant: 'merchant.com',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Merchant side: Verify requests (SECURITY: always configure trustedIssuers)
 * import { FederationJWTVerifier, importPublicKeyJWK } from '@betterdata/commerce-gateway/federation';
 *
 * const hubPublicKey = await importPublicKeyJWK(hubJWK);
 * const verifier = new FederationJWTVerifier(
 *   [{ kid: 'hub-key-1', key: hubPublicKey }],
 *   {
 *     trustedIssuers: ['https://hub.example.com'],
 *     requireAudience: true,
 *   }
 * );
 *
 * const payload = await verifier.verify(token, 'https://api.merchant.com');
 * ```
 *
 * @license Apache-2.0
 */

// ============================================================================
// JWT Exports (Production)
// ============================================================================

export {
  // Classes
  FederationJWTSigner,
  FederationJWTVerifier,

  // Error classes
  JWTError,
  JWTExpiredError,
  JWTInvalidSignatureError,
  JWTInvalidAudienceError,
  JWTInvalidIssuerError,
  JWTKeyNotFoundError,

  // Key import/export (for production "bring your own key")
  exportPublicKeyJWK,
  importPublicKeyJWK,
  exportPrivateKeyJWK,
  importPrivateKeyJWK,

  // Utility functions
  decodeToken,
  decodeHeader,
  isTokenExpired,
  getTokenExpiration,

  // Key generation (kept for backwards compat, prefer dev module)
  generateKeyPair,

  // Types
  type KeyLike,
  type FederationJWK,
  type FederationJWTPayload,
  type SignOptions,
  type PublicKeyEntry,
} from './jwt';

// ============================================================================
// Development Utilities (explicit import for key generation)
// ============================================================================

// Key generation utilities are available from:
// import { generateKeyPairDev } from '@betterdata/commerce-gateway/federation/auth/dev'
//
// This separation makes it clear that key generation is a setup-time operation,
// not something to be done at runtime.
