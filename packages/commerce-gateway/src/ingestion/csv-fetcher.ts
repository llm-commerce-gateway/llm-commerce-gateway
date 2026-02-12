/**
 * CSV/JSON Product Fetcher (Open Source)
 * 
 * Parses products from CSV or JSON files for manual import.
 * 
 * @module ingestion/csv-fetcher
 */

import * as fs from 'fs';
import type { Product } from '../catalog/interfaces';
import type { 
  ProductFetcher, 
  CSVCredentials,
  JSONCredentials,
  CSVColumnMapping,
  ImportOptions,
} from './types';

// ============================================================================
// Default CSV Column Mapping
// ============================================================================

export const DEFAULT_CSV_MAPPING: CSVColumnMapping = {
  id: 'id',
  name: 'name',
  price: 'price',
  description: 'description',
  brand: 'brand',
  category: 'category',
  sku: 'sku',
  gtin: 'gtin',
  images: 'images',
  inStock: 'in_stock',
  quantity: 'quantity',
  currency: 'currency',
};

// ============================================================================
// CSV Fetcher
// ============================================================================

export class CSVFetcher implements ProductFetcher {
  readonly platform = 'csv' as const;
  
  private source: string;
  private isFilePath: boolean;
  private mapping: CSVColumnMapping;
  private delimiter: string;

  constructor(credentials: CSVCredentials) {
    this.source = credentials.source;
    this.isFilePath = credentials.isFilePath ?? true;
    this.mapping = { ...DEFAULT_CSV_MAPPING, ...credentials.mapping };
    this.delimiter = credentials.delimiter ?? ',';
  }

