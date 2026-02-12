/**
 * Auth interfaces for registry-mcp.
 * Replaces direct dependency on @repo/security.
 * OSS provides StaticAuthProvider; proprietary injects SecurityAuthProvider.
 *
 * @module registry-mcp/auth
 */

export interface RegistryAuthContext {
  userId: string;
  organizationId: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: RegistryPermissions;
}

export interface RegistryPermissions {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
}

/**
 * Auth provider — resolves auth context from a request/session.
 */
export interface RegistryAuthProvider {
  resolveContext(request: unknown): Promise<RegistryAuthContext>;
  hasPermission(
    ctx: RegistryAuthContext,
    permission: keyof RegistryPermissions,
  ): boolean;
}
