/**
 * @betterdata/commerce-gateway CLI - Config Management
 * 
 * Manages gateway.config.json file
 * 
 * @license MIT
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface GatewayConfig {
  version: string;
  brand_name: string;
  domain: string;
  endpoint: string;
  protocol: 'mcp' | 'rest' | 'openapi' | 'graphql';
  capabilities: {
    catalog_search: boolean;
    pricing: 'public' | 'private' | 'none';
    inventory: 'real_time' | 'cached' | 'none';
    checkout: boolean;
  };
  registry?: {
    url: string;
    gateway_id?: string;
    slug?: string;
    status?: 'pending' | 'active' | 'suspended' | 'unhealthy';
    verified_at?: string;
  };
  connector?: {
    type: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Config Management
// ============================================================================

const CONFIG_FILE_NAME = 'gateway.config.json';

/**
 * Get the config file path
 */
export function getConfigPath(cwd?: string): string {
  return path.join(cwd ?? process.cwd(), CONFIG_FILE_NAME);
}

/**
 * Load gateway config from file
 */
export async function loadConfig(cwd?: string): Promise<GatewayConfig | null> {
  const configPath = getConfigPath(cwd);
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as GatewayConfig;
  } catch {
    return null;
  }
}

/**
 * Save gateway config to file
 */
export async function saveConfig(config: GatewayConfig, cwd?: string): Promise<void> {
  const configPath = getConfigPath(cwd);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Check if config file exists
 */
export async function configExists(cwd?: string): Promise<boolean> {
  const configPath = getConfigPath(cwd);
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

