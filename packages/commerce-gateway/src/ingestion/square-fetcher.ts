/**
 * Square Product Fetcher (Open Source)
 * 
 * Fetches products from Square using the Catalog API.
 * Includes inventory counts from the Inventory API.
 * 
 * @module ingestion/square-fetcher
 */

import type { Product, ProductVariant } from '../catalog/interfaces';
import type { 
  ProductFetcher, 
  SquareCredentials, 
  ImportOptions,
} from './types';

// ============================================================================
// Square API Types
// ============================================================================

interface SquareCatalogObject {
  type: 'ITEM' | 'ITEM_VARIATION' | 'CATEGORY' | 'IMAGE';
  id: string;
  version?: number;
  is_deleted?: boolean;
  item_data?: SquareItemData;
  item_variation_data?: SquareVariationData;
  image_data?: SquareImageData;
}

interface SquareItemData {
  name: string;
  description?: string;
  category_id?: string;
  product_type?: string;
  variations?: SquareCatalogObject[];
  image_ids?: string[];
}

interface SquareVariationData {
  item_id: string;
  name: string;
  sku?: string;
  upc?: string;
  price_money?: SquareMoney;
}

interface SquareImageData {
  url?: string;
  caption?: string;
}

interface SquareMoney {
  amount: number;
  currency: string;
}

interface SquareInventoryCount {
  catalog_object_id: string;
  location_id: string;
  quantity: string;
  state: 'IN_STOCK' | 'SOLD' | 'RETURNED_BY_CUSTOMER' | 'RESERVED_FOR_SALE';
}

// ============================================================================
// Square Fetcher
// ============================================================================

export class SquareFetcher implements ProductFetcher {
  readonly platform = 'square' as const;
  
  private accessToken: string;
  private locationId?: string;
  private baseUrl: string;

  constructor(credentials: SquareCredentials) {
    this.accessToken = credentials.accessToken;
    this.locationId = credentials.locationId;
    this.baseUrl = credentials.sandbox
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
  }

