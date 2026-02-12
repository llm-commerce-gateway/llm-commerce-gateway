import { registry_list_gateways } from './registry_list_gateways.js';
import { registry_get_gateway } from './registry_get_gateway.js';
import { registry_update_gateway } from './registry_update_gateway.js';
import { registry_get_usage } from './registry_get_usage.js';
import { registry_get_audit_logs } from './registry_get_audit_logs.js';

export {
  registry_list_gateways,
  registry_get_gateway,
  registry_update_gateway,
  registry_get_usage,
  registry_get_audit_logs,
};
export type { RegistryToolContext } from './context.js';

export type TenantTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, context: any) => Promise<unknown>;
};

export const TENANT_TOOLS: TenantTool[] = [
  registry_list_gateways,
  registry_get_gateway,
  registry_update_gateway,
  registry_get_usage,
  registry_get_audit_logs,
];

/**
 * OSS package: discovery tools only. v0.3 admin tools live in @repo/hosted-gateway.
 */
export const ALL_TOOLS: TenantTool[] = [...TENANT_TOOLS];
