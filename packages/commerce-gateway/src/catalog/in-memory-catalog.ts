/**
 * In-Memory Product Catalog (Open Source)
 * 
 * Simple product storage for single-store scenarios.
 * Load products from JSON, CSV, or API calls.
 * 
 * For multi-vendor catalog with ProductMaster matching, use SCM's MarketplaceCatalog.
 * 
 * @module catalog/in-memory-catalog
 */

import type {
  ProductCatalog,
  Product,
} from './interfaces';

// ============================================================================
// In-Memory Catalog
// ============================================================================

/**
 * Simple in-memory product catalog
 * 
 * Features:
 * - Fast lookups by ID
 * - Add/update/remove products
 * - List with pagination
 * 
 * NOT included (SCM features):
 * - ProductMaster matching
 * - Multi-vendor listings
 * - Search indexing
 * - GTIN/SKU matching
 */
export class InMemoryCatalog implements ProductCatalog {
  private products = new Map<string, Product>();

  constructor(initialProducts?: Product[]) {
    if (initialProducts) {
      for (const product of initialProducts) {
        this.products.set(product.id, product);
      }
    }
  }

  /**
   * Get a product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    return this.products.get(productId) ?? null;
  }

  /**
   * Get multiple products by IDs
   */
  async getProducts(productIds: string[]): Promise<Product[]> {
    const results: Product[] = [];
    for (const id of productIds) {
      const product = this.products.get(id);
      if (product) {
        results.push(product);
      }
    }
    return results;
  }

  /**
   * Add or update a product
   */
  async upsertProduct(product: Product): Promise<Product> {
    this.products.set(product.id, product);
    return product;
  }

  /**
   * Bulk upsert products
   */
  async upsertProducts(products: Product[]): Promise<void> {
    for (const product of products) {
      this.products.set(product.id, product);
    }
  }

  /**
   * Remove a product
   */
  async removeProduct(productId: string): Promise<void> {
    this.products.delete(productId);
  }

  /**
   * List all products with pagination
   */
  async listProducts(options?: { limit?: number; offset?: number }): Promise<Product[]> {
    const all = Array.from(this.products.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? all.length;
    return all.slice(offset, offset + limit);
  }

  /**
   * Get total product count
   */
  count(): number {
    return this.products.size;
  }

  /**
   * Clear all products
   */
  clear(): void {
    this.products.clear();
  }

  /**
   * Load products from JSON array
   */
  loadFromJSON(json: Product[]): void {
    for (const product of json) {
      this.products.set(product.id, product);
    }
  }

  /**
   * Export products to JSON array
   */
  toJSON(): Product[] {
    return Array.from(this.products.values());
  }
}

// ============================================================================
// CSV Import Utility
// ============================================================================

/**
 * CSV column mapping configuration
 */
export interface CSVColumnMapping {
  id: string;
  name: string;
  price: string;
  description?: string;
  brand?: string;
  category?: string;
  sku?: string;
  gtin?: string;
  images?: string;  // Comma-separated URLs
  inStock?: string; // 'true', 'false', '1', '0', 'yes', 'no'
  quantity?: string;
  currency?: string;
}

/**
 * Parse a CSV row into a Product
 */
export function parseCSVRow(
  row: Record<string, string>,
  mapping: CSVColumnMapping,
  defaultCurrency: string = 'USD'
): Product {
  const getValue = (col?: string) => col ? row[col]?.trim() : undefined;
  const getNumber = (col?: string) => {
    const val = getValue(col);
    return val ? parseFloat(val) : undefined;
  };
  const getBool = (col?: string) => {
    const val = getValue(col)?.toLowerCase();
    return val === 'true' || val === '1' || val === 'yes';
  };

  const id = getValue(mapping.id);
  const name = getValue(mapping.name);
  const price = getNumber(mapping.price);

  if (!id || !name || price === undefined) {
    throw new Error('Missing required fields: id, name, price');
  }

  return {
    id,
    name,
    price,
    description: getValue(mapping.description),
    brand: getValue(mapping.brand),
    category: getValue(mapping.category),
    sku: getValue(mapping.sku),
    gtin: getValue(mapping.gtin),
    images: getValue(mapping.images)?.split(',').map(s => s.trim()).filter(Boolean),
    inStock: mapping.inStock ? getBool(mapping.inStock) : true,
    quantity: getNumber(mapping.quantity),
    currency: getValue(mapping.currency) ?? defaultCurrency,
  };
}

/**
 * Load products from CSV data
 * Expects an array of row objects (as produced by csv-parse or similar)
 */
export function loadProductsFromCSV(
  rows: Record<string, string>[],
  mapping: CSVColumnMapping,
  options?: { 
    defaultCurrency?: string;
    skipErrors?: boolean;
  }
): { products: Product[]; errors: Array<{ row: number; error: string }> } {
  const products: Product[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      if (!row) continue;
      const product = parseCSVRow(row, mapping, options?.defaultCurrency);
      products.push(product);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (options?.skipErrors) {
        errors.push({ row: i, error: msg });
      } else {
        throw new Error(`Row ${i}: ${msg}`);
      }
    }
  }

  return { products, errors };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty in-memory catalog
 */
export function createInMemoryCatalog(products?: Product[]): InMemoryCatalog {
  return new InMemoryCatalog(products);
}

/**
 * Create a catalog from JSON file content
 */
export function createCatalogFromJSON(json: Product[]): InMemoryCatalog {
  const catalog = new InMemoryCatalog();
  catalog.loadFromJSON(json);
  return catalog;
}
