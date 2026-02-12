/**
 * Basic Ingestion Service (Open Source)
 * 
 * Simple product ingestion for single-store catalogs.
 * Supports CSV import and basic Shopify/Square fetching.
 * 
 * For multi-vendor ingestion with ProductMaster matching,
 * use SCM's advanced ingestion pipeline.
 * 
 * @module catalog/basic-ingestion
 */

import type {
  IngestionService,
  IngestionResult,
  Product,
  ProductCatalog,
  PlatformConfig,
} from './interfaces';
import { parseCSVRow, type CSVColumnMapping } from './in-memory-catalog';

// ============================================================================
// Basic Ingestion Service
// ============================================================================

export interface BasicIngestionServiceConfig {
  catalog: ProductCatalog;
  onProgress?: (progress: IngestionProgress) => void;
}

export interface IngestionProgress {
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  status: 'processing' | 'complete' | 'error';
}

/**
 * Basic ingestion service for open source gateway
 * 
 * Features:
 * - Import products from JSON/CSV
 * - Basic Shopify/Square API fetching
 * - Simple upsert to catalog
 * 
 * NOT included (SCM features):
 * - ProductMaster matching
 * - Multi-vendor deduplication
 * - Search index updates
 * - Platform account management
 */
export class BasicIngestionService implements IngestionService {
  private catalog: ProductCatalog;
  private onProgress?: (progress: IngestionProgress) => void;

  constructor(config: BasicIngestionServiceConfig) {
    this.catalog = config.catalog;
    this.onProgress = config.onProgress;
  }

  /**
   * Import products into the catalog
   */
  async importProducts(products: Product[]): Promise<IngestionResult> {
    const result: IngestionResult = {
      totalProcessed: products.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product) continue;
      
      try {
        // Check if product exists
        const existing = await this.catalog.getProduct(product.id);
        
        // Upsert product
        await this.catalog.upsertProduct(product);
        
        if (existing) {
          result.updated++;
        } else {
          result.created++;
        }

        // Emit progress
        this.onProgress?.({
          total: products.length,
          processed: i + 1,
          created: result.created,
          updated: result.updated,
          failed: result.failed,
          status: 'processing',
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: product.id,
          sku: product.sku,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.onProgress?.({
      total: products.length,
      processed: products.length,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
      status: 'complete',
    });

    return result;
  }

  /**
   * Import products from CSV data
   */
  async importFromCSV(
    rows: Record<string, string>[],
    mapping: CSVColumnMapping,
    options?: { defaultCurrency?: string }
  ): Promise<IngestionResult> {
    const products: Product[] = [];
    const errors: IngestionResult['errors'] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (!row) continue;
        const product = parseCSVRow(row, mapping, options?.defaultCurrency);
        products.push(product);
      } catch (error) {
        errors.push({
          productId: `row-${i}`,
          error: error instanceof Error ? error.message : 'Parse error',
        });
      }
    }

    // Import the successfully parsed products
    const result = await this.importProducts(products);

    // Add parse errors to the result
    result.errors.push(...errors);
    result.failed += errors.length;

    return result;
  }

  /**
   * Sync from external platform
   */
  async syncFromPlatform(platformConfig: PlatformConfig): Promise<IngestionResult> {
    switch (platformConfig.platform) {
      case 'shopify':
        return this.syncFromShopify(platformConfig);
      case 'square':
        return this.syncFromSquare(platformConfig);
      case 'csv':
        throw new Error('Use importFromCSV() for CSV imports');
      default:
        throw new Error(`Unsupported platform: ${platformConfig.platform}`);
    }
  }

  /**
   * Sync from Shopify store
   */
  private async syncFromShopify(config: PlatformConfig): Promise<IngestionResult> {
    const credentials = config.credentials as {
      domain: string;
      accessToken: string;
    };

    if (!credentials?.domain || !credentials?.accessToken) {
      throw new Error('Shopify sync requires domain and accessToken');
    }

    // Fetch products from Shopify
    const products = await this.fetchShopifyProducts(
      credentials.domain,
      credentials.accessToken
    );

    return this.importProducts(products);
  }

  /**
   * Fetch products from Shopify Admin API
   */
  private async fetchShopifyProducts(
    domain: string,
    accessToken: string
  ): Promise<Product[]> {
    const url = `https://${domain}/admin/api/2024-01/products.json?limit=250`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json() as {
      products: ShopifyProduct[];
    };

    return data.products.map(this.mapShopifyProduct);
  }

  /**
   * Map Shopify product to our Product type
   */
  private mapShopifyProduct(shopifyProduct: ShopifyProduct): Product {
    const variant = shopifyProduct.variants?.[0];
    
    return {
      id: `shopify-${shopifyProduct.id}`,
      externalId: String(shopifyProduct.id),
      name: shopifyProduct.title,
      description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '') || '',
      brand: shopifyProduct.vendor || undefined,
      category: shopifyProduct.product_type || undefined,
      price: parseFloat(variant?.price || '0'),
      compareAtPrice: variant?.compare_at_price 
        ? parseFloat(variant.compare_at_price) 
        : undefined,
      currency: 'USD',
      images: shopifyProduct.images?.map(img => img.src) || [],
      inStock: variant?.inventory_quantity ? variant.inventory_quantity > 0 : true,
      quantity: variant?.inventory_quantity,
      sku: variant?.sku || undefined,
      gtin: variant?.barcode || undefined,
      variants: shopifyProduct.variants?.slice(1).map(v => {
        // Build options record, filtering out undefined values
        const options: Record<string, string> = {};
        if (v.option1) options.option1 = v.option1;
        if (v.option2) options.option2 = v.option2;
        if (v.option3) options.option3 = v.option3;
        
        return {
          id: `shopify-variant-${v.id}`,
          externalId: String(v.id),
          name: v.title,
          sku: v.sku || undefined,
          price: parseFloat(v.price || '0'),
          compareAtPrice: v.compare_at_price 
            ? parseFloat(v.compare_at_price) 
            : undefined,
          inStock: v.inventory_quantity ? v.inventory_quantity > 0 : true,
          quantity: v.inventory_quantity,
          options,
        };
      }),
    };
  }

