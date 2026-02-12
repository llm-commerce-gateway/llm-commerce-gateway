/**
 * Shopify Product Fetcher (Open Source)
 * 
 * Fetches products from Shopify stores using the Admin REST API.
 * Handles pagination, variants, images, and inventory.
 * 
 * @module ingestion/shopify-fetcher
 */

import type { Product, ProductVariant } from '../catalog/interfaces';
import type { 
  ProductFetcher, 
  ShopifyCredentials, 
  ImportOptions,
} from './types';

// ============================================================================
// Shopify API Types
// ============================================================================

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string;
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  sku: string | null;
  barcode: string | null;
  inventory_quantity: number;
  inventory_item_id: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  weight: number;
  weight_unit: string;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
  position: number;
}

// ============================================================================
// Shopify Fetcher
// ============================================================================

export class ShopifyFetcher implements ProductFetcher {
  readonly platform = 'shopify' as const;
  
  private domain: string;
  private accessToken: string;
  private apiVersion: string;

  constructor(credentials: ShopifyCredentials, apiVersion: string = '2024-01') {
    // Normalize domain (remove protocol if present)
    this.domain = credentials.domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    this.accessToken = credentials.accessToken;
    this.apiVersion = apiVersion;
  }

  /**
   * Validate credentials by fetching shop info
   */
  async validate(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://${this.domain}/admin/api/${this.apiVersion}/shop.json`,
        {
          headers: this.getHeaders(),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all products from the Shopify store
   */
  async fetchAll(options?: ImportOptions): Promise<Product[]> {
    const allProducts: Product[] = [];
    let hasNextPage = true;
    let pageInfo: string | null = null;
    let fetchedCount = 0;

    const onProgress = options?.onProgress;
    onProgress?.({
      phase: 'fetching',
      fetched: 0,
      processed: 0,
      message: 'Starting Shopify import...',
    });

    while (hasNextPage) {
      const { products, nextPageInfo } = await this.fetchPage(pageInfo, options);
      
      // Transform and filter products
      for (const shopifyProduct of products) {
        // Skip drafts if activeOnly is set
        if (options?.activeOnly && shopifyProduct.status !== 'active') {
          continue;
        }

        const product = this.transformProduct(shopifyProduct, options);
        
        // Skip out of stock if requested
        if (options?.skipOutOfStock && !product.inStock) {
          continue;
        }

        allProducts.push(product);
        fetchedCount++;

        // Check limit
        if (options?.limit && allProducts.length >= options.limit) {
          hasNextPage = false;
          break;
        }
      }

      onProgress?.({
        phase: 'fetching',
        fetched: fetchedCount,
        processed: allProducts.length,
        message: `Fetched ${fetchedCount} products...`,
      });

      pageInfo = nextPageInfo;
      hasNextPage = !!nextPageInfo && (!options?.limit || allProducts.length < options.limit);

      // Rate limiting - Shopify allows 2 requests/second
      if (hasNextPage) {
        await this.delay(500);
      }
    }

    onProgress?.({
      phase: 'complete',
      fetched: fetchedCount,
      processed: allProducts.length,
      total: allProducts.length,
      message: `Import complete: ${allProducts.length} products`,
    });

    return allProducts;
  }

  /**
   * Fetch a single page of products
   */
  private async fetchPage(
    pageInfo: string | null,
    options?: ImportOptions
  ): Promise<{ products: ShopifyProduct[]; nextPageInfo: string | null }> {
    const url = new URL(
      `https://${this.domain}/admin/api/${this.apiVersion}/products.json`
    );
    
    url.searchParams.set('limit', '250');
    
    if (pageInfo) {
      url.searchParams.set('page_info', pageInfo);
    } else {
      // Only set these on first request (not with page_info)
      if (options?.activeOnly) {
        url.searchParams.set('status', 'active');
      }
      if (options?.updatedSince) {
        url.searchParams.set('updated_at_min', options.updatedSince.toISOString());
      }
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { products: ShopifyProduct[] };

    // Extract next page info from Link header
    let nextPageInfo: string | null = null;
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
      nextPageInfo = nextMatch?.[1] ?? null;
    }

    return { products: data.products, nextPageInfo };
  }

  /**
   * Transform Shopify product to our Product type
   */
  private transformProduct(
    shopifyProduct: ShopifyProduct,
    options?: ImportOptions
  ): Product {
    const firstVariant = shopifyProduct.variants[0];
    const hasMultipleVariants = shopifyProduct.variants.length > 1;
    
    // Calculate if any variant is in stock
    const totalQuantity = shopifyProduct.variants.reduce(
      (sum, v) => sum + (v.inventory_quantity > 0 ? v.inventory_quantity : 0),
      0
    );
    const inStock = totalQuantity > 0;

    // Transform variants (skip the first one as it becomes the main product)
    const variants: ProductVariant[] = hasMultipleVariants
      ? shopifyProduct.variants.map(v => this.transformVariant(v))
      : [];

    return {
      id: `shopify-${shopifyProduct.id}`,
      externalId: String(shopifyProduct.id),
      name: shopifyProduct.title,
      description: this.stripHtml(shopifyProduct.body_html),
      brand: shopifyProduct.vendor || undefined,
      category: shopifyProduct.product_type || undefined,
      price: parseFloat(firstVariant?.price || '0'),
      compareAtPrice: firstVariant?.compare_at_price
        ? parseFloat(firstVariant.compare_at_price)
        : undefined,
      currency: options?.defaultCurrency ?? 'USD',
      images: shopifyProduct.images
        .sort((a, b) => a.position - b.position)
        .map(img => img.src),
      inStock,
      quantity: totalQuantity,
      sku: firstVariant?.sku || undefined,
      gtin: firstVariant?.barcode || undefined,
      variants: variants.length > 0 ? variants : undefined,
      metadata: {
        shopifyId: shopifyProduct.id,
        status: shopifyProduct.status,
        productType: shopifyProduct.product_type,
        vendor: shopifyProduct.vendor,
        tags: shopifyProduct.tags.split(', ').filter(Boolean),
        createdAt: shopifyProduct.created_at,
        updatedAt: shopifyProduct.updated_at,
      },
    };
  }

  /**
   * Transform Shopify variant to ProductVariant
   */
  private transformVariant(variant: ShopifyVariant): ProductVariant {
    const options: Record<string, string> = {};
    if (variant.option1) options.option1 = variant.option1;
    if (variant.option2) options.option2 = variant.option2;
    if (variant.option3) options.option3 = variant.option3;

    return {
      id: `shopify-variant-${variant.id}`,
      externalId: String(variant.id),
      name: variant.title,
      sku: variant.sku || undefined,
      price: parseFloat(variant.price),
      compareAtPrice: variant.compare_at_price
        ? parseFloat(variant.compare_at_price)
        : undefined,
      inStock: variant.inventory_quantity > 0,
      quantity: variant.inventory_quantity,
      options: Object.keys(options).length > 0 ? options : undefined,
    };
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Strip HTML tags from description
   */
  private stripHtml(html: string | null): string | undefined {
    if (!html) return undefined;
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Shopify fetcher
 */
export function createShopifyFetcher(
  credentials: ShopifyCredentials,
  apiVersion?: string
): ShopifyFetcher {
  return new ShopifyFetcher(credentials, apiVersion);
}
