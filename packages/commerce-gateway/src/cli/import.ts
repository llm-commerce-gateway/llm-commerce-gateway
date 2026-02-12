#!/usr/bin/env node

/**
 * @betterdata/llm-gateway CLI - Product Import
 * 
 * Quick import from Shopify, Square, or CSV for single-store owners.
 * 
 * @example
 * ```bash
 * # Import from Shopify
 * npx llm-gateway import shopify \
 *   --domain mystore.myshopify.com \
 *   --token shpat_xxx
 * 
 * # Import from Square
 * npx llm-gateway import square \
 *   --token sq_xxx \
 *   --location loc_xxx
 * ```
 */

import { Command } from 'commander';
import ora from 'ora';
import { importProducts } from '../ingestion/index';

const program = new Command();

program
  .name('llm-gateway')
  .description('Import products from your e-commerce platform')
  .version('1.0.0');

// ============================================================================
// Shopify Import Command
// ============================================================================

program
  .command('shopify')
  .description('Import products from Shopify')
  .requiredOption('-d, --domain <domain>', 'Shopify store domain (e.g., mystore.myshopify.com)')
  .requiredOption('-t, --token <token>', 'Shopify access token')
  .option('--include-out-of-stock', 'Include out of stock products', false)
  .action(async (options) => {
    const spinner = ora('Importing from Shopify...').start();
    
    try {
      const result = await importProducts({
        platform: 'shopify',
        credentials: {
          domain: options.domain,
          accessToken: options.token,
        },
        options: {
          skipOutOfStock: !options.includeOutOfStock,
        },
      });
      
      spinner.succeed(`Import complete in ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  ✅ Imported: ${result.imported}`);
      console.log(`  📝 Updated: ${result.updated}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
      
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
        
        if (result.errors.length > 5) {
          console.log(`     ... and ${result.errors.length - 5} more errors`);
        }
      }
      
    } catch (error) {
      spinner.fail(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// ============================================================================
// Square Import Command
// ============================================================================

program
  .command('square')
  .description('Import products from Square')
  .requiredOption('-t, --token <token>', 'Square access token')
  .option('-l, --location <id>', 'Square location ID (optional)')
  .option('--include-out-of-stock', 'Include out of stock products', false)
  .action(async (options) => {
    const spinner = ora('Importing from Square...').start();
    
    try {
      const result = await importProducts({
        platform: 'square',
        credentials: {
          accessToken: options.token,
          locationId: options.location,
        },
        options: {
          skipOutOfStock: !options.includeOutOfStock,
        },
      });
      
      spinner.succeed(`Import complete in ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  ✅ Imported: ${result.imported}`);
      console.log(`  📝 Updated: ${result.updated}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
      
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
        
        if (result.errors.length > 5) {
          console.log(`     ... and ${result.errors.length - 5} more errors`);
        }
      }
      
    } catch (error) {
      spinner.fail(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// ============================================================================
// CSV Import Command
// ============================================================================

program
  .command('csv')
  .description('Import products from CSV file')
  .requiredOption('-f, --file <path>', 'Path to CSV file')
  .option('--delimiter <char>', 'CSV delimiter', ',')
  .action(async (options) => {
    const spinner = ora('Importing from CSV...').start();
    
    try {
      const result = await importProducts({
        platform: 'csv',
        credentials: {
          source: options.file,
          isFilePath: true,
          delimiter: options.delimiter,
        },
        options: {},
      });
      
      spinner.succeed(`Import complete in ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  ✅ Imported: ${result.imported}`);
      console.log(`  📝 Updated: ${result.updated}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
      
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
        
        if (result.errors.length > 5) {
          console.log(`     ... and ${result.errors.length - 5} more errors`);
        }
      }
      
    } catch (error) {
      spinner.fail(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// ============================================================================
// JSON Import Command
// ============================================================================

program
  .command('json')
  .description('Import products from JSON file')
  .requiredOption('-f, --file <path>', 'Path to JSON file')
  .action(async (options) => {
    const spinner = ora('Importing from JSON...').start();
    
    try {
      const result = await importProducts({
        platform: 'json',
        credentials: {
          source: options.file,
          isFilePath: true,
        },
        options: {},
      });
      
      spinner.succeed(`Import complete in ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`  ✅ Imported: ${result.imported}`);
      console.log(`  📝 Updated: ${result.updated}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
      
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`     - ${e}`));
        
        if (result.errors.length > 5) {
          console.log(`     ... and ${result.errors.length - 5} more errors`);
        }
      }
      
    } catch (error) {
      spinner.fail(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// ============================================================================
// Parse CLI Arguments
// ============================================================================

program.parse();

