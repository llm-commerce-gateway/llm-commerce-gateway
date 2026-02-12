/**
 * @betterdata/llm-gateway CLI - Export Command
 * 
 * Export gateway data for migration
 */

import { loadConfig } from './config';
import { RegistryAPIClient } from './client';
import * as fs from 'fs/promises';
import * as path from 'path';
import ora from 'ora';

export interface ExportOptions {
  registry?: string;
  apiKey?: string;
  gatewayId?: string;
  output?: string;
}

/**
 * Export gateway data
 */
export async function exportCommand(options: ExportOptions): Promise<void> {
  const spinner = ora('Exporting gateway data').start();

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

    // Get gateway data
    const status = await client.getGatewayStatus(gatewayId);

    // Prepare export data
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      gateway: {
        id: status.id,
        slug: status.slug,
        status: status.status,
        domain_verified: status.domain_verified,
        brand_verified: status.brand_verified,
        trust_score: status.trust_score,
      },
      config: {
        brand_name: config.brand_name,
        domain: config.domain,
        endpoint: config.endpoint,
        protocol: config.protocol,
        capabilities: config.capabilities,
        connector: config.connector,
      },
    };

    // Determine output path
    const outputPath = options.output || path.join(process.cwd(), 'gateway-backup.json');

    // Write export file
    await fs.writeFile(
      outputPath,
      JSON.stringify(exportData, null, 2) + '\n',
      'utf-8'
    );

    spinner.succeed(`Gateway data exported to ${outputPath}`);
    console.log(`\n📦 Export includes:`);
    console.log(`   - Gateway registration info`);
    console.log(`   - Configuration`);
    console.log(`   - Status and verification`);
  } catch (error) {
    spinner.fail(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

