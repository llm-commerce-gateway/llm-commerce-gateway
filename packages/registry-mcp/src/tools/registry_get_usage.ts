import type { RegistryToolContext } from './context.js';

type GetUsageArgs = {
  gatewayId?: string;
  period?: 'day' | 'week' | 'month';
};

export const registry_get_usage = {
  name: 'registry_get_usage',
  description: 'Get usage statistics for your gateways',
  inputSchema: {
    type: 'object',
    properties: {
      gatewayId: {
        type: 'string',
        description: 'Specific gateway ID (optional, defaults to all)',
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        default: 'month',
      },
    },
  },

  async execute(args: GetUsageArgs, context: RegistryToolContext) {
    const { store, auth } = context;
    if (!auth.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!auth.permissions.canRead) {
      throw new Error('Permission denied: canRead required');
    }

    const now = new Date();
    const periodDays =
      args.period === 'day' ? 1 : args.period === 'week' ? 7 : 30;
    const startDate = new Date(
      now.getTime() - periodDays * 24 * 60 * 60 * 1000,
    );

    const usage = await store.getUsage(
      args.gatewayId ?? 'all',
      auth.organizationId,
      { start: startDate, end: now },
    );

    await store.writeAuditEntry({
      action: 'gateway.usage',
      resourceType: 'gateway',
      resourceId: args.gatewayId,
      userId: auth.userId,
      organizationId: auth.organizationId,
      timestamp: new Date(),
      changes: {
        period: args.period ?? 'month',
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },
    });

    return {
      period: args.period ?? 'month',
      startDate,
      endDate: now,
      usage: {
        totalRequests: usage.totalRequests,
        totalTokens: usage.totalTokens,
        byProvider: usage.byProvider,
      },
    };
  },
};
