/**
 * @betterdata/llm-gateway - Federation Auth Development Utilities
 *
 * ⚠️ DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION ⚠️
 *
 * This module contains key generation utilities intended ONLY for:
 * - Local development and testing
 * - Initial key generation during setup
 * - CI/CD pipeline key rotation scripts
 *
 * NEVER:
 * - Generate keys at runtime in production
 * - Store generated private keys in code or version control
 * - Use these functions in request handlers
 *
 * For production, use:
 * - Pre-generated keys stored in secure key management (AWS KMS, HashiCorp Vault, etc.)
 * - Environment variables with proper secret rotation
 * - The "bring your own key" pattern with FederationJWTSigner/Verifier
 *
 * @example
 * ```typescript
 * // ✅ CORRECT: One-time key generation during setup
 * // Run this script once, then store keys securely
 *
 * import { generateKeyPairDev, exportKeysDev } from '@betterdata/llm-gateway/federation/auth/dev';
 *
 * async function generateFederationKeys() {
 *   const { publicKey, privateKey } = await generateKeyPairDev();
 *   const { publicJWK, privateJWK } = await exportKeysDev(publicKey, privateKey, 'hub-key-1');
 *
 *   console.log('PUBLIC KEY (share with merchants):');
 *   console.log(JSON.stringify(publicJWK, null, 2));
 *
 *   console.log('\nPRIVATE KEY (store securely, NEVER commit):');
 *   console.log(JSON.stringify(privateJWK, null, 2));
 * }
 * ```
 *
 * @example
 * ```typescript
 * // ❌ WRONG: Generating keys at runtime
 * app.post('/api/sign', async (req, res) => {
 *   const { privateKey } = await generateKeyPairDev(); // DON'T DO THIS
 *   // ...
 * });
 * ```
 *
 * @license MIT
 */

import * as jose from 'jose';
import type { KeyLike } from './jwt';
import { FederationJWK } from './jwt';

// ============================================================================
// Development Key Generation
// ============================================================================

/**
 * Generate a new Ed25519 key pair for federation signing.
 *
 * ⚠️ DEVELOPMENT ONLY - Use for initial setup, not runtime key generation.
 *
 * For production:
 * 1. Run this once during setup
 * 2. Store private key in secure key management (AWS KMS, HashiCorp Vault)
 * 3. Share public key (JWK) with federation partners
 * 4. Load keys from environment/secrets at startup
 *
 * @returns Public and private key pair
 *
 * @example
 * ```typescript
 * // Run once during initial setup
 * const { publicKey, privateKey } = await generateKeyPairDev();
 * ```
 */
export async function generateKeyPairDev(): Promise<{
  publicKey: KeyLike;
  privateKey: KeyLike;
}> {
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  WARNING: generateKeyPairDev() called in production. ' +
        'For production, pre-generate keys and load from secure storage.'
    );
  }

  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });

  return { publicKey, privateKey };
}

/**
 * Export both public and private keys as JWKs.
 *
 * ⚠️ DEVELOPMENT ONLY - Private key export is for secure storage setup.
 *
 * @param publicKey - Public key to export
 * @param privateKey - Private key to export
 * @param kid - Key ID to include in both JWKs
 * @returns Both JWKs for storage
 */
export async function exportKeysDev(
  publicKey: KeyLike,
  privateKey: KeyLike,
  kid: string
): Promise<{
  publicJWK: FederationJWK;
  privateJWK: jose.JWK;
}> {
  const publicJWK = await jose.exportJWK(publicKey);
  const privateJWK = await jose.exportJWK(privateKey);

  return {
    publicJWK: {
      ...publicJWK,
      kid,
      alg: 'EdDSA',
      use: 'sig',
    } as FederationJWK,
    privateJWK: {
      ...privateJWK,
      kid,
      alg: 'EdDSA',
      use: 'sig',
    },
  };
}

/**
 * Generate keys and output to console for manual storage.
 *
 * ⚠️ DEVELOPMENT ONLY - Run once during setup.
 *
 * @param kid - Key ID for the generated keys
 */
export async function generateAndPrintKeys(kid: string): Promise<void> {
  console.log('🔐 Generating Ed25519 key pair for Federation Hub...\n');

  const { publicKey, privateKey } = await generateKeyPairDev();
  const { publicJWK, privateJWK } = await exportKeysDev(publicKey, privateKey, kid);

  console.log('═'.repeat(60));
  console.log('PUBLIC KEY (share with merchant gateways)');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(publicJWK, null, 2));

  console.log('\n' + '═'.repeat(60));
  console.log('⚠️  PRIVATE KEY (store in secure key management)');
  console.log('═'.repeat(60));
  console.log(JSON.stringify(privateJWK, null, 2));

  console.log('\n' + '─'.repeat(60));
  console.log('Next steps:');
  console.log('1. Store PRIVATE KEY in AWS KMS, HashiCorp Vault, or similar');
  console.log('2. Set FEDERATION_PRIVATE_KEY env var from secure storage');
  console.log('3. Share PUBLIC KEY with merchant gateway operators');
  console.log('4. Never commit either key to version control');
  console.log('─'.repeat(60));
}

// ============================================================================
// Key Rotation Utilities
// ============================================================================

/**
 * Generate a new key pair for rotation.
 *
 * ⚠️ DEVELOPMENT ONLY - For key rotation scripts.
 *
 * @param currentKid - Current key ID
 * @returns New key pair with incremented key ID
 */
export async function generateRotationKeyPairDev(currentKid: string): Promise<{
  publicKey: KeyLike;
  privateKey: KeyLike;
  newKid: string;
}> {
  // Parse current kid and increment
  const match = currentKid.match(/^(.+)-(\d+)$/);
  let newKid: string;

  if (match) {
    const [, prefix, num] = match;
    newKid = `${prefix}-${parseInt(num ?? '0') + 1}`;
  } else {
    newKid = `${currentKid}-2`;
  }

  const { publicKey, privateKey } = await generateKeyPairDev();

  return { publicKey, privateKey, newKid };
}

