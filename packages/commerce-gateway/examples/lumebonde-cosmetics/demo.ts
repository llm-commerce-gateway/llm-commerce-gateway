#!/usr/bin/env npx tsx

/**
 * Lumebondé Cosmetics Demo
 *
 * Demonstrates the LLM Gateway with the Lumebondé Cosmetics catalog.
 * No SCM dependencies - runs entirely in memory.
 *
 * Usage:
 *   npx tsx demo.ts                    # Run full demo
 *   npx tsx demo.ts search "serum"     # Search for products
 *   npx tsx demo.ts list               # List all products
 *
 * @example
 * ```bash
 * cd packages/commerce-gateway/examples/lumebonde-cosmetics
 * npx tsx demo.ts
 * ```
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// In-Memory Catalog (OSS-compatible, no SCM dependency)
// ============================================================================

interface Product {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  sku?: string;
  gtin?: string;
  images?: string[];
  inStock: boolean;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

interface SearchResult {
  products: Product[];
  total: number;
  query: string;
  timing: { searchMs: number };
}

class InMemoryCatalog {
  private products = new Map<string, Product>();

  constructor(initialProducts?: Product[]) {
    if (initialProducts) {
      for (const product of initialProducts) {
        this.products.set(product.id, product);
      }
    }
  }

  /**
   * Search products by text query
   * Simple keyword matching for OSS demo
   */
  search(query: string, limit = 10): SearchResult {
    const startTime = Date.now();
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter(Boolean);

    const scored = Array.from(this.products.values())
      .map((product) => {
        let score = 0;
        const searchText = [
          product.name,
          product.description,
          product.brand,
          product.category,
          product.sku,
          ...(product.metadata?.tags as string[] || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        for (const term of queryTerms) {
          if (searchText.includes(term)) {
            score += 1;
            // Boost for name/sku matches
            if (product.name.toLowerCase().includes(term)) score += 2;
            if (product.sku?.toLowerCase().includes(term)) score += 2;
          }
        }

        return { product, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      products: scored.map(({ product }) => product),
      total: scored.length,
      query,
      timing: { searchMs: Date.now() - startTime },
    };
  }

  /**
   * Get all products with optional filtering
   */
  list(options?: { category?: string; inStockOnly?: boolean; limit?: number }): Product[] {
    let products = Array.from(this.products.values());

    if (options?.category) {
      const cat = options.category.toLowerCase();
      products = products.filter((p) => p.category?.toLowerCase().includes(cat));
    }

    if (options?.inStockOnly) {
      products = products.filter((p) => p.inStock);
    }

    if (options?.limit) {
      products = products.slice(0, options.limit);
    }

    return products;
  }

  /**
   * Get product by ID
   */
  get(id: string): Product | undefined {
    return this.products.get(id);
  }

  /**
   * Get catalog size
   */
  count(): number {
    return this.products.size;
  }

  /**
   * Get categories with counts
   */
  getCategories(): Map<string, number> {
    const categories = new Map<string, number>();
    for (const product of this.products.values()) {
      const category = product.category?.split(' > ')[0] || 'Uncategorized';
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    return categories;
  }
}

// ============================================================================
// Demo Functions
// ============================================================================

function loadCatalog(): InMemoryCatalog {
  const catalogPath = join(__dirname, 'data', 'catalog.json');
  const data = JSON.parse(readFileSync(catalogPath, 'utf-8'));
  return new InMemoryCatalog(data);
}

function formatProduct(product: Product, detailed = false): string {
  const lines = [
    `📦 ${product.name}`,
    `   SKU: ${product.sku} | Price: $${product.price.toFixed(2)}`,
    `   Category: ${product.category}`,
  ];

  if (detailed && product.description) {
    lines.push(`   ${product.description.slice(0, 100)}...`);
  }

  if (product.quantity !== undefined) {
    lines.push(`   Stock: ${product.quantity} units`);
  }

  return lines.join('\n');
}

function runSearch(catalog: InMemoryCatalog, query: string): void {
  console.log(`\n🔍 Searching for: "${query}"\n`);
  console.log('─'.repeat(60));

  const result = catalog.search(query);

  if (result.products.length === 0) {
    console.log('No products found.');
    return;
  }

  console.log(`Found ${result.total} products in ${result.timing.searchMs}ms:\n`);

  for (const product of result.products) {
    console.log(formatProduct(product, true));
    console.log('');
  }
}

function runList(catalog: InMemoryCatalog, category?: string): void {
  console.log('\n📋 Product Catalog\n');
  console.log('─'.repeat(60));

  const products = catalog.list({ category, inStockOnly: true });

  console.log(`Showing ${products.length} products${category ? ` in "${category}"` : ''}:\n`);

  for (const product of products) {
    console.log(formatProduct(product));
    console.log('');
  }
}

function runFullDemo(catalog: InMemoryCatalog): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  Lumebondé COSMETICS DEMO                     ║
║            LLM Gateway - In-Memory Catalog Demo               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Show catalog stats
  console.log('📊 CATALOG STATISTICS\n');
  console.log('─'.repeat(60));
  console.log(`   Total Products: ${catalog.count()}`);
  console.log(`   Categories:`);
  for (const [category, count] of catalog.getCategories()) {
    console.log(`     - ${category}: ${count} products`);
  }

  // Demo search queries
  const demoQueries = [
    'vitamin C serum for brightening',
    'gift set',
    'damaged hair repair',
    'hydrating moisturizer',
  ];

  console.log('\n\n🔍 DEMO SEARCHES\n');
  console.log('─'.repeat(60));

  for (const query of demoQueries) {
    console.log(`\n  Query: "${query}"`);
    const result = catalog.search(query, 3);
    console.log(`  Results: ${result.total} products (${result.timing.searchMs}ms)`);

    for (const product of result.products.slice(0, 2)) {
      console.log(`    ➤ ${product.name} - $${product.price.toFixed(2)}`);
    }
  }

  // Show example product detail
  console.log('\n\n📦 PRODUCT DETAIL EXAMPLE\n');
  console.log('─'.repeat(60));

  const heroProduct = catalog.get('LMBD-SERUM-001');
  if (heroProduct) {
    console.log(`
  ${heroProduct.name}
  ──────────────────────────────────────

  SKU:      ${heroProduct.sku}
  GTIN:     ${heroProduct.gtin}
  Price:    $${heroProduct.price.toFixed(2)}
  Category: ${heroProduct.category}
  Stock:    ${heroProduct.quantity} units

  Description:
  ${heroProduct.description}

  Benefits: ${(heroProduct.metadata?.benefits as string[])?.join(', ')}
  Size:     ${heroProduct.metadata?.size}
`);
  }

  // Capability Discovery
  console.log('\n🔍 CAPABILITY DISCOVERY (OSS Mode)\n');
  console.log('─'.repeat(60));
  console.log(`
  OSS Capabilities:
    ✅ Keyword Search         - Available
    ✅ Filters & Pagination   - Available
    ✅ Tag-based Search       - Available
    ✅ CSV/JSON Import        - Available
    ❌ ML-Ranked Results      - Requires Cloud Pro
    ❌ Semantic Search        - Requires Cloud Pro
    ❌ Realtime Analytics     - Requires Cloud Pro
    ❌ Multi-tenant           - Requires Cloud

  Feature-gate example:

    const caps = await hub.getCapabilities();
    if (caps.features.discovery.rankedResults) {
      // Use ML ranking (Cloud Pro)
    } else {
      // Use keyword search (OSS)
    }
`);

  // Integration example
  console.log('\n📝 INTEGRATION EXAMPLE\n');
  console.log('─'.repeat(60));
  console.log(`
  To use this catalog with LLM Gateway:

  \`\`\`typescript
  import { LLMGateway } from '@betterdata/commerce-gateway';
  import { createInMemoryCatalog } from '@betterdata/commerce-gateway/catalog';
  import catalog from './data/catalog.json';

  const productCatalog = createInMemoryCatalog(catalog);

  const gateway = new LLMGateway({
    extensions: { productCatalog },
    llmProviders: ['anthropic', 'openai'],
  });
  \`\`\`
`);

  console.log('\n✅ Demo complete!\n');
  console.log('📚 See docs/external/gateway/QUICKSTART.md for OSS vs Cloud details.\n');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0] || 'demo';

  const catalog = loadCatalog();

  switch (command) {
    case 'search':
      const query = args.slice(1).join(' ') || 'serum';
      runSearch(catalog, query);
      break;

    case 'list':
      const category = args[1];
      runList(catalog, category);
      break;

    case 'demo':
    default:
      runFullDemo(catalog);
      break;
  }
}

main();

// Export for programmatic use
export { InMemoryCatalog, loadCatalog };