  /**
   * Validate that the CSV source exists/is valid
   */
  async validate(): Promise<boolean> {
    try {
      if (this.isFilePath) {
        return fs.existsSync(this.source);
      }
      // For raw content, check if it's non-empty
      return this.source.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetch and parse all products from CSV
   */
  async fetchAll(options?: ImportOptions): Promise<Product[]> {
    const onProgress = options?.onProgress;
    
    onProgress?.({
      phase: 'fetching',
      fetched: 0,
      processed: 0,
      message: 'Reading CSV file...',
    });

    // Read CSV content
    let csvContent: string;
    if (this.isFilePath) {
      csvContent = fs.readFileSync(this.source, 'utf-8');
    } else {
      csvContent = this.source;
    }

    // Parse CSV
    const rows = this.parseCSV(csvContent);
    
    onProgress?.({
      phase: 'processing',
      fetched: rows.length,
      processed: 0,
      message: `Parsing ${rows.length} rows...`,
    });

    // Transform rows to products
    const products: Product[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      try {
        const product = this.transformRow(row, i, options);
        
        if (!product) continue;
        
        // Skip out of stock if requested
        if (options?.skipOutOfStock && !product.inStock) {
          continue;
        }

        products.push(product);

        // Check limit
        if (options?.limit && products.length >= options.limit) {
          break;
        }
      } catch (error) {
        console.warn(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }

      if (i % 100 === 0) {
        onProgress?.({
          phase: 'processing',
          fetched: rows.length,
          processed: i + 1,
          message: `Processing row ${i + 1} of ${rows.length}...`,
        });
      }
    }

    onProgress?.({
      phase: 'complete',
      fetched: rows.length,
      processed: products.length,
      total: products.length,
      message: `Import complete: ${products.length} products`,
    });

    return products;
  }

  /**
   * Parse CSV content into row objects
   */
  private parseCSV(content: string): Record<string, string>[] {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }

    // Parse header row
    if (lines.length === 0) return [];
    const firstLine = lines[0];
    if (!firstLine) {
      throw new Error('CSV file is empty or has no header row');
    }
    const headers = this.parseLine(firstLine);
    if (!headers) return [];
    
    // Parse data rows
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = this.parseLine(line);
      if (!values) continue;
      const row: Record<string, string> = {};
      
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (!header) continue;
        row[header] = values[j] || '';
      }
      
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line (handles quoted values)
   */
  private parseLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === this.delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Transform a CSV row to a Product
   */
  private transformRow(
    row: Record<string, string>,
    index: number,
    options?: ImportOptions
  ): Product | null {
    const getValue = (col?: string): string | undefined => {
      if (!col) return undefined;
      const val = row[col]?.trim();
      return val || undefined;
    };

    const getNumber = (col?: string): number | undefined => {
      const val = getValue(col);
      if (!val) return undefined;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    const getBool = (col?: string, defaultVal: boolean = true): boolean => {
      const val = getValue(col)?.toLowerCase();
      if (!val) return defaultVal;
      return val === 'true' || val === '1' || val === 'yes' || val === 'y';
    };

    // Required fields
    const id = getValue(this.mapping.id) || `csv-${index}`;
    const name = getValue(this.mapping.name);
    const price = getNumber(this.mapping.price);

    if (!name) {
      return null; // Skip rows without a name
    }

    // Parse images (comma-separated)
    let images: string[] | undefined;
    const imagesVal = getValue(this.mapping.images);
    if (imagesVal) {
      images = imagesVal.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      id,
      name,
      description: getValue(this.mapping.description),
      brand: getValue(this.mapping.brand),
      category: getValue(this.mapping.category),
      price: price ?? 0,
      currency: getValue(this.mapping.currency) ?? options?.defaultCurrency ?? 'USD',
      images,
      inStock: getBool(this.mapping.inStock, true),
      quantity: getNumber(this.mapping.quantity),
      sku: getValue(this.mapping.sku),
      gtin: getValue(this.mapping.gtin),
      metadata: {
        sourceRow: index + 2, // 1-indexed, +1 for header
      },
    };
  }
}

// ============================================================================
// JSON Fetcher
// ============================================================================

export class JSONFetcher implements ProductFetcher {
  readonly platform = 'json' as const;
  
  private source: string;
  private isFilePath: boolean;

  constructor(credentials: JSONCredentials) {
    this.source = credentials.source;
    this.isFilePath = credentials.isFilePath ?? true;
  }

  /**
   * Validate that the JSON source exists/is valid
   */
  async validate(): Promise<boolean> {
    try {
      if (this.isFilePath) {
        return fs.existsSync(this.source);
      }
      JSON.parse(this.source);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch and parse all products from JSON
   */
  async fetchAll(options?: ImportOptions): Promise<Product[]> {
    const onProgress = options?.onProgress;
    
    onProgress?.({
      phase: 'fetching',
      fetched: 0,
      processed: 0,
      message: 'Reading JSON file...',
    });

    // Read JSON content
    let jsonContent: string;
    if (this.isFilePath) {
      jsonContent = fs.readFileSync(this.source, 'utf-8');
    } else {
      jsonContent = this.source;
    }

    // Parse JSON
    const data = JSON.parse(jsonContent);
    
    // Handle both array and object with products key
    let rawProducts: unknown[];
    if (Array.isArray(data)) {
      rawProducts = data;
    } else if (data.products && Array.isArray(data.products)) {
      rawProducts = data.products;
    } else {
      throw new Error('JSON must be an array or object with "products" array');
    }

    onProgress?.({
      phase: 'processing',
      fetched: rawProducts.length,
      processed: 0,
      message: `Processing ${rawProducts.length} products...`,
    });

    // Transform and filter products
    const products: Product[] = [];
    
    for (let i = 0; i < rawProducts.length; i++) {
      const raw = rawProducts[i] as Record<string, unknown>;
      
      const product = this.transformProduct(raw, i, options);
      
      if (!product) continue;
      
      // Skip out of stock if requested
      if (options?.skipOutOfStock && !product.inStock) {
        continue;
      }

      products.push(product);

      // Check limit
      if (options?.limit && products.length >= options.limit) {
        break;
      }
    }

    onProgress?.({
      phase: 'complete',
      fetched: rawProducts.length,
      processed: products.length,
      total: products.length,
      message: `Import complete: ${products.length} products`,
    });

    return products;
  }

  /**
   * Transform a JSON object to a Product
   */
  private transformProduct(
    raw: Record<string, unknown>,
    index: number,
    options?: ImportOptions
  ): Product | null {
    const getString = (key: string): string | undefined => {
      const val = raw[key];
      return typeof val === 'string' ? val : undefined;
    };

    const getNumber = (key: string): number | undefined => {
      const val = raw[key];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      }
      return undefined;
    };

    const getBool = (key: string, defaultVal: boolean = true): boolean => {
      const val = raw[key];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        return lower === 'true' || lower === '1' || lower === 'yes';
      }
      return defaultVal;
    };

    const id = getString('id') || `json-${index}`;
    const name = getString('name') || getString('title');
    
    if (!name) {
      return null;
    }

    // Handle images array
    let images: string[] | undefined;
    if (Array.isArray(raw.images)) {
      images = raw.images.filter((img): img is string => typeof img === 'string');
    } else if (typeof raw.image === 'string') {
      images = [raw.image];
    }

    return {
      id,
      externalId: getString('externalId') || getString('external_id'),
      name,
      description: getString('description'),
      brand: getString('brand') || getString('vendor'),
      category: getString('category') || getString('product_type'),
      price: getNumber('price') ?? 0,
      compareAtPrice: getNumber('compareAtPrice') || getNumber('compare_at_price'),
      currency: getString('currency') ?? options?.defaultCurrency ?? 'USD',
      images,
      inStock: getBool('inStock', true) && getBool('in_stock', true),
      quantity: getNumber('quantity') || getNumber('inventory_quantity'),
      sku: getString('sku'),
      gtin: getString('gtin') || getString('barcode') || getString('upc'),
      metadata: raw.metadata as Record<string, unknown> | undefined,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CSV fetcher
 */
export function createCSVFetcher(credentials: CSVCredentials): CSVFetcher {
  return new CSVFetcher(credentials);
}

/**
 * Create a JSON fetcher
 */
export function createJSONFetcher(credentials: JSONCredentials): JSONFetcher {
  return new JSONFetcher(credentials);
}
