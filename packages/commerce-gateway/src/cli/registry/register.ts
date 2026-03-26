/**
 * @betterdata/commerce-gateway CLI - Register Command
 * 
 * Register a gateway with the registry
 * 
 * @license Apache-2.0
 */

import ora from 'ora';
import { RegistryAPIClient } from './client';
import { loadConfig, saveConfig, type GatewayConfig } from './config';
import * as readline from 'readline';

// ============================================================================
// Register Command
// ============================================================================

export async function registerCommand(options: {
  registry?: string;
  apiKey?: string;
  interactive?: boolean;
}): Promise<void> {
  const spinner = ora('Registering gateway...').start();

  try {
    // Load existing config
    const existingConfig = await loadConfig();

    if (!existingConfig) {
      spinner.fail('No gateway.config.json found. Run "gateway init" first.');
      process.exit(1);
    }

    // Create registry client
    const client = new RegistryAPIClient({
      baseUrl: options.registry,
      apiKey: options.apiKey ?? process.env.BETTERDATA_API_KEY,
    });

    // Prepare registration data
    const registrationData = {
      brand_name: existingConfig.brand_name,
      domain: existingConfig.domain,
      endpoint: existingConfig.endpoint,
      protocol: existingConfig.protocol,
      capabilities: {
        catalog_search: existingConfig.capabilities.catalog_search,
        pricing: (existingConfig.capabilities.pricing === 'none' ? false : existingConfig.capabilities.pricing === 'private' ? 'private' : 'public') as 'public' | 'private' | false,
        inventory: (existingConfig.capabilities.inventory === 'none' ? false : existingConfig.capabilities.inventory === 'cached' ? 'cached' : 'real_time') as 'real_time' | 'cached' | false,
        checkout: existingConfig.capabilities.checkout,
      },
      auth: {
        type: 'none' as const,
      },
      aliases: [existingConfig.brand_name.toLowerCase()],
      categories: [] as string[],
    };

    // If interactive, prompt for additional info
    if (options.interactive) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (query: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(query, resolve);
        });
      };

      const aliasesInput = await question('Brand aliases (comma-separated, optional): ');
      if (aliasesInput.trim()) {
        registrationData.aliases = aliasesInput.split(',').map(a => a.trim());
      }

      const categoriesInput = await question('Categories (comma-separated, e.g., "beauty.makeup.lipstick", optional): ');
      if (categoriesInput.trim()) {
        registrationData.categories = categoriesInput.split(',').map(c => c.trim()) as string[];
      }

      rl.close();
    }

    // Register gateway
    spinner.text = 'Sending registration request...';
    const response = await client.registerGateway(registrationData);

    spinner.succeed('Gateway registered successfully!');

    // Update config with registry info
    const updatedConfig: GatewayConfig = {
      ...existingConfig,
      registry: {
        url: options.registry ?? 'https://registry.betterdata.co',
        gateway_id: response.id,
        slug: response.slug,
        status: response.status,
      },
    };

    await saveConfig(updatedConfig);

    // Display verification instructions
    console.log('\n📋 Verification Instructions:');
    console.log('\n1. DNS TXT Record:');
    console.log(`   Record: ${response.verification.dns_txt.record}`);
    console.log(`   Value:  ${response.verification.dns_txt.value}`);
    console.log('\n2. .well-known File:');
    console.log(`   URL: ${response.verification.well_known.url}`);
    console.log(`   Content: ${JSON.stringify(response.verification.well_known.content, null, 2)}`);
    console.log('\nAfter adding the verification, run:');
    console.log('  gateway verify');
  } catch (error) {
    spinner.fail(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error && error.message.includes('already registered')) {
      console.log('\n💡 Tip: This domain is already registered. Use "gateway status" to check your registration.');
    }
    
    process.exit(1);
  }
}

