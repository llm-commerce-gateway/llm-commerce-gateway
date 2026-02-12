/**
 * OSS context helpers — no @repo/security dependency.
 * Uses RegistryAuthContext for tool execution.
 */

import type { RegistryAuthContext, RegistryPermissions } from './auth/interfaces.js';

export interface RegistryMCPContext {
  organizationId: string;
  userId?: string;
  permissions: {
    canReadRegistry: boolean;
    canWriteRegistry: boolean;
    isSuperAdmin: boolean;
  };
}

export function validateTenantContext(context: { organizationId?: string }): void {
  if (!context.organizationId) {
    throw new Error('organizationId is required in MCP context');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(context.organizationId) && !context.organizationId.startsWith('c')) {
    throw new Error('Invalid organizationId format');
  }
}

export function requireTenantContext(
  context: { organizationId?: string },
): asserts context is { organizationId: string } {
  validateTenantContext(context);
}

/** Convert RegistryAuthContext to RegistryMCPContext for validation. */
export function authToMCPContext(auth: RegistryAuthContext): RegistryMCPContext {
  return {
    organizationId: auth.organizationId,
    userId: auth.userId,
    permissions: {
      canReadRegistry: auth.permissions.canRead,
      canWriteRegistry: auth.permissions.canWrite,
      isSuperAdmin: auth.isSuperAdmin,
    },
  };
}
