/**
 * @betterdata/llm-gateway CLI - Health Command
 * 
 * Test gateway health
 */

import { loadConfig } from './config';
import ora from 'ora';

export interface HealthOptions {
  endpoint?: string;
}

/**
 * Test gateway health
 */
export async function healthCommand(options: HealthOptions): Promise<void> {
  const spinner = ora('Checking gateway health').start();

  try {
    // Load config
    const config = await loadConfig();
    if (!config) {
      spinner.fail('No gateway.config.json found. Run "gateway init" first.');
      process.exit(1);
    }

    // Get endpoint
    const endpoint = options.endpoint || config.endpoint;
    if (!endpoint) {
      spinner.fail('No endpoint configured. Set endpoint in gateway.config.json or use --endpoint');
      process.exit(1);
    }

    // Check health
    const healthUrl = `${endpoint}/health`;
    const startTime = Date.now();

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const healthData = await response.json() as { status?: string; version?: string; timestamp?: string };
        spinner.succeed(`Gateway is healthy (${responseTime}ms)`);
        console.log('\n📊 Health Status:');
        console.log(`   Status: ${healthData.status || 'ok'}`);
        console.log(`   Response Time: ${responseTime}ms`);
        if (healthData.version) {
          console.log(`   Version: ${healthData.version}`);
        }
        if (healthData.timestamp) {
          console.log(`   Timestamp: ${healthData.timestamp}`);
        }
      } else {
        spinner.fail(`Gateway returned ${response.status}`);
        console.log(`   Response: ${await response.text()}`);
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(`Gateway is unreachable: ${error.message}`);
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(`Failed to check health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

