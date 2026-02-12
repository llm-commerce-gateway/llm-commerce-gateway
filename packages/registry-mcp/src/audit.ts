/**
 * Audit helpers — OSS stub.
 * OSS uses RegistryStore.writeAuditEntry / getAuditLogs for audit.
 * This module is retained for API compatibility; implementations use the store.
 */

export interface AuditLogInput {
  organizationId: string;
  userId?: string;
  impersonationSessionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: { before?: unknown; after?: unknown } | null;
  source: 'mcp' | 'api' | 'scm_web' | 'admin';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  mcpSessionId?: string;
}

/** OSS: no-op. Use RegistryStore.writeAuditEntry in tools. */
export async function auditLog(_input: AuditLogInput): Promise<void> {
  // No-op for OSS — tools use store.writeAuditEntry
}

/** OSS: returns empty. Use RegistryStore.getAuditLogs in tools. */
export async function queryAuditLogs(
  _organizationId: string,
  _filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  },
): Promise<unknown[]> {
  return [];
}

/** OSS: returns empty. Admin audit is proprietary-only. */
export async function queryAuditLogsAdmin(
  _filters: {
    organizationId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  },
): Promise<unknown[]> {
  return [];
}
