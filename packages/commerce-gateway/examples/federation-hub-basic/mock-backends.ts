/**
 * Mock Product Backends for Federation Example
 *
 * These mock backends simulate real commerce backends like Shopify, WooCommerce, etc.
 * They're used to demonstrate federation without requiring actual store connections.
 */

import type { ProductBackend } from '../../src/backends/interfaces.js';

// ============================================================================
// Mock Product Data
// ============================================================================

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  imageUrl: string;
  inStock: boolean;
  variants?: Array<{ id: string; name: string; price: number }>;
}

const ACTIVEWEAR_PRODUCTS: MockProduct[] = [
  {
    id: 'vuori-joggers-1',
    name: 'Performance Joggers',
    description: 'Lightweight, stretchy joggers perfect for workouts or lounging',
    price: 98,
    currency: 'USD',
    category: 'pants',
    imageUrl: 'https://example.com/joggers.jpg',
    inStock: true,
    variants: [
      { id: 'vuori-joggers-1-s', name: 'Small', price: 98 },
      { id: 'vuori-joggers-1-m', name: 'Medium', price: 98 },
      { id: 'vuori-joggers-1-l', name: 'Large', price: 98 },
    ],
  },
  {
    id: 'vuori-tee-1',
    name: 'Strato Tech Tee',
    description: 'Moisture-wicking performance t-shirt',
    price: 68,
    currency: 'USD',
    category: 'tops',
    imageUrl: 'https://example.com/tee.jpg',
    inStock: true,
  },
  {
    id: 'vuori-shorts-1',
    name: 'Kore Shorts',
    description: 'Versatile athletic shorts with liner',
    price: 78,
    currency: 'USD',
    category: 'shorts',
    imageUrl: 'https://example.com/shorts.jpg',
    inStock: true,
  },
  {
    id: 'vuori-hoodie-1',
    name: 'Ponto Performance Hoodie',
    description: 'Soft, breathable hoodie for any activity',
    price: 128,
    currency: 'USD',
    category: 'outerwear',
    imageUrl: 'https://example.com/hoodie.jpg',
    inStock: false,
  },
  {
    id: 'vuori-leggings-1',
    name: 'Daily Leggings',
    description: 'High-waisted leggings with pocket',
    price: 88,
    currency: 'USD',
    category: 'pants',
    imageUrl: 'https://example.com/leggings.jpg',
    inStock: true,
  },
];

const ELECTRONICS_PRODUCTS: MockProduct[] = [
  {
    id: 'tech-laptop-1',
    name: 'ProBook 15" Laptop',
    description: 'Powerful laptop for work and play with 16GB RAM',
    price: 1299,
    currency: 'USD',
    category: 'laptops',
    imageUrl: 'https://example.com/laptop.jpg',
    inStock: true,
    variants: [
      { id: 'tech-laptop-1-256', name: '256GB SSD', price: 1299 },
      { id: 'tech-laptop-1-512', name: '512GB SSD', price: 1499 },
      { id: 'tech-laptop-1-1tb', name: '1TB SSD', price: 1699 },
    ],
  },
  {
    id: 'tech-phone-1',
    name: 'SmartPhone Pro',
    description: 'Latest smartphone with advanced camera system',
    price: 999,
    currency: 'USD',
    category: 'phones',
    imageUrl: 'https://example.com/phone.jpg',
    inStock: true,
  },
  {
    id: 'tech-tablet-1',
    name: 'UltraTab 12"',
    description: 'Versatile tablet for creativity and productivity',
    price: 799,
    currency: 'USD',
    category: 'tablets',
    imageUrl: 'https://example.com/tablet.jpg',
    inStock: true,
  },
  {
    id: 'tech-headphones-1',
    name: 'Noise-Cancel Pro Headphones',
    description: 'Premium wireless headphones with ANC',
    price: 349,
    currency: 'USD',
    category: 'audio',
    imageUrl: 'https://example.com/headphones.jpg',
    inStock: true,
  },
  {
    id: 'tech-watch-1',
    name: 'SmartWatch Series 5',
    description: 'Advanced smartwatch with health tracking',
    price: 449,
    currency: 'USD',
    category: 'wearables',
    imageUrl: 'https://example.com/watch.jpg',
    inStock: false,
  },
];

// ============================================================================
// Mock Backend Factory
// ============================================================================

/**
 * Create a mock ProductBackend with the given products.
 */
export function createMockBackend(
  storeName: string,
  products: MockProduct[]
): ProductBackend {
  return {
    async search(query: string, options?: { limit?: number; category?: string }) {
      const limit = options?.limit ?? 10;
      const category = options?.category?.toLowerCase();

      // Simple search: filter by query in name or description
      const queryLower = query.toLowerCase();
      let results = products.filter(
        (p) =>
          p.name.toLowerCase().includes(queryLower) ||
          p.description.toLowerCase().includes(queryLower) ||
          p.category.toLowerCase().includes(queryLower)
      );

      // Filter by category if specified
      if (category) {
        results = results.filter((p) => p.category.toLowerCase() === category);
      }

      // Limit results
      results = results.slice(0, limit);

      console.log(`[${storeName}] Search "${query}" → ${results.length} results`);

      return {
        products: results.map((p) => ({
          id: p.id,
          title: p.name,
          description: p.description,
          price: { amount: p.price, currency: p.currency },
          images: [{ url: p.imageUrl, alt: p.name }],
          url: `https://${storeName.toLowerCase()}.example.com/products/${p.id}`,
          inStock: p.inStock,
          variants: p.variants?.map((v) => ({
            id: v.id,
            title: v.name,
            price: { amount: v.price, currency: p.currency },
            available: p.inStock,
          })),
        })),
        total: results.length,
        hasMore: false,
      };
    },

    async getProduct(id: string) {
      const product = products.find((p) => p.id === id);
      if (!product) return null;

      return {
        id: product.id,
        title: product.name,
        description: product.description,
        price: { amount: product.price, currency: product.currency },
        images: [{ url: product.imageUrl, alt: product.name }],
        url: `https://${storeName.toLowerCase()}.example.com/products/${product.id}`,
        inStock: product.inStock,
        variants: product.variants?.map((v) => ({
          id: v.id,
          title: v.name,
          price: { amount: v.price, currency: product.currency },
          available: product.inStock,
        })),
      };
    },

    async getInventory(productId: string) {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;

      return {
        productId: product.id,
        available: product.inStock,
        quantity: product.inStock ? 10 : 0,
      };
    },
  };
}

// ============================================================================
// Pre-configured Backends
// ============================================================================

/**
 * Activewear store backend (simulates a Vuori-like store).
 */
export const activewearBackend = createMockBackend('Vuori', ACTIVEWEAR_PRODUCTS);

/**
 * Electronics store backend (simulates a tech store).
 */
export const electronicsBackend = createMockBackend('TechStore', ELECTRONICS_PRODUCTS);

/**
 * Get all mock products for a backend type.
 */
export function getMockProducts(type: 'activewear' | 'electronics'): MockProduct[] {
  return type === 'activewear' ? ACTIVEWEAR_PRODUCTS : ELECTRONICS_PRODUCTS;
}

