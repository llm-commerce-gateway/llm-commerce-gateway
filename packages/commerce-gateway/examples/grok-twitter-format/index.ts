/**
 * Grok/X Integration Example with Twitter-Optimized Formatting
 * 
 * Demonstrates how to use Grok with tweet-friendly, emoji-rich responses
 * optimized for X/Twitter and mobile viewing.
 */

import { GrokAdapter, createTwitterFormatter } from '@betterdata/commerce-gateway/grok';
import type { Product } from '@betterdata/commerce-gateway/backends';

// ============================================================================
// Sample Product Data
// ============================================================================

const sampleProducts: Product[] = [
  {
    id: '1',
    name: 'AirPods Pro (2nd Gen)',
    description: 'Active noise cancellation, adaptive transparency, personalized spatial audio',
    price: 249,
    currency: 'USD',
    category: 'Electronics',
    brand: 'Apple',
    inStock: true,
    quantity: 50,
    images: ['https://example.com/airpods.jpg'],
  },
  {
    id: '2',
    name: 'Nike Air Max 90',
    description: 'Classic sneaker with visible Air unit, padded collar, rubber sole',
    price: 130,
    currency: 'USD',
    category: 'Shoes',
    brand: 'Nike',
    inStock: true,
    quantity: 8,
    images: ['https://example.com/airmax.jpg'],
  },
  {
    id: '3',
    name: 'MacBook Pro 14"',
    description: 'M3 Pro chip, 18GB RAM, 512GB SSD, Liquid Retina XDR display',
    price: 1999,
    currency: 'USD',
    category: 'Electronics',
    brand: 'Apple',
    inStock: true,
    quantity: 15,
    images: ['https://example.com/macbook.jpg'],
  },
  {
    id: '4',
    name: 'Lululemon Align Leggings',
    description: 'High-rise, buttery-soft Nulu fabric, 25" inseam',
    price: 98,
    currency: 'USD',
    category: 'Fashion',
    brand: 'Lululemon',
    inStock: false,
    images: ['https://example.com/leggings.jpg'],
  },
];

// ============================================================================
// Example 1: Search Results with Twitter Formatting
// ============================================================================

async function example1_SearchWithTwitterFormat() {
  console.log('📱 Example 1: Twitter-Formatted Search Results\n');

  // Create formatter with tweet-friendly settings
  const formatter = createTwitterFormatter({
    maxLength: 280,      // Tweet length
    useEmojis: true,     // Rich emojis
    mobileFirst: true,   // Optimized for mobile
  });

  // Format search results
  const query = 'premium electronics';
  const formatted = formatter.formatSearchResults(
    sampleProducts.filter(p => p.category === 'Electronics'),
    query,
    2
  );

  console.log(formatted);
  console.log('\n' + '='.repeat(50) + '\n');
}

// ============================================================================
// Example 2: Product Details (Tweet-Friendly)
// ============================================================================

async function example2_ProductDetails() {
  console.log('📱 Example 2: Twitter-Formatted Product Details\n');

  const formatter = createTwitterFormatter({
    maxLength: 280,
    useEmojis: true,
    mobileFirst: true,
  });

  const product = sampleProducts[0]; // AirPods Pro
  const formatted = formatter.formatProductDetails(product);

  console.log(formatted);
  console.log('\n' + '='.repeat(50) + '\n');
}

// ============================================================================
// Example 3: Cart Summary (Mobile-Optimized)
// ============================================================================

async function example3_CartSummary() {
  console.log('📱 Example 3: Twitter-Formatted Cart\n');

  const formatter = createTwitterFormatter({
    maxLength: 280,
    useEmojis: true,
    mobileFirst: true,
  });

  // Create sample cart items
  const cartItems = sampleProducts.slice(0, 3).map(product => ({
    id: `item-${product.id}`,
    product,
    productId: product.id,
    quantity: 1,
    price: product.price,
    createdAt: new Date(),
  }));

  const total = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const formatted = formatter.formatCart(cartItems, total);

  console.log(formatted);
  console.log('\n' + '='.repeat(50) + '\n');
}

// ============================================================================
// Example 4: Full Grok Integration with Twitter Formatting
// ============================================================================

async function example4_GrokWithFormatter() {
  console.log('📱 Example 4: Grok Adapter with Twitter Formatting\n');

  // Initialize Grok adapter
  const grok = new GrokAdapter({
    apiKey: process.env.GROK_API_KEY || 'test-key',
    backends: {
      products: {
        searchProducts: async (query: string) => {
          // Filter products based on query
          const results = sampleProducts.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.description?.toLowerCase().includes(query.toLowerCase()) ||
            p.category?.toLowerCase().includes(query.toLowerCase())
          );

          return {
            products: results,
            total: results.length,
            hasMore: false,
          };
        },
        getProductDetails: async (id: string) => {
          return sampleProducts.find(p => p.id === id) || null;
        },
        checkInventory: async (ids: string[]) => {
          return sampleProducts
            .filter(p => ids.includes(p.id))
            .map(p => ({
              productId: p.id,
              available: p.inStock,
              quantity: p.quantity || 0,
              locations: [],
            }));
        },
        getRecommendations: async () => [],
      },
    },
    temperature: 0.7,
    maxTokens: 280, // Tweet length!
  });

  // Initialize formatter
  const formatter = createTwitterFormatter({
    maxLength: 280,
    useEmojis: true,
    mobileFirst: true,
  });

  console.log('✅ Grok adapter initialized with Twitter formatting');
  console.log('📱 Responses will be tweet-length with emojis');
  console.log('🎯 Optimized for X/Twitter and mobile viewing');
  console.log('\n' + '='.repeat(50) + '\n');
}

// ============================================================================
// Example 5: Comparison - Standard vs Twitter Format
// ============================================================================

async function example5_Comparison() {
  console.log('📊 Example 5: Standard vs Twitter Format Comparison\n');

  const product = sampleProducts[2]; // MacBook Pro

  // Standard format (verbose)
  console.log('STANDARD FORMAT (Verbose):');
  console.log('─'.repeat(50));
  console.log(`Product: ${product.name}`);
  console.log(`Description: ${product.description}`);
  console.log(`Brand: ${product.brand}`);
  console.log(`Price: $${product.price}.00`);
  console.log(`Category: ${product.category}`);
  console.log(`Stock Status: ${product.inStock ? 'In Stock' : 'Out of Stock'}`);
  console.log(`Quantity Available: ${product.quantity}`);
  console.log('\n');

  // Twitter format (concise, emoji-rich)
  console.log('TWITTER FORMAT (Concise & Emoji-Rich):');
  console.log('─'.repeat(50));
  const formatter = createTwitterFormatter();
  console.log(formatter.formatProductDetails(product));
  console.log('\n' + '='.repeat(50) + '\n');
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('\n');
  console.log('🚀 Grok/X Integration Examples');
  console.log('━'.repeat(70));
  console.log('\n');

  await example1_SearchWithTwitterFormat();
  await example2_ProductDetails();
  await example3_CartSummary();
  await example4_GrokWithFormatter();
  await example5_Comparison();

  console.log('✅ All examples completed!\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_SearchWithTwitterFormat,
  example2_ProductDetails,
  example3_CartSummary,
  example4_GrokWithFormatter,
  example5_Comparison,
};

