import type { RegistryToolContext } from './context.js';

type GetGatewayArgs = {
  gatewayId: string;
};

export const registry_get_gateway = {
  name: 'registry_get_gateway',
  description: 'Get detailed information about a specific gateway',
  inputSchema: {
    type: 'object',
    properties: {
      gatewayId: {
        type: 'string',
        description: 'Gateway ID',
      },
    },
    required: ['gatewayId'],
  },

  async execute(args: GetGatewayArgs, context: RegistryToolContext) {
    const { store, auth } = context;
    if (!auth.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!auth.permissions.canRead) {
      throw new Error('Permission denied: canRead required');
    }

    const gateway = await store.getGateway(
      args.gatewayId,
      auth.organizationId,
    );

    if (!gateway) {
      throw new Error('Gateway not found or access denied');
    }

    await store.writeAuditEntry({
      action: 'gateway.view',
      resourceType: 'gateway',
      resourceId: args.gatewayId,
      userId: auth.userId,
      organizationId: auth.organizationId,
      timestamp: new Date(),
    });

    return {
      gateway: {
        id: gateway.id,
        name: gateway.name,
        endpoint: gateway.endpoint,
        capabilities: gateway.capabilities,
        status: gateway.status.toUpperCase(),
        metadata: gateway.metadata,
        createdAt: gateway.createdAt,
        updatedAt: gateway.updatedAt,
      },
    };
  },
};
