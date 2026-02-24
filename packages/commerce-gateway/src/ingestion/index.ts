/**
 * Lightweight Product Ingestion (Open Source)
 * 
 * Simple product import from Shopify, Square, CSV, or JSON.
 * Designed for single-store owners to get started in <10 minutes.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { importProducts } from '@betterdata/commerce-gateway/ingestion';
 * 
 * const result = await importProducts({
 *   platform: 'shopify',
 *   credentials: {
 *     domain: 'mystore.myshopify.com',
 *     accessToken: 'shpat_xxx',
 *   },
 * });
 * 
 * console.log(`Imported ${result.imported} products`);
 * ```
 * 
 * @module ingestion
 */

import type { ProductCatalog } from '../catalog/interfaces';
import type {
  Platform,
  ImportConfig,
  ImportResult,
  ImportOptions,
  ProductFetcher,
  ShopifyCredentials,
  SquareCredentials,
  CSVCredentials,
  JSONCredentials,
} from './types';
import { ShopifyFetcher } from './shopify-fetcher';
import { SquareFetcher } from './square-fetcher';
import { CSVFetcher, JSONFetcher } from './csv-fetcher';

// ============================================================================
// Main Import Function
// ============================================================================

/**
 * Import products from a platform
 * 
 * @example
 * ```typescript
 * // Import from Shopify
 * const result = await importProducts({
 *   platform: 'shopify',
 *   credentials: {
 *     domain: 'mystore.myshopify.com',
 *     accessToken: 'shpat_xxx',
 *   },
 *   options: {
 *     activeOnly: true,
 *     skipOutOfStock: false,
 *   },
 * });
 * ```
 */
export async function importProducts(config: ImportConfig): Promise<ImportResult> {
  const startTime = Date.now();
  
  const result: ImportResult = {
    success: false,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    products: [],
  };

  try {
    // Create fetcher
    const fetcher = createFetcher(config.platform, config.credentials);

    // Validate credentials
    const isValid = await fetcher.validate();
    if (!isValid) {
      result.errors.push({
        identifier: 'credentials',
        message: `Invalid ${config.platform} credentials or configuration`,
        recoverable: false,
      });
      result.duration = Date.now() - startTime;
      return result;
    }

    // Fetch products
    const products = await fetcher.fetchAll(config.options);

    result.products = products;
    result.imported = products.length;
    result.success = true;

  } catch (error) {
    result.errors.push({
      identifier: 'import',
      message: error instanceof Error ? error.message : 'Unknown error',
      recoverable: false,
    });
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Import products and add them to a catalog
 * 
 * @example
 * ```typescript
 * const catalog = createInMemoryCatalog();
 * 
 * const result = await importToCatalog(catalog, {
 *   platform: 'shopify',
 *   credentials: { domain: 'mystore.myshopify.com', accessToken: 'xxx' },
 * });
 * 
 * console.log(`Catalog now has ${catalog.count()} products`);
 * ```
 */
export async function importToCatalog(
  catalog: ProductCatalog,
  config: ImportConfig
): Promise<ImportResult> {
  const importResult = await importProducts(config);
  
  if (!importResult.success || importResult.products.length === 0) {
    return importResult;
  }

  // Check for existing products to track updates vs imports
  let updated = 0;
  let imported = 0;

  for (const product of importResult.products) {
    try {
      const existing = await catalog.getProduct(product.id);
      await catalog.upsertProduct(product);
      
      if (existing) {
        updated++;
      } else {
        imported++;
      }
    } catch (error) {
      importResult.errors.push({
        identifier: product.id,
        message: error instanceof Error ? error.message : 'Failed to save product',
        recoverable: true,
      });
    }
  }

  importResult.imported = imported;
  importResult.updated = updated;

  return importResult;
}

// ============================================================================
// Fetcher Factory
// ============================================================================

/**
 * Create a product fetcher for a platform
 */
export function createFetcher(
  platform: Platform,
  credentials: ShopifyCredentials | SquareCredentials | CSVCredentials | JSONCredentials
): ProductFetcher {
  switch (platform) {
    case 'shopify':
      return new ShopifyFetcher(credentials as ShopifyCredentials);
    case 'square':
      return new SquareFetcher(credentials as SquareCredentials);
    case 'csv':
      return new CSVFetcher(credentials as CSVCredentials);
    case 'json':
      return new JSONFetcher(credentials as JSONCredentials);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Import products from Shopify
 */
export async function importFromShopify(
  domain: string,
  accessToken: string,
  options?: ImportOptions
): Promise<ImportResult> {
  return importProducts({
    platform: 'shopify',
    credentials: { domain, accessToken },
    options,
  });
}

/**
 * Import products from Square
 */
export async function importFromSquare(
  accessToken: string,
  options?: ImportOptions & { locationId?: string; sandbox?: boolean }
): Promise<ImportResult> {
  return importProducts({
    platform: 'square',
    credentials: {
      accessToken,
      locationId: options?.locationId,
      sandbox: options?.sandbox,
    },
    options,
  });
}

/**
 * Import products from CSV file
 */
export async function importFromCSV(
  filePath: string,
  options?: ImportOptions & { mapping?: CSVCredentials['mapping']; delimiter?: string }
): Promise<ImportResult> {
  return importProducts({
    platform: 'csv',
    credentials: {
      source: filePath,
      isFilePath: true,
      mapping: options?.mapping,
      delimiter: options?.delimiter,
    },
    options,
  });
}

/**
 * Import products from JSON file
 */
export async function importFromJSON(
  filePath: string,
  options?: ImportOptions
): Promise<ImportResult> {
  return importProducts({
    platform: 'json',
    credentials: {
      source: filePath,
      isFilePath: true,
    },
    options,
  });
}

// ============================================================================
// Exports
// ============================================================================

// Types
export type {
  Platform,
  ImportConfig,
  ImportResult,
  ImportOptions,
  ImportProgress,
  ImportError,
  ProductFetcher,
  ShopifyCredentials,
  SquareCredentials,
  CSVCredentials,
  JSONCredentials,
  CSVColumnMapping,
  PlatformCredentials,
} from './types';

// Fetchers
export { ShopifyFetcher, createShopifyFetcher } from './shopify-fetcher';
export { SquareFetcher, createSquareFetcher } from './square-fetcher';
export { CSVFetcher, JSONFetcher, createCSVFetcher, createJSONFetcher, DEFAULT_CSV_MAPPING } from './csv-fetcher';
