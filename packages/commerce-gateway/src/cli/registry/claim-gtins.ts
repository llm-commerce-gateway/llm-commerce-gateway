/**
 * @betterdata/commerce-gateway CLI - Claim GTINs Command
 * 
 * Claim GTINs for a gateway
 * 
 * @license MIT
 */

import ora from 'ora';
import * as fs from 'fs/promises';
import { RegistryAPIClient } from './client';
import { loadConfig } from './config';

// ============================================================================
// Claim GTINs Command
// ============================================================================

export async function claimGTINsCommand(options: {
  registry?: string;
  apiKey?: string;
  gatewayId?: string;
  prefix?: string;
  csv?: string;
  gtins?: string;
  proofUrl?: string;
}): Promise<void> {
  const spinner = ora('Claiming GTINs...').start();

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

    // Prepare claim data
    const claimData: {
      gs1_prefix?: {
        prefix: string;
        proof: 'gs1_certificate' | 'brand_attestation' | 'self_declared';
        proof_url?: string;
      };
      gtins?: Array<{
        gtin: string;
        product_name?: string;
        role: 'manufacturer' | 'reseller';
      }>;
    } = {};

    // Handle GS1 prefix
    if (options.prefix) {
      claimData.gs1_prefix = {
        prefix: options.prefix,
        proof: options.proofUrl ? 'gs1_certificate' : 'self_declared',
        proof_url: options.proofUrl,
      };
    }

    // Handle GTINs
    if (options.gtins) {
      claimData.gtins = options.gtins.split(',').map(gtin => ({
        gtin: gtin.trim(),
        role: 'manufacturer' as const,
      }));
    } else if (options.csv) {
      // Parse CSV file
      spinner.text = 'Reading CSV file...';
      const csvContent = await fs.readFile(options.csv, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0]!.split(',').map(h => h.trim());
      
      const gtinIndex = headers.findIndex(h => h.toLowerCase().includes('gtin') || h.toLowerCase().includes('upc') || h.toLowerCase().includes('ean'));
      const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('product'));
      
      if (gtinIndex === -1) {
        throw new Error('CSV must contain a GTIN/UPC/EAN column');
      }

      claimData.gtins = lines.slice(1).map(line => {
        const values = line.split(',');
        return {
          gtin: values[gtinIndex]!.trim(),
          product_name: nameIndex !== -1 ? values[nameIndex]?.trim() : undefined,
          role: 'manufacturer' as const,
        };
      }).filter(g => g.gtin);
    }

    if (!claimData.gs1_prefix && !claimData.gtins?.length) {
      spinner.fail('No GTINs or prefix provided. Use --prefix, --gtins, or --csv');
      process.exit(1);
    }

    // Claim GTINs
    spinner.text = 'Submitting GTIN claims...';
    const response = await client.claimGTINs(gatewayId, claimData);

    spinner.succeed('GTIN claim processed!');

    // Display results
    if (response.claimed.length > 0) {
      console.log('\n✅ Claimed:');
      response.claimed.forEach(item => {
        if (item.type === 'prefix') {
          console.log(`  Prefix: ${item.prefix} ${item.verified ? '(verified)' : '(pending verification)'}`);
        } else {
          console.log(`  GTIN: ${item.gtin} (${item.role})`);
        }
      });
    }

    if (response.conflicts.length > 0) {
      console.log('\n⚠️  Conflicts:');
      response.conflicts.forEach(conflict => {
        console.log(`  GTIN ${conflict.gtin} is claimed by ${conflict.claimed_by}`);
        console.log(`  Dispute: ${conflict.dispute_url}`);
      });
    }
  } catch (error) {
    spinner.fail(`GTIN claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

