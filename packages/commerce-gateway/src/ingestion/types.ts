/**
 * Lightweight Ingestion Types (Open Source)
 * 
 * Simple types for importing products from Shopify, Square, or CSV.
 * No database required - works with in-memory catalog.
 * 
 * @module ingestion/types
 */

import type { Product } from '../catalog/interfaces';

// ============================================================================
// Platform Types
// ============================================================================

export type Platform = 'shopify' | 'square' | 'csv' | 'json';

// ============================================================================
// Credential Types
// ============================================================================

export interface ShopifyCredentials {
  /** Store domain (e.g., 'mystore.myshopify.com') */
  domain: string;
  /** Admin API access token */
  accessToken: string;
}

export interface SquareCredentials {
  /** Square access token */
  accessToken: string;
  /** Optional location ID for inventory */
  locationId?: string;
  /** Use sandbox environment */
  sandbox?: boolean;
}

export interface CSVCredentials {
  /** Path to CSV file or CSV content string */
  source: string;
  /** Whether source is file path (true) or raw content (false) */
  isFilePath?: boolean;
  /** Column mapping configuration */
  mapping?: CSVColumnMapping;
  /** CSV delimiter character */
  delimiter?: string;
}

export interface JSONCredentials {
  /** Path to JSON file or JSON content string */
  source: string;
  /** Whether source is file path (true) or raw content (false) */
  isFilePath?: boolean;
}

export interface CSVColumnMapping {
  /** Column name for product ID */
  id: string;
  /** Column name for product name */
  name: string;
  /** Column name for price */
  price: string;
  /** Column name for description (optional) */
  description?: string;
  /** Column name for brand (optional) */
  brand?: string;
  /** Column name for category (optional) */
  category?: string;
  /** Column name for SKU (optional) */
  sku?: string;
  /** Column name for GTIN/UPC/EAN (optional) */
  gtin?: string;
  /** Column name for images (comma-separated URLs, optional) */
  images?: string;
  /** Column name for in-stock status (optional) */
  inStock?: string;
  /** Column name for quantity (optional) */
  quantity?: string;
  /** Column name for currency (optional) */
  currency?: string;
}

export type PlatformCredentials = 
  | ShopifyCredentials 
  | SquareCredentials 
  | CSVCredentials
  | JSONCredentials;

// ============================================================================
// Import Configuration
// ============================================================================

export interface ImportConfig {
  /** Platform to import from */
  platform: Platform;
  /** Platform-specific credentials */
  credentials: PlatformCredentials;
  /** Import options */
  options?: ImportOptions;
}

export interface ImportOptions {
  /** Only import products updated after this date */
  updatedSince?: Date;
  /** Skip products that are out of stock */
  skipOutOfStock?: boolean;
  /** Skip draft/inactive products (Shopify) */
  activeOnly?: boolean;
  /** Maximum number of products to import */
  limit?: number;
  /** Default currency if not specified in product */
  defaultCurrency?: string;
  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void;
}

export interface ImportProgress {
  /** Current phase of import */
  phase: 'fetching' | 'processing' | 'complete' | 'error';
  /** Products fetched from platform */
  fetched: number;
  /** Products processed so far */
  processed: number;
  /** Total products expected (if known) */
  total?: number;
  /** Current message */
  message: string;
}

// ============================================================================
// Import Results
// ============================================================================

export interface ImportResult {
  /** Whether import completed successfully */
  success: boolean;
  /** Number of products imported */
  imported: number;
  /** Number of products updated */
  updated: number;
  /** Number of products skipped */
  skipped: number;
  /** Error messages */
  errors: ImportError[];
  /** Import duration in milliseconds */
  duration: number;
  /** Imported products */
  products: Product[];
}

export interface ImportError {
  /** Product identifier (SKU, ID, or row number) */
  identifier: string;
  /** Error message */
  message: string;
  /** Whether error is recoverable */
  recoverable: boolean;
}

// ============================================================================
// Fetcher Interface
// ============================================================================

export interface ProductFetcher {
  /** Platform name */
  platform: Platform;
  
  /** Fetch all products from the platform */
  fetchAll(options?: ImportOptions): Promise<Product[]>;
  
  /** Validate credentials */
  validate(): Promise<boolean>;
}
