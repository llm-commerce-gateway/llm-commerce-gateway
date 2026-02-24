/**
 * @betterdata/commerce-gateway CLI - Init Command
 * 
 * Initialize a new gateway project
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { saveConfig, type GatewayConfig } from './config';
import ora from 'ora';

export interface InitOptions {
  template?: 'shopify' | 'bigcommerce' | 'woocommerce' | 'custom';
  interactive?: boolean;
}

/**
 * Initialize a new gateway project
 */
export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora('Initializing gateway project').start();

  try {
    // Check if config already exists
    const configPath = path.join(process.cwd(), 'gateway.config.json');
    try {
      await fs.access(configPath);
      spinner.fail('gateway.config.json already exists in this directory');
      process.exit(1);
    } catch {
      // File doesn't exist, continue
    }

    // Determine template
    const template = options.template || 'custom';

    // Create base config
    const config: GatewayConfig = {
      version: '1.0',
      brand_name: '',
      domain: '',
      endpoint: '',
      protocol: 'rest',
      capabilities: {
        catalog_search: true,
        pricing: 'public',
        inventory: 'real_time',
        checkout: false,
      },
    };

    // Add template-specific defaults
    if (template === 'shopify') {
      config.protocol = 'mcp';
      config.connector = {
        type: 'shopify',
        store_url: '',
      };
    } else if (template === 'bigcommerce') {
      config.protocol = 'rest';
      config.connector = {
        type: 'bigcommerce',
        store_hash: '',
      };
    } else if (template === 'woocommerce') {
      config.protocol = 'rest';
      config.connector = {
        type: 'woocommerce',
        url: '',
      };
    }

    // Save config
    await saveConfig(config);

    // Create template files if needed
    if (template !== 'custom') {
      await createTemplateFiles(template);
    }

    spinner.succeed('Gateway project initialized');
    console.log('\n📝 Next steps:');
    console.log('1. Edit gateway.config.json with your gateway details');
    console.log('2. Run: gateway register');
  } catch (error) {
    spinner.fail(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Create template files for a specific platform
 */
async function createTemplateFiles(template: string): Promise<void> {
  const templatesDir = path.join(__dirname, '../../templates', template);
  
  try {
    // Check if template directory exists
    await fs.access(templatesDir);
    
    // Copy template files
    const files = await fs.readdir(templatesDir);
    for (const file of files) {
      const src = path.join(templatesDir, file);
      const dest = path.join(process.cwd(), file);
      const content = await fs.readFile(src, 'utf-8');
      await fs.writeFile(dest, content, 'utf-8');
    }
  } catch {
    // Template directory doesn't exist, skip
    // In a full implementation, templates would be included in the package
  }
}

