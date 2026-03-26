/**
 * @betterdata/commerce-gateway CLI - Verify Command
 * 
 * Verify domain ownership
 * 
 * @license Apache-2.0
 */

import ora from 'ora';
import { RegistryAPIClient } from './client';
import { loadConfig, saveConfig } from './config';

// ============================================================================
// Verify Command
// ============================================================================

export async function verifyCommand(options: {
  registry?: string;
  apiKey?: string;
  gatewayId?: string;
}): Promise<void> {
  const spinner = ora('Verifying domain ownership...').start();

  try {
    // Get gateway ID
    let gatewayId = options.gatewayId;

    if (!gatewayId) {
      const config = await loadConfig();
      if (!config?.registry?.gateway_id) {
        spinner.fail('No gateway ID found. Run "gateway register" first.');
        process.exit(1);
      }
      gatewayId = config.registry.gateway_id;
    }

    // Create registry client
    const client = new RegistryAPIClient({
      baseUrl: options.registry,
      apiKey: options.apiKey ?? process.env.BETTERDATA_API_KEY,
    });

    // Verify gateway
    spinner.text = 'Checking verification tokens...';
    const response = await client.verifyGateway(gatewayId);

    if (response.verified) {
      spinner.succeed(`Domain verified via ${response.method}!`);
      console.log(`\n✅ Status: ${response.status}`);
      console.log(`📝 ${response.message}`);
      
      // Update config if we have it
      const config = await loadConfig();
      if (config?.registry) {
        config.registry.status = response.status as any;
        config.registry.verified_at = new Date().toISOString();
        await saveConfig(config);
      }
    } else {
      spinner.warn('Verification not yet complete');
      console.log(`\n❌ ${response.message}`);
      
      if (response.expected_token_prefix) {
        console.log(`\nExpected token prefix: ${response.expected_token_prefix}`);
      }
      
      if (response.checked) {
        console.log('\nVerification checks:');
        console.log(`  DNS TXT: ${response.checked.dns_txt ? '✅' : '❌'}`);
        console.log(`  .well-known: ${response.checked.well_known ? '✅' : '❌'}`);
      }
      
      console.log('\n💡 Make sure you\'ve added the verification token to your domain.');
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

