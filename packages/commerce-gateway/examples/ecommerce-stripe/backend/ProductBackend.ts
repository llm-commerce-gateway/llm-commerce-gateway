/**
 * E-Commerce with Stripe - Product Backend
 * 
 * JSON file-based product catalog implementation.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ProductBackend, Product, ProductFilters, ProductSearchResult, InventoryStatus, Recommendation } from '@betterdata/commerce-gateway/backends';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface StoredProduct {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  category: string;
  tags: string[];
  images: string[];
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    inventory: number;
  }>;
  attributes: Record<string, string>;
  inStock: boolean;
  rating: number;
  reviewCount: number;
}

export class JsonProductBackend implements ProductBackend {
  private products: StoredProduct[];

  constructor() {
    const dataPath = join(__dirname, '../data/products.json');
    this.products = JSON.parse(readFileSync(dataPath, 'utf-8'));
  }

  async searchProducts(
    query: string,
    filters?: ProductFilters,
    options?: { limit?: number; offset?: number }
  ): Promise<ProductSearchResult> {
    let results = this.products;
    const q = query.toLowerCase();

    // Text search
    if (query) {
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters?.category) {
      results = results.filter(p => p.category.toLowerCase() === filters.category!.toLowerCase());
    }
    if (filters?.priceMin !== undefined) {
      results = results.filter(p => p.price >= filters.priceMin!);
    }
    if (filters?.priceMax !== undefined) {
      results = results.filter(p => p.price <= filters.priceMax!);
    }
    if (filters?.inStock !== undefined) {
      results = results.filter(p => p.inStock === filters.inStock);
    }
    if (filters?.tags?.length) {
      results = results.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag.toLowerCase()))
      );
    }

    const total = results.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 10;
    
    results = results.slice(offset, offset + limit);

    return {
      products: results.map(p => this.mapProduct(p)),
      total,
      hasMore: offset + results.length < total,
    };
  }

  async getProductDetails(productId: string): Promise<Product | null> {
    const product = this.products.find(p => p.id === productId || p.slug === productId);
    return product ? this.mapProduct(product) : null;
  }

  async checkInventory(productIds: string[]): Promise<InventoryStatus[]> {
    return productIds.map(id => {
      const product = this.products.find(p => p.id === id);
      if (!product) {
        return {
          productId: id,
          available: false,
          quantity: 0,
        };
      }

      const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0);
      return {
        productId: id,
        available: totalInventory > 0,
        quantity: totalInventory,
        locations: [{
          locationId: 'warehouse-1',
          locationName: 'Main Warehouse',
          quantity: totalInventory,
        }],
      };
    });
  }

  async getRecommendations(context: {
    productIds?: string[];
    userId?: string;
    strategy?: 'similar' | 'complementary' | 'trending' | 'personalized' | 'bundle';
  }): Promise<Recommendation[]> {
    let recommendations: StoredProduct[] = [];

    if (context.productIds?.length) {
      // Get similar products based on category/tags
      const sourceProducts = this.products.filter(p => context.productIds!.includes(p.id));
      const categories = [...new Set(sourceProducts.map(p => p.category))];
      const tags = [...new Set(sourceProducts.flatMap(p => p.tags))];

      recommendations = this.products
        .filter(p => !context.productIds!.includes(p.id))
        .filter(p => categories.includes(p.category) || p.tags.some(t => tags.includes(t)))
        .slice(0, 5);
    } else {
      // Return trending/top-rated products
      recommendations = [...this.products]
        .sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount)
        .slice(0, 5);
    }

    return recommendations.map((p, index) => ({
      product: this.mapProduct(p),
      score: 1 - (index * 0.1),
      reason: context.strategy === 'similar' 
        ? 'Similar to items you viewed'
        : 'Popular with customers',
      strategy: context.strategy ?? 'trending',
    }));
  }

  private mapProduct(p: StoredProduct): Product {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      slug: p.slug,
      price: {
        amount: p.price,
        currency: p.currency,
        compareAtPrice: p.compareAtPrice,
      },
      imageUrl: p.images[0],
      images: p.images,
      category: p.category,
      tags: p.tags,
      variants: p.variants.map(v => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: { amount: v.price, currency: p.currency },
        available: v.inventory > 0,
        attributes: {},
      })),
      attributes: p.attributes,
      inStock: p.inStock,
      rating: p.rating,
      reviewCount: p.reviewCount,
    };
  }
}

