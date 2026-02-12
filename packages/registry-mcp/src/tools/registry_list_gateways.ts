import type { RegistryToolContext } from './context.js';
import { normalizeStatus } from './context.js';

type ListGatewaysArgs = {
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  limit?: number;
};

export const registry_list_gateways = {
  name: 'registry_list_gateways',
  description: 'List all gateways registered to your organization',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['ACTIVE', 'SUSPENDED', 'PENDING'],
        description: 'Filter by gateway status',
      },
      limit: {
        type: 'number',
        default: 50,
        maximum: 100,
        description: 'Maximum results to return',
      },
    },
  },

  async execute(args: ListGatewaysArgs, context: RegistryToolContext) {
    const { store, auth } = context;
    if (!auth.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!auth.permissions.canRead) {
      throw new Error('Permission denied: canRead required');
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const status = normalizeStatus(args.status);

    const gateways = await store.listGateways(auth.organizationId, {
      status,
      limit,
    });

    await store.writeAuditEntry({
      action: 'gateway.list',
      resourceType: 'gateway',
      userId: auth.userId,
      organizationId: auth.organizationId,
      timestamp: new Date(),
      changes: { status: args.status, limit },
    });

    return {
      gateways: gateways.map((gw) => ({
        id: gw.id,
        name: gw.name,
        slug: gw.name.toLowerCase().replace(/\s+/g, '-'),
        endpoint: gw.endpoint,
        status: gw.status.toUpperCase(),
        capabilities: gw.capabilities,
        createdAt: gw.createdAt,
        updatedAt: gw.updatedAt,
      })),
      count: gateways.length,
      organizationId: auth.organizationId,
    };
  },
};
