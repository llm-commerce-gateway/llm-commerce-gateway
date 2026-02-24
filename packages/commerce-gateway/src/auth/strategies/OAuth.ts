/**
 * @betterdata/commerce-gateway - OAuth Strategy
 * 
 * OAuth 2.0 authentication with support for Google, GitHub, and custom providers.
 * 
 * @license MIT
 */

import type {
  OAuthConfig,
  OAuthProviderConfig,
  AuthUser,
  AuthRequest,
  AuthStrategyContext,
} from '../types';

// ============================================================================
// OAuth Provider Defaults
// ============================================================================

const GOOGLE_CONFIG = {
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scopes: ['openid', 'email', 'profile'],
};

const GITHUB_CONFIG = {
  authorizationUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scopes: ['read:user', 'user:email'],
};

// ============================================================================
// OAuth Token Response
// ============================================================================

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url?: string;
}

// ============================================================================
// OAuth Strategy
// ============================================================================

/**
 * OAuth 2.0 authentication strategy
 */
export class OAuthStrategy {
  private providers: Map<string, OAuthProviderConfig>;

  constructor(config: OAuthConfig) {
    this.providers = new Map();

    // Initialize Google if configured
    if (config.google) {
      this.providers.set('google', {
        ...GOOGLE_CONFIG,
        ...config.google,
      });
    }

    // Initialize GitHub if configured
    if (config.github) {
      this.providers.set('github', {
        ...GITHUB_CONFIG,
        ...config.github,
      });
    }

    // Initialize custom providers
    if (config.custom) {
      for (const [name, providerConfig] of Object.entries(config.custom)) {
        this.providers.set(name, providerConfig);
      }
    }
  }

  /**
   * Get available OAuth providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get authorization URL for a provider
   */
  getAuthorizationUrl(
    provider: string,
    state: string,
    redirectUri?: string
  ): string {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: redirectUri ?? providerConfig.callbackUrl ?? '',
      response_type: 'code',
      scope: (providerConfig.scopes ?? []).join(' '),
      state,
    });

    return `${providerConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    provider: string,
    code: string,
    redirectUri?: string
  ): Promise<OAuthTokenResponse> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    const response = await fetch(providerConfig.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri ?? providerConfig.callbackUrl ?? '',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    return response.json() as Promise<OAuthTokenResponse>;
  }

  /**
   * Get user info from provider
   */
  async getUserInfo(
    provider: string,
    accessToken: string
  ): Promise<AuthUser> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig?.userInfoUrl) {
      throw new Error(`OAuth provider not configured: ${provider}`);
    }

    const response = await fetch(providerConfig.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    const userInfo = await response.json();
    return this.mapUserInfo(provider, userInfo);
  }

  /**
   * Map provider-specific user info to AuthUser
   */
  private mapUserInfo(provider: string, userInfo: unknown): AuthUser {
    switch (provider) {
      case 'google': {
        const info = userInfo as GoogleUserInfo;
        return {
          id: `google_${info.id}`,
          email: info.email,
          name: info.name,
          authMethod: 'oauth',
          anonymous: false,
          claims: {
            provider: 'google',
            picture: info.picture,
            verified: info.verified_email,
          },
        };
      }

      case 'github': {
        const info = userInfo as GitHubUserInfo;
        return {
          id: `github_${info.id}`,
          email: info.email,
          name: info.name || info.login,
          authMethod: 'oauth',
          anonymous: false,
          claims: {
            provider: 'github',
            username: info.login,
            avatar: info.avatar_url,
          },
        };
      }

      default: {
        // Generic mapping for custom providers
        const info = userInfo as Record<string, unknown>;
        return {
          id: `${provider}_${info.id ?? info.sub ?? 'unknown'}`,
          email: info.email as string | undefined,
          name: (info.name ?? info.username ?? info.login) as string | undefined,
          authMethod: 'oauth',
          anonymous: false,
          claims: {
            provider,
            ...info,
          },
        };
      }
    }
  }

  /**
   * Validate OAuth callback request
   */
  async validate(
    request: AuthRequest,
    _context?: AuthStrategyContext
  ): Promise<AuthUser | null> {
    // This validates an access token directly (for API usage)
    // The OAuth flow itself is handled via getAuthorizationUrl and exchangeCode
    
    const authHeader = request.headers['authorization'];
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // Try each provider
    for (const provider of this.providers.keys()) {
      try {
        return await this.getUserInfo(provider, token);
      } catch {
        // Try next provider
      }
    }

    return null;
  }

  /**
   * Complete OAuth flow with callback parameters
   */
  async handleCallback(
    provider: string,
    code: string,
    _state: string,
    redirectUri?: string
  ): Promise<{ user: AuthUser; tokens: OAuthTokenResponse }> {
    const tokens = await this.exchangeCode(provider, code, redirectUri);
    const user = await this.getUserInfo(provider, tokens.access_token);

    return { user, tokens };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an OAuth strategy
 */
export function createOAuthStrategy(config: OAuthConfig): OAuthStrategy {
  return new OAuthStrategy(config);
}

/**
 * Generate state parameter for OAuth
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

