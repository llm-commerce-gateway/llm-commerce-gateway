import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { GatewayConfig } from '@commercegateway/commerce-gateway/mcp';

export type TransportConfig = {
  type?: 'stdio' | 'http';
  port?: number;
};

export type GatewayMcpConfig = GatewayConfig & {
  transport?: TransportConfig;
  backends?: { type?: 'demo' };
};

export const DEFAULT_DEMO_CONFIG: GatewayMcpConfig = {
  slug: 'demo',
  brandName: 'Commerce Gateway Demo',
  endpoint: 'http://localhost/mcp',
  protocol: 'mcp',
  capabilities: {
    catalog_search: true,
    inventory: 'real_time',
  },
  transport: { type: 'stdio' },
  backends: { type: 'demo' },
};

export function getArgValue(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

export function resolveConfigPath(args: string[], env: NodeJS.ProcessEnv = process.env): {
  path: string;
  explicit: boolean;
} {
  const fromArg = getArgValue(args, '--config');
  if (fromArg) {
    return { path: fromArg, explicit: true };
  }
  if (env.GATEWAY_CONFIG) {
    return { path: env.GATEWAY_CONFIG, explicit: true };
  }
  return { path: 'gateway.config.json', explicit: false };
}

export async function loadGatewayMcpConfig(options: {
  path: string;
  explicit: boolean;
}): Promise<{ config: GatewayMcpConfig; source: 'file' | 'demo-default' }> {
  const fullPath = resolvePath(process.cwd(), options.path);
  try {
    await access(fullPath, fsConstants.R_OK);
  } catch {
    if (options.explicit) {
      throw new Error(`Gateway config not found: ${fullPath}`);
    }
    return { config: DEFAULT_DEMO_CONFIG, source: 'demo-default' };
  }
  const raw = await readFile(fullPath, 'utf-8');
  return { config: JSON.parse(raw) as GatewayMcpConfig, source: 'file' };
}
