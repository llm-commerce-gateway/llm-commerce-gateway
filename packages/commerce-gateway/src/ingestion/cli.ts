#!/usr/bin/env node
/**
 * LLM Gateway CLI - Product Import Commands
 * 
 * Import products from Shopify, Square, CSV, or JSON.
 * 
 * Usage:
 *   npx llm-gateway import shopify --domain mystore.myshopify.com --token shpat_xxx
 *   npx llm-gateway import square --token sq_xxx --location loc_xxx
 *   npx llm-gateway import csv --file products.csv
 *   npx llm-gateway import json --file products.json
 * 
 * @module ingestion/cli
 */

import {
  importFromShopify,
  importFromSquare,
  importFromCSV,
  importFromJSON,
  type ImportResult,
  type ImportProgress,
} from './index';

// ============================================================================
// CLI Argument Parser
// ============================================================================

interface ParsedArgs {
  command: string;
  subcommand: string;
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: args[0] || 'help',
    subcommand: args[1] || '',
    flags: {},
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        result.flags[key] = nextArg;
        i++;
      } else {
        result.flags[key] = true;
      }
    }
  }

  return result;
}

// ============================================================================
// Progress Display
// ============================================================================

function createProgressHandler(): (progress: ImportProgress) => void {
  let lastMessage = '';
  
  return (progress: ImportProgress) => {
    const message = `[${progress.phase}] ${progress.message}`;
    if (message !== lastMessage) {
      console.log(message);
      lastMessage = message;
    }
  };
}

// ============================================================================
// Result Display
// ============================================================================

function displayResult(result: ImportResult): void {
  console.log('\n' + '='.repeat(50));
  console.log('Import Complete');
  console.log('='.repeat(50));
  
  if (result.success) {
    console.log(`✅ Success`);
  } else {
    console.log(`❌ Failed`);
  }
  
  console.log(`📦 Imported: ${result.imported}`);
  console.log(`🔄 Updated: ${result.updated}`);
  console.log(`⏭️  Skipped: ${result.skipped}`);
  console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️  Errors (${result.errors.length}):`);
    for (const error of result.errors.slice(0, 10)) {
      console.log(`   - [${error.identifier}] ${error.message}`);
    }
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more`);
    }
  }
  
  console.log('');
}

// ============================================================================
// Commands
// ============================================================================

async function importShopifyCommand(flags: Record<string, string | boolean>): Promise<void> {
  const domain = flags.domain as string;
  const token = flags.token as string;
  
  if (!domain || !token) {
    console.error('Error: --domain and --token are required');
    console.log('\nUsage:');
    console.log('  npx llm-gateway import shopify --domain mystore.myshopify.com --token shpat_xxx');
    process.exit(1);
  }
  
  console.log(`\n🛍️  Importing from Shopify: ${domain}\n`);
  
  const result = await importFromShopify(domain, token, {
    activeOnly: flags['active-only'] !== false,
    skipOutOfStock: flags['skip-out-of-stock'] === true,
    limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
    onProgress: createProgressHandler(),
  });
  
  displayResult(result);
  
  // Output products to stdout if --output specified
  if (flags.output) {
    const outputPath = flags.output as string;
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result.products, null, 2));
    console.log(`📁 Products saved to: ${outputPath}`);
  }
  
  process.exit(result.success ? 0 : 1);
}

async function importSquareCommand(flags: Record<string, string | boolean>): Promise<void> {
  const token = flags.token as string;
  
  if (!token) {
    console.error('Error: --token is required');
    console.log('\nUsage:');
    console.log('  npx llm-gateway import square --token sq_xxx [--location loc_xxx]');
    process.exit(1);
  }
  
  console.log(`\n🟦 Importing from Square\n`);
  
  const result = await importFromSquare(token, {
    locationId: flags.location as string | undefined,
    sandbox: flags.sandbox === true,
    skipOutOfStock: flags['skip-out-of-stock'] === true,
    limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
    onProgress: createProgressHandler(),
  });
  
  displayResult(result);
  
  if (flags.output) {
    const outputPath = flags.output as string;
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result.products, null, 2));
    console.log(`📁 Products saved to: ${outputPath}`);
  }
  
  process.exit(result.success ? 0 : 1);
}

