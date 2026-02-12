/**
 * @betterdata/llm-gateway CLI - Update Command
 * 
 * Update gateway configuration
 */

import { loadConfig, saveConfig } from './config';
import ora from 'ora';

export interface UpdateOptions {
  registry?: string;
  apiKey?: string;
  gatewayId?: string;
  endpoint?: string;
  protocol?: string;
  capabilities?: string;
}

/**
 * Update gateway configuration
 */
export async function updateCommand(options: UpdateOptions): Promise<void> {
  const spinner = ora('Updating gateway configuration').start();

  try {
    // Load config
    const config = await loadConfig();
    if (!config) {
      spinner.fail('No gateway.config.json found. Run "gateway init" first.');
      process.exit(1);
    }

    // Get gateway ID
    const gatewayId = options.gatewayId || config.registry?.gateway_id;
    if (!gatewayId) {
      spinner.fail('Gateway not registered. Run "gateway register" first.');
      process.exit(1);
    }

    // Update local config
    if (options.endpoint) {
      config.endpoint = options.endpoint;
    }

    if (options.protocol) {
      config.protocol = options.protocol.toLowerCase() as any;
    }

    if (options.capabilities) {
      try {
        const caps = JSON.parse(options.capabilities);
        config.capabilities = { ...config.capabilities, ...caps };
      } catch {
        spinner.fail('Invalid capabilities JSON');
        process.exit(1);
      }
    }

    // Save updated config
    await saveConfig(config);

    // TODO: Update via API (when endpoint is available)
    // For now, just update local config
    spinner.succeed('Gateway configuration updated');
    console.log('\n✅ Configuration saved to gateway.config.json');
    console.log('   Note: API update endpoint not yet implemented');
  } catch (error) {
    spinner.fail(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