  /**
   * Sync from Square merchant
   */
  private async syncFromSquare(config: PlatformConfig): Promise<IngestionResult> {
    const credentials = config.credentials as {
      accessToken: string;
      locationId?: string;
    };

    if (!credentials?.accessToken) {
      throw new Error('Square sync requires accessToken');
    }

    const products = await this.fetchSquareProducts(
      credentials.accessToken,
      credentials.locationId
    );

    return this.importProducts(products);
  }

  /**
   * Fetch products from Square Catalog API
   */
  private async fetchSquareProducts(
    accessToken: string,
    _locationId?: string
  ): Promise<Product[]> {
    const url = 'https://connect.squareup.com/v2/catalog/list?types=ITEM';
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Square API error: ${response.status}`);
    }

    const data = await response.json() as {
      objects?: SquareCatalogItem[];
    };

    return (data.objects || [])
      .filter(obj => obj.type === 'ITEM')
      .map(this.mapSquareProduct);
  }

  /**
   * Map Square catalog item to our Product type
   */
  private mapSquareProduct(item: SquareCatalogItem): Product {
    const itemData = item.item_data;
    const variation = itemData?.variations?.[0];
    const variationData = variation?.item_variation_data;
    
    // Square prices are in smallest currency unit (cents)
    const priceInCents = variationData?.price_money?.amount || 0;
    const price = priceInCents / 100;

    return {
      id: `square-${item.id}`,
      externalId: item.id,
      name: itemData?.name || 'Unknown',
      description: itemData?.description || '',
      category: itemData?.category_id || undefined,
      price,
      currency: variationData?.price_money?.currency || 'USD',
      images: itemData?.image_ids?.map(id => `https://squareup.com/images/${id}`) || [],
      inStock: true, // Would need inventory API for actual stock
      sku: variationData?.sku || undefined,
      gtin: variationData?.upc || undefined,
      variants: itemData?.variations?.slice(1).map(v => {
        const vData = v.item_variation_data;
        const vPrice = (vData?.price_money?.amount || 0) / 100;
        return {
          id: `square-variation-${v.id}`,
          externalId: v.id,
          name: vData?.name || 'Variant',
          sku: vData?.sku || undefined,
          price: vPrice,
          inStock: true,
        };
      }),
    };
  }
}

// ============================================================================
// Type Definitions for External APIs
// ============================================================================

interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  images?: Array<{ src: string }>;
  variants?: Array<{
    id: number;
    title: string;
    price?: string;
    compare_at_price?: string;
    sku?: string;
    barcode?: string;
    inventory_quantity?: number;
    option1?: string;
    option2?: string;
    option3?: string;
  }>;
}

interface SquareCatalogItem {
  type: string;
  id: string;
  item_data?: {
    name?: string;
    description?: string;
    category_id?: string;
    image_ids?: string[];
    variations?: Array<{
      id: string;
      item_variation_data?: {
        name?: string;
        sku?: string;
        upc?: string;
        price_money?: {
          amount: number;
          currency: string;
        };
      };
    }>;
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a basic ingestion service
 */
export function createBasicIngestionService(
  catalog: ProductCatalog,
  options?: {
    onProgress?: (progress: IngestionProgress) => void;
  }
): BasicIngestionService {
  return new BasicIngestionService({
    catalog,
    onProgress: options?.onProgress,
  });
}
