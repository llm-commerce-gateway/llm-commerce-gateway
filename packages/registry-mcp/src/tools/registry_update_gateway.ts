import type { RegistryToolContext } from './context.js';
import { normalizeStatus } from './context.js';

type UpdateGatewayArgs = {
  gatewayId: string;
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
};

export const registry_update_gateway = {
  name: 'registry_update_gateway',
  description: 'Update gateway metadata (brand name, domain, status)',
  inputSchema: {
    type: 'object',
    properties: {
      gatewayId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
    },
    required: ['gatewayId'],
  },

  async execute(args: UpdateGatewayArgs, context: RegistryToolContext) {
    const { store, auth } = context;
    if (!auth.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!auth.permissions.canWrite) {
      throw new Error('Permission denied: canWrite required');
    }

    const status = normalizeStatus(args.status);
    const updated = await store.updateGateway(
      args.gatewayId,
      auth.organizationId,
      {
        ...(args.name && { name: args.name }),
        ...(args.description && { metadata: { description: args.description } }),
        ...(status && { status }),
      },
    );

    await store.writeAuditEntry({
      action: 'gateway.update',
      resourceType: 'gateway',
      resourceId: args.gatewayId,
      userId: auth.userId,
      organizationId: auth.organizationId,
      timestamp: new Date(),
      changes: { name: args.name, description: args.description, status },
    });

    return {
      gateway: {
        id: updated.id,
        name: updated.name,
        endpoint: updated.endpoint,
        status: updated.status.toUpperCase(),
        updatedAt: updated.updatedAt,
      },
    };
  },
};