  /**
   * Validate credentials by fetching locations
   */
  async validate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/locations`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all products from Square
   */
  async fetchAll(options?: ImportOptions): Promise<Product[]> {
    const onProgress = options?.onProgress;
    
    onProgress?.({
      phase: 'fetching',
      fetched: 0,
      processed: 0,
      message: 'Fetching catalog from Square...',
    });

    // 1. Fetch all catalog items
    const catalogItems = await this.fetchCatalogItems();
    
    onProgress?.({
      phase: 'fetching',
      fetched: catalogItems.length,
      processed: 0,
      message: `Fetched ${catalogItems.length} catalog items`,
    });

    // 2. Fetch images
    const images = await this.fetchImages();
    const imageMap = new Map(images.map(img => [img.id, img.image_data?.url]));

    // 3. Fetch inventory counts
    const variationIds = catalogItems.flatMap(item => 
      item.item_data?.variations?.map(v => v.id) || []
    );
    
    let inventoryMap = new Map<string, number>();
    if (variationIds.length > 0) {
      onProgress?.({
        phase: 'fetching',
        fetched: catalogItems.length,
        processed: 0,
        message: 'Fetching inventory counts...',
      });
      inventoryMap = await this.fetchInventoryCounts(variationIds);
    }

    // 4. Transform to products
    const products: Product[] = [];
    
    for (const item of catalogItems) {
      const product = this.transformItem(item, imageMap, inventoryMap, options);
      
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
      fetched: catalogItems.length,
      processed: products.length,
      total: products.length,
      message: `Import complete: ${products.length} products`,
    });

    return products;
  }

  /**
   * Fetch all catalog items with pagination
   */
  private async fetchCatalogItems(): Promise<SquareCatalogObject[]> {
    const items: SquareCatalogObject[] = [];
    let cursor: string | undefined;

    do {
      const response = await fetch(`${this.baseUrl}/v2/catalog/list`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Square API error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        objects?: SquareCatalogObject[];
        cursor?: string;
      };

      if (data.objects) {
        items.push(
          ...data.objects.filter(obj => 
            obj.type === 'ITEM' && !obj.is_deleted
          )
        );
      }

      cursor = data.cursor;
    } while (cursor);

    return items;
  }

  /**
   * Fetch all images
   */
  private async fetchImages(): Promise<SquareCatalogObject[]> {
    const images: SquareCatalogObject[] = [];
    let cursor: string | undefined;

    do {
      const url = new URL(`${this.baseUrl}/v2/catalog/list`);
      url.searchParams.set('types', 'IMAGE');
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        // Images are optional, don't fail
        console.warn('Failed to fetch Square images');
        break;
      }

      const data = await response.json() as {
        objects?: SquareCatalogObject[];
        cursor?: string;
      };

      if (data.objects) {
        images.push(...data.objects);
      }

      cursor = data.cursor;
    } while (cursor);

    return images;
  }

  /**
   * Fetch inventory counts for variations
   */
  private async fetchInventoryCounts(
    variationIds: string[]
  ): Promise<Map<string, number>> {
    const inventoryMap = new Map<string, number>();

    // Square limits to 100 IDs per request
    const batches = this.chunk(variationIds, 100);

    for (const batch of batches) {
      const body: Record<string, unknown> = {
        catalog_object_ids: batch,
      };

      if (this.locationId) {
        body.location_ids = [this.locationId];
      }

      const response = await fetch(
        `${this.baseUrl}/v2/inventory/counts/batch-retrieve`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        // Inventory is optional, don't fail
        console.warn('Failed to fetch Square inventory');
        continue;
      }

      const data = await response.json() as {
        counts?: SquareInventoryCount[];
      };

      if (data.counts) {
        for (const count of data.counts) {
          if (count.state === 'IN_STOCK') {
            const quantity = parseInt(count.quantity, 10) || 0;
            const existing = inventoryMap.get(count.catalog_object_id) || 0;
            inventoryMap.set(count.catalog_object_id, existing + quantity);
          }
        }
      }
    }

    return inventoryMap;
  }

  /**
   * Transform Square catalog item to Product
   */
  private transformItem(
    item: SquareCatalogObject,
    imageMap: Map<string, string | undefined>,
    inventoryMap: Map<string, number>,
    options?: ImportOptions
  ): Product | null {
    const itemData = item.item_data;
    if (!itemData?.name) return null;

    const variations = itemData.variations || [];
    if (variations.length === 0) return null;

    const firstVariation = variations[0];
    if (!firstVariation) throw new Error('No variation');
    const firstVarData = firstVariation.item_variation_data;

    // Calculate total quantity
    const totalQuantity = variations.reduce((sum, v) => {
      return sum + (inventoryMap.get(v.id) || 0);
    }, 0);

    // Get images
    const images: string[] = [];
    for (const imageId of itemData.image_ids || []) {
      const url = imageMap.get(imageId);
      if (url) images.push(url);
    }

    // Get price from first variation (Square prices are in cents)
    const priceInCents = firstVarData?.price_money?.amount || 0;
    const price = priceInCents / 100;
    const currency = firstVarData?.price_money?.currency || options?.defaultCurrency || 'USD';

    // Transform variants
    const productVariants: ProductVariant[] = variations.length > 1
      ? variations.map(v => this.transformVariation(v, inventoryMap))
      : [];

    return {
      id: `square-${item.id}`,
      externalId: item.id,
      name: itemData.name,
      description: itemData.description,
      category: itemData.category_id,
      price,
      currency,
      images,
      inStock: totalQuantity > 0,
      quantity: totalQuantity,
      sku: firstVarData?.sku,
      gtin: firstVarData?.upc,
      variants: productVariants.length > 0 ? productVariants : undefined,
      metadata: {
        squareId: item.id,
        squareVersion: item.version,
        productType: itemData.product_type,
        categoryId: itemData.category_id,
      },
    };
  }

  /**
   * Transform Square variation to ProductVariant
   */
  private transformVariation(
    variation: SquareCatalogObject,
    inventoryMap: Map<string, number>
  ): ProductVariant {
    const varData = variation.item_variation_data;
    const priceInCents = varData?.price_money?.amount || 0;
    const quantity = inventoryMap.get(variation.id) || 0;

    return {
      id: `square-variant-${variation.id}`,
      externalId: variation.id,
      name: varData?.name || 'Variant',
      sku: varData?.sku,
      price: priceInCents / 100,
      inStock: quantity > 0,
      quantity,
    };
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Square-Version': '2024-01-18',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Split array into chunks
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Square fetcher
 */
export function createSquareFetcher(credentials: SquareCredentials): SquareFetcher {
  return new SquareFetcher(credentials);
}
