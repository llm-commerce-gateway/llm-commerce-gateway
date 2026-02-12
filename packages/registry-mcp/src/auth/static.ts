/**
 * Static auth provider — OSS default for self-hosted use.
 * Single user, full read+write, no admin. No @repo/security dependency.
 *
 * @module registry-mcp/auth
 */

import type {
  RegistryAuthProvider,
  RegistryAuthContext,
  RegistryPermissions,
} from './interfaces.js';

export interface StaticAuthProviderConfig {
  userId?: string;
  orgId?: string;
}

/**
 * OSS default: static single-user context.
 * Self-hosted = full read+write, no RBAC needed.
 */
export class StaticAuthProvider implements RegistryAuthProvider {
  constructor(private config?: StaticAuthProviderConfig) {}

  async resolveContext(_request: unknown): Promise<RegistryAuthContext> {
    return {
      userId: this.config?.userId ?? 'self-hosted-user',
      organizationId: this.config?.orgId ?? 'default',
      isSuperAdmin: false,
      permissions: { canRead: true, canWrite: true, canAdmin: false },
    };
  }

  hasPermission(
    ctx: RegistryAuthContext,
    permission: keyof RegistryPermissions,
  ): boolean {
    return ctx.permissions[permission];
  }
}
