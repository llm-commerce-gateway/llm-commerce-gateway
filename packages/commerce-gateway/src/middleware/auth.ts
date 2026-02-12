import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ToolContext } from '../types/index';

// ============================================================================
// AuthAdapter Interface (OSS Extraction)
// ============================================================================

/**
 * Auth adapter interface — OSS packages provide a default,
 * proprietary packages inject their implementation.
 */
export interface AuthAdapter {
  /**
   * Validate an API key and return the associated org context.
   * Returns null if the key is invalid.
   */
  validateApiKey(apiKey: string): Promise<AuthResult | null>;
}

export interface AuthResult {
  organizationId: string;
  organizationName?: string;
  tier?: string;
  permissions?: string[];
}

/**
 * OSS default: static API key from environment variable.
 * No database dependency. Works standalone.
 */
export class EnvAuthAdapter implements AuthAdapter {
  async validateApiKey(apiKey: string): Promise<AuthResult | null> {
    const expected = process.env.LLM_GATEWAY_API_KEY;
    if (!expected || apiKey !== expected) return null;
    return {
      organizationId: process.env.LLM_GATEWAY_ORG_ID || 'default',
      organizationName: process.env.LLM_GATEWAY_ORG_NAME || 'Self-Hosted',
      tier: 'oss',
      permissions: ['read', 'write'],
    };
  }
}

// ============================================================================
// Types
// ============================================================================

interface AuthConfig {
  requireAuth?: boolean;
  allowedProviders?: string[];
  /** Pluggable auth adapter. Defaults to EnvAuthAdapter. */
  authAdapter?: AuthAdapter;
}

interface APIKeyPayload {
  organizationId: string;
  permissions: string[];
  rateLimit?: number;
}

interface SessionPayload {
  userId: string;
  organizationId?: string;
  email?: string;
}

// ============================================================================
// API Key Authentication
// ============================================================================

/**
 * Validate API key via the configured adapter.
 * Uses authAdapter when provided, otherwise EnvAuthAdapter.
 */
async function validateAPIKeyWithAdapter(
  apiKey: string,
  adapter: AuthAdapter,
): Promise<APIKeyPayload | null> {
  const result = await adapter.validateApiKey(apiKey);
  if (!result) return null;
  return {
    organizationId: result.organizationId,
    permissions: result.permissions ?? ['read'],
    rateLimit: undefined,
  };
}

// ============================================================================
// Session Authentication (OAuth/JWT)
// ============================================================================

/**
 * Validate session token and return user context
 * Note: For full session validation, integrate with NextAuth session verification
 */
async function validateSession(_token: string): Promise<SessionPayload | null> {
  try {
    // For now, return null to require API key authentication
    // TODO: Integrate with NextAuth session verification when needed
    // The auth package uses NextAuth which handles sessions differently
    // This would need to use getServerSession or similar
    console.warn('Session token validation not yet implemented - use API key authentication');
    return null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Main authentication middleware
 * Supports both API key and session-based authentication
 */
export const authMiddleware = (config: AuthConfig = {}) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const apiKey = c.req.header('X-API-Key');
    const sessionCookie = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

    let toolContext: Partial<ToolContext> = {
      requestId: c.req.header('X-Request-ID') ?? crypto.randomUUID(),
      userAgent: c.req.header('User-Agent'),
      ip: c.req.header('X-Forwarded-For') ?? c.req.header('X-Real-IP'),
    };

    // Try API key authentication first
    const adapter = config.authAdapter ?? new EnvAuthAdapter();
    if (apiKey) {
      const payload = await validateAPIKeyWithAdapter(apiKey, adapter);
      if (payload) {
        toolContext.organizationId = payload.organizationId;
        c.set('auth', { type: 'apiKey', payload });
        c.set('toolContext', toolContext);
        return next();
      }
    }

    // Try Bearer token authentication
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await validateSession(token);
      if (payload) {
        toolContext.userId = payload.userId;
        toolContext.organizationId = payload.organizationId;
        c.set('auth', { type: 'session', payload });
        c.set('toolContext', toolContext);
        return next();
      }
    }

    // Try session cookie
    if (sessionCookie) {
      const payload = await validateSession(sessionCookie);
      if (payload) {
        toolContext.userId = payload.userId;
        toolContext.organizationId = payload.organizationId;
        c.set('auth', { type: 'session', payload });
        c.set('toolContext', toolContext);
        return next();
      }
    }

    // Check if auth is required
    if (config.requireAuth) {
      throw new HTTPException(401, {
        message: 'Authentication required. Provide API key or Bearer token.',
      });
    }

    // Allow anonymous access with generated session
    toolContext.sessionId = c.req.header('X-Session-ID') ?? crypto.randomUUID();
    c.set('auth', { type: 'anonymous' });
    c.set('toolContext', toolContext);
    
    return next();
  });
};

// ============================================================================
// Provider Authentication
// ============================================================================

/**
 * Validate that the request is from an allowed LLM provider
 */
export const providerAuthMiddleware = (allowedProviders: string[] = ['anthropic', 'openai', 'google', 'grok']) => {
  return createMiddleware(async (c: Context, next: Next) => {
    const provider = c.req.header('X-LLM-Provider');
    
    if (!provider) {
      throw new HTTPException(400, {
        message: 'X-LLM-Provider header is required',
      });
    }

    if (!allowedProviders.includes(provider.toLowerCase())) {
      throw new HTTPException(403, {
        message: `Provider "${provider}" is not allowed. Allowed: ${allowedProviders.join(', ')}`,
      });
    }

    c.set('provider', provider.toLowerCase());
    return next();
  });
};

// ============================================================================
// Permission Check
// ============================================================================

/**
 * Check if the authenticated user/API key has required permissions
 */
export function checkPermission(c: Context, requiredPermission: string): boolean {
  const auth = c.get('auth');
  
  if (!auth) {
    return false;
  }

  if (auth.type === 'apiKey') {
    return auth.payload.permissions.includes(requiredPermission) || 
           auth.payload.permissions.includes('*');
  }

  // Session users have full permissions by default
  return auth.type === 'session';
}

/**
 * Permission middleware factory
 */
export const requirePermission = (permission: string) => {
  return createMiddleware(async (c: Context, next: Next) => {
    if (!checkPermission(c, permission)) {
      throw new HTTPException(403, {
        message: `Permission denied. Required: ${permission}`,
      });
    }
    return next();
  });
};

