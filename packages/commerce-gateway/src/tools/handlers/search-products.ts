import type { ToolContext } from '../../types/index';
import type { SearchProductsInput, SearchProductsOutput } from '../schemas';
import { createTool } from '../registry';
import type { GatewayBackends } from '../../backends/interfaces';

/**
 * Helper to ensure backends are available
 */
function requireBackends(context: ToolContext): GatewayBackends {
  if (!context.backends) {
    throw new Error('Backends not configured. These tools require a backend implementation (ProductBackend, CartBackend, OrderBackend).');
  }
  return context.backends;
}

/**
 * Search Products Handler
 * 
 * Performs semantic search over the product catalog using embeddings
 * and traditional filtering. Supports natural language queries.
 */
async function searchProductsHandler(
  input: SearchProductsInput,
  context: ToolContext
): Promise<SearchProductsOutput> {
  const backends = requireBackends(context);
  
  const { query, filters, pagination } = input;
  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;

  try {
    // Use backend to search products
    const result = await backends.products.searchProducts(
      query,
      {
        category: filters?.category,
        tags: filters?.tags,
        priceMin: filters?.priceRange?.min,
        priceMax: filters?.priceRange?.max,
        inStock: filters?.inStock,
      },
      {
        limit,
        offset,
      }
    );

    // Map backend ProductSearchResult to tool output format
    const outputProducts = result.products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      shortDescription: undefined,
      price: product.price,
      images: product.images ?? [],
      category: product.category,
      tags: product.tags ?? [],
      rating: undefined, // Rating not in base Product interface
      availability: product.availability ?? { inStock: true },
      relevanceScore: 1.0, // Backend can calculate this if needed
    }));

    return {
      products: outputProducts,
      totalCount: result.total,
      hasMore: result.hasMore,
      facets: result.facets ? {
        categories: result.facets.categories ?? [],
      } : undefined,
    };
  } catch (error) {
    console.error('Search products error:', error);
    throw new Error(`Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered search_products tool
 */
export const searchProductsTool = createTool<SearchProductsInput, SearchProductsOutput>(
  'search_products',
  `Search for products using natural language queries. 
  Supports filtering by category, price range, availability, and tags.
  Returns product details including pricing, images, and real-time inventory status.
  Use this tool when customers ask about finding products, looking for specific items,
  or browsing the catalog.`,
  searchProductsHandler,
  {
    requiresAuth: false,
    rateLimit: { requests: 100, windowMs: 60000 },
  }
);
