/**
 * @betterdata/commerce-gateway - JWT Strategy
 * 
 * JSON Web Token authentication for stateless auth.
 * 
 * @license MIT
 */

import type {
  JWTConfig,
  AuthUser,
  AuthRequest,
  AuthStrategyContext,
} from '../types';

// ============================================================================
// JWT Types
// ============================================================================

interface JWTHeader {
  alg: string;
  typ: 'JWT';
}

interface JWTPayload {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  email?: string;
  name?: string;
  roles?: string[];
  organizationId?: string;
  [key: string]: unknown;
}

/** JWT payload for creating tokens (sub is required) */
type JWTCreatePayload = Omit<JWTPayload, 'iat' | 'exp'> & { sub: string };

// ============================================================================
// Base64URL Encoding/Decoding
// ============================================================================

function base64UrlEncode(data: string): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64').toString('utf-8');
}

// ============================================================================
// HMAC Signing (HS256)
// ============================================================================

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  const signatureArray = new Uint8Array(signature);
  const base64 = Buffer.from(signatureArray).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await hmacSign(data, secret);
  
  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  return result === 0;
}

// ============================================================================
// JWT Strategy
// ============================================================================

/**
 * JWT authentication strategy
 */
export class JWTStrategy {
  private config: Required<JWTConfig>;

  constructor(config: JWTConfig) {
    this.config = {
      secret: config.secret,
      algorithm: config.algorithm ?? 'HS256',
      issuer: config.issuer ?? '',
      audience: config.audience ?? '',
      expiresIn: config.expiresIn ?? 86400, // 24 hours
    };

    // Only HS256 is supported in this implementation
    if (this.config.algorithm !== 'HS256') {
      console.warn(`JWT algorithm ${this.config.algorithm} not supported, using HS256`);
      this.config.algorithm = 'HS256';
    }
  }

  /**
   * Create a new JWT
   */
  async createToken(payload: JWTCreatePayload): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const fullPayload: JWTPayload = {
      ...payload,
      sub: payload.sub,
      iat: now,
      exp: now + this.config.expiresIn,
    };

    if (this.config.issuer) {
      fullPayload.iss = this.config.issuer;
    }

    if (this.config.audience) {
      fullPayload.aud = this.config.audience;
    }

    const header: JWTHeader = {
      alg: this.config.algorithm,
      typ: 'JWT',
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
    const dataToSign = `${headerEncoded}.${payloadEncoded}`;

    const signature = await hmacSign(dataToSign, this.config.secret);

    return `${dataToSign}.${signature}`;
  }

  /**
   * Verify and decode a JWT
   */
  async verifyToken(token: string): Promise<JWTPayload | null> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    if (!headerEncoded || !payloadEncoded || !signature) {
      return null;
    }
    const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

    // Verify signature
    const isValid = await hmacVerify(dataToVerify, signature, this.config.secret);
    if (!isValid) {
      return null;
    }

    // Decode payload
    let payload: JWTPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JWTPayload;
    } catch {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      return null;
    }

    // Check issuer
    if (this.config.issuer && payload.iss !== this.config.issuer) {
      return null;
    }

    // Check audience
    if (this.config.audience && payload.aud !== this.config.audience) {
      return null;
    }

    return payload;
  }

  /**
   * Extract token from request
   */
  extractToken(request: AuthRequest): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7);
    }

    // Check query param as fallback (for WebSocket connections)
    return request.query?.['token'] ?? null;
  }

  /**
   * Validate request and return user context
   */
  async validate(
    request: AuthRequest,
    _context?: AuthStrategyContext
  ): Promise<AuthUser | null> {
    const token = this.extractToken(request);
    if (!token) return null;

    const payload = await this.verifyToken(token);
    if (!payload) return null;

    return {
      id: payload.sub ?? '',
      email: payload.email,
      name: payload.name,
      organizationId: payload.organizationId,
      roles: payload.roles,
      authMethod: 'jwt',
      anonymous: false,
      claims: payload,
    };
  }

  /**
   * Decode token without verification (for inspection)
   */
  decodeToken(token: string): JWTPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadEncoded = parts[1];
    if (!payloadEncoded) {
      return null;
    }

    try {
      return JSON.parse(base64UrlDecode(payloadEncoded)) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh a token (create new with same claims)
   */
  async refreshToken(token: string): Promise<string | null> {
    const payload = await this.verifyToken(token);
    if (!payload) return null;

    // Remove standard claims that will be regenerated
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iat, exp, nbf, ...claims } = payload;

    return this.createToken(claims);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a JWT strategy
 */
export function createJWTStrategy(config: JWTConfig): JWTStrategy {
  return new JWTStrategy(config);
}

/**
 * Generate a secure secret for JWT signing
 */
export function generateJWTSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

