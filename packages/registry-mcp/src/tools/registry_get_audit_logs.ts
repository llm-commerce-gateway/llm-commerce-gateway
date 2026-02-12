import type { RegistryToolContext } from './context.js';

type GetAuditLogsArgs = {
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export const registry_get_audit_logs = {
  name: 'registry_get_audit_logs',
  description: 'Get audit logs for your organization',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Filter by action type' },
      resourceType: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      limit: { type: 'number', default: 50, maximum: 100 },
    },
  },

  async execute(args: GetAuditLogsArgs, context: RegistryToolContext) {
    const { store, auth } = context;
    if (!auth.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!auth.permissions.canRead) {
      throw new Error('Permission denied: canRead required');
    }

    const logs = await store.getAuditLogs(auth.organizationId, {
      action: args.action,
      resourceType: args.resourceType,
      startDate: args.startDate ? new Date(args.startDate) : undefined,
      endDate: args.endDate ? new Date(args.endDate) : undefined,
      limit: args.limit,
    });

    await store.writeAuditEntry({
      action: 'audit.view',
      resourceType: 'audit',
      userId: auth.userId,
      organizationId: auth.organizationId,
      timestamp: new Date(),
      changes: {
        action: args.action,
        resourceType: args.resourceType,
        limit: args.limit,
      },
    });

    return {
      logs: logs.map((e) => ({
        id: e.id,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        userId: e.userId,
        organizationId: e.organizationId,
        changes: e.changes,
        timestamp: e.timestamp,
      })),
      count: logs.length,
    };
  },
};
