#!/usr/bin/env node

/**
 * @betterdata/llm-gateway CLI - Registry Commands
 * 
 * Main entry point for registry CLI commands
 * 
 * @license MIT
 */

import { Command } from 'commander';
import { initCommand } from './init';
import { registerCommand } from './register';
import { verifyCommand } from './verify';
import { claimGTINsCommand } from './claim-gtins';
import { statusCommand } from './status';
import { updateCommand } from './update';
import { healthCommand } from './health';
import { exportCommand } from './export';

const program = new Command();

program
  .name('gateway')
  .description('Commerce Gateway Registry CLI')
  .version('1.0.0');

// ============================================================================
// Init Command
// ============================================================================

program
  .command('init')
  .description('Initialize a new gateway project')
  .option('--template <type>', 'Template type (shopify|bigcommerce|woocommerce|custom)', 'custom')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options) => {
    await initCommand({
      template: options.template as any,
      interactive: options.interactive,
    });
  });

// ============================================================================
// Register Command
// ============================================================================

program
  .command('register')
  .description('Register gateway with registry')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('-i, --interactive', 'Interactive mode for additional info')
  .action(async (options) => {
    await registerCommand(options);
  });

// ============================================================================
// Verify Command
// ============================================================================

program
  .command('verify')
  .description('Verify domain ownership')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('--gateway-id <id>', 'Gateway ID (or read from config)')
  .action(async (options) => {
    await verifyCommand(options);
  });

// ============================================================================
// Claim GTINs Command
// ============================================================================

program
  .command('claim-gtins')
  .description('Claim GTINs for a gateway')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('--gateway-id <id>', 'Gateway ID (or read from config)')
  .option('--prefix <prefix>', 'GS1 company prefix (6-9 digits)')
  .option('--csv <file>', 'CSV file with GTINs')
  .option('--gtins <gtins>', 'Comma-separated list of GTINs')
  .option('--proof-url <url>', 'URL to GS1 certificate proof')
  .action(async (options) => {
    await claimGTINsCommand(options);
  });

// ============================================================================
// Status Command
// ============================================================================

program
  .command('status')
  .description('Check registration status')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('--gateway-id <id>', 'Gateway ID (or read from config)')
  .action(async (options) => {
    await statusCommand(options);
  });

// ============================================================================
// Update Command
// ============================================================================

program
  .command('update')
  .description('Update gateway configuration')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('--gateway-id <id>', 'Gateway ID (or read from config)')
  .option('--endpoint <url>', 'Update gateway endpoint')
  .option('--protocol <protocol>', 'Update protocol (mcp|rest|openapi|graphql)')
  .option('--capabilities <json>', 'Update capabilities (JSON string)')
  .action(async (options) => {
    await updateCommand(options);
  });

// ============================================================================
// Health Command
// ============================================================================

program
  .command('health')
  .description('Test gateway health')
  .option('--endpoint <url>', 'Gateway endpoint (or read from config)')
  .action(async (options) => {
    await healthCommand(options);
  });

// ============================================================================
// Export Command
// ============================================================================

program
  .command('export')
  .description('Export gateway data (for migration)')
  .option('--registry <url>', 'Registry API URL', 'https://registry.betterdata.co')
  .option('--api-key <key>', 'API key (or set BETTERDATA_API_KEY env var)')
  .option('--gateway-id <id>', 'Gateway ID (or read from config)')
  .option('--output <file>', 'Output file path', 'gateway-backup.json')
  .action(async (options) => {
    await exportCommand(options);
  });

// ============================================================================
// Parse CLI Arguments
// ============================================================================

if (require.main === module) {
  program.parse();
}

export { program };