async function importCSVCommand(flags: Record<string, string | boolean>): Promise<void> {
  const file = flags.file as string;
  
  if (!file) {
    console.error('Error: --file is required');
    console.log('\nUsage:');
    console.log('  npx llm-gateway import csv --file products.csv');
    process.exit(1);
  }
  
  console.log(`\n📄 Importing from CSV: ${file}\n`);
  
  const result = await importFromCSV(file, {
    delimiter: flags.delimiter as string | undefined,
    skipOutOfStock: flags['skip-out-of-stock'] === true,
    limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
    onProgress: createProgressHandler(),
  });
  
  displayResult(result);
  
  if (flags.output) {
    const outputPath = flags.output as string;
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result.products, null, 2));
    console.log(`📁 Products saved to: ${outputPath}`);
  }
  
  process.exit(result.success ? 0 : 1);
}

async function importJSONCommand(flags: Record<string, string | boolean>): Promise<void> {
  const file = flags.file as string;
  
  if (!file) {
    console.error('Error: --file is required');
    console.log('\nUsage:');
    console.log('  npx llm-gateway import json --file products.json');
    process.exit(1);
  }
  
  console.log(`\n📋 Importing from JSON: ${file}\n`);
  
  const result = await importFromJSON(file, {
    skipOutOfStock: flags['skip-out-of-stock'] === true,
    limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
    onProgress: createProgressHandler(),
  });
  
  displayResult(result);
  
  if (flags.output) {
    const outputPath = flags.output as string;
    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(result.products, null, 2));
    console.log(`📁 Products saved to: ${outputPath}`);
  }
  
  process.exit(result.success ? 0 : 1);
}

function showHelp(): void {
  console.log(`
LLM Gateway CLI - Product Import

USAGE:
  npx llm-gateway <command> <subcommand> [options]

COMMANDS:
  import shopify    Import products from a Shopify store
  import square     Import products from Square
  import csv        Import products from a CSV file
  import json       Import products from a JSON file
  help              Show this help message

SHOPIFY OPTIONS:
  --domain <domain>     Shopify store domain (required)
  --token <token>       Admin API access token (required)
  --active-only         Only import active products (default: true)
  --skip-out-of-stock   Skip products that are out of stock
  --limit <n>           Maximum number of products to import
  --output <file>       Save products to JSON file

SQUARE OPTIONS:
  --token <token>       Square access token (required)
  --location <id>       Location ID for inventory
  --sandbox             Use sandbox environment
  --skip-out-of-stock   Skip products that are out of stock
  --limit <n>           Maximum number of products to import
  --output <file>       Save products to JSON file

CSV OPTIONS:
  --file <path>         Path to CSV file (required)
  --delimiter <char>    CSV delimiter (default: ,)
  --skip-out-of-stock   Skip products that are out of stock
  --limit <n>           Maximum number of products to import
  --output <file>       Save products to JSON file

JSON OPTIONS:
  --file <path>         Path to JSON file (required)
  --skip-out-of-stock   Skip products that are out of stock
  --limit <n>           Maximum number of products to import
  --output <file>       Save products to JSON file

EXAMPLES:
  # Import from Shopify
  npx llm-gateway import shopify \\
    --domain mystore.myshopify.com \\
    --token shpat_xxxxx \\
    --output products.json

  # Import from Square
  npx llm-gateway import square \\
    --token sq_xxxxx \\
    --location L123456

  # Import from CSV
  npx llm-gateway import csv --file products.csv

  # Import from JSON
  npx llm-gateway import json --file products.json
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  
  if (parsed.command === 'help' || parsed.flags.help) {
    showHelp();
    process.exit(0);
  }
  
  if (parsed.command === 'import') {
    switch (parsed.subcommand) {
      case 'shopify':
        await importShopifyCommand(parsed.flags);
        break;
      case 'square':
        await importSquareCommand(parsed.flags);
        break;
      case 'csv':
        await importCSVCommand(parsed.flags);
        break;
      case 'json':
        await importJSONCommand(parsed.flags);
        break;
      default:
        console.error(`Unknown import source: ${parsed.subcommand}`);
        console.log('Valid sources: shopify, square, csv, json');
        process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${parsed.command}`);
    showHelp();
    process.exit(1);
  }
}

// Run CLI
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
