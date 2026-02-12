/**
 * @betterdata/llm-gateway CLI - Status Command
 * 
 * Check registration status
 */

import { loadConfig, saveConfig } from './config';
import { RegistryAPIClient } from './client';
import ora from 'ora';

export interface StatusOptions {
  registry?: string;
  apiKey?: string;
  gatewayId?: string;
}

/**
 * Check gateway registration status
 */
export async function statusCommand(options: StatusOptions): Promise<void> {
  const spinner = ora('Checking gateway status').start();

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

    // Create registry client
    const client = new RegistryAPIClient({
      baseUrl: options.registry || config.registry?.url || 'https://registry.betterdata.co',
      apiKey: options.apiKey || process.env.BETTERDATA_API_KEY,
    });

    // Get status
    const status = await client.getGatewayStatus(gatewayId);

    spinner.succeed('Gateway status retrieved');

    // Display status
    console.log('\n📊 Gateway Status:');
    console.log(`   ID: ${status.id}`);
    console.log(`   Slug: ${status.slug}`);
    console.log(`   Status: ${status.status}`);
    console.log(`   Domain Verified: ${status.domain_verified ? '✅' : '❌'}`);
    console.log(`   Brand Verified: ${status.brand_verified ? '✅' : '❌'}`);
    console.log(`   Trust Score: ${status.trust_score}/100`);

    if (config.registry) {
      config.registry.status = status.status as any;
      config.registry.gateway_id = status.id;
      config.registry.slug = status.slug;
      await saveConfig(config);
    }
  } catch (error) {
    spinner.fail(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

