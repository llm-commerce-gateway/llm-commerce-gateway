/**
 * @betterdata/commerce-gateway - MCP Resources
 * 
 * Provides resource endpoints for Claude to read product catalogs,
 * categories, and other static data that enhances tool functionality.
 * 
 * @license MIT
 */

import type {
  MCPResource,
  MCPResourceTemplate,
  MCPContent,
  MCPToolContext,
} from '../types';
import type { GatewayBackends } from '../../backends/interfaces';

// ============================================================================
// Resource Definitions
// ============================================================================

/**
 * Static resources that are always available
 */
export function getStaticResources(): MCPResource[] {
  return [
    {
      uri: 'commerce://catalog/categories',
      name: 'Product Categories',
      description: 'List of all product categories available in the catalog',
      mimeType: 'application/json',
    },
    {
      uri: 'commerce://catalog/featured',
      name: 'Featured Products',
      description: 'Currently featured products and promotions',
      mimeType: 'application/json',
    },
    {
      uri: 'commerce://store/info',
      name: 'Store Information',
      description: 'Store details, policies, and contact information',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Resource templates for dynamic resources
 */
export function getResourceTemplates(): MCPResourceTemplate[] {
  return [
    {
      uriTemplate: 'commerce://products/{productId}',
      name: 'Product Details',
      description: 'Get detailed information about a specific product',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'commerce://categories/{categoryName}/products',
      name: 'Category Products',
      description: 'Get products in a specific category',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'commerce://search/{query}',
      name: 'Search Results',
      description: 'Search products by query',
      mimeType: 'application/json',
    },
  ];
}

// ============================================================================
// Resource Handlers
// ============================================================================

export interface ResourceHandler {
  (uri: string, context: MCPToolContext): Promise<MCPContent[]>;
}

/**
 * Read a resource by URI
 */
export async function readResource(
  uri: string,
  backends: GatewayBackends,
  context: MCPToolContext
): Promise<MCPContent[]> {
  // Parse the URI
  const url = new URL(uri, 'commerce://');
  const path = url.pathname;

  // Static resources
  if (path === '/catalog/categories') {
    return readCategories(backends, context);
  }

  if (path === '/catalog/featured') {
    return readFeaturedProducts(backends, context);
  }

  if (path === '/store/info') {
    return readStoreInfo();
  }

  // Dynamic resources - product by ID
  const productMatch = path.match(/^\/products\/(.+)$/);
  if (productMatch && productMatch[1]) {
    const productId = decodeURIComponent(productMatch[1]);
    return readProductResource(productId, backends, context);
  }

  // Dynamic resources - category products
  const categoryMatch = path.match(/^\/categories\/(.+)\/products$/);
  if (categoryMatch && categoryMatch[1]) {
    const categoryName = decodeURIComponent(categoryMatch[1]);
    return readCategoryProducts(categoryName, backends, context);
  }

  // Dynamic resources - search
  const searchMatch = path.match(/^\/search\/(.+)$/);
  if (searchMatch && searchMatch[1]) {
    const query = decodeURIComponent(searchMatch[1]);
    return readSearchResults(query, backends, context);
  }

  // Not found
  return [{
    type: 'text',
    text: JSON.stringify({ error: 'Resource not found', uri }),
  }];
}

// ============================================================================
// Resource Implementations
// ============================================================================

async function readCategories(
  backends: GatewayBackends,
  _context: MCPToolContext
): Promise<MCPContent[]> {
  try {
    // Get categories by searching for products and extracting unique categories
    // In a real implementation, there would be a dedicated categories API
    const result = await backends.products.searchProducts('', undefined, { limit: 100 });
    
    const categories = new Set<string>();
    result.products.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    
    const categoryList = Array.from(categories).sort();
    
    return [{
      type: 'text',
      text: JSON.stringify({
        categories: categoryList,
        count: categoryList.length,
      }, null, 2),
    }];
  } catch (error) {
    return [{
      type: 'text',
      text: JSON.stringify({ error: 'Failed to fetch categories' }),
    }];
  }
}

async function readFeaturedProducts(
  backends: GatewayBackends,
  _context: MCPToolContext
): Promise<MCPContent[]> {
  try {
    // Get featured/trending products
    const getRecommendations = backends.products.getRecommendations;
    if (getRecommendations) {
      const recommendations = await getRecommendations.call(
        backends.products,
        { strategy: 'trending' },
        10
      );
      
      return [{
        type: 'text',
        text: JSON.stringify({
          featured: recommendations.map(r => ({
            id: r.product.id,
            name: r.product.name,
            price: r.product.price,
            reason: r.reason,
          })),
          count: recommendations.length,
        }, null, 2),
      }];
    }
    
    // Fallback to search
    const result = await backends.products.searchProducts('', undefined, { limit: 10 });
    return [{
      type: 'text',
      text: JSON.stringify({
        featured: result.products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
        })),
        count: result.products.length,
      }, null, 2),
    }];
  } catch (error) {
    return [{
      type: 'text',
      text: JSON.stringify({ error: 'Failed to fetch featured products' }),
    }];
  }
}

function readStoreInfo(): MCPContent[] {
  // This would typically come from configuration
  // For now, return a placeholder that implementations can override
  return [{
    type: 'text',
    text: JSON.stringify({
      name: 'Commerce Store',
      description: 'A commerce store powered by the LLM Gateway',
      currency: 'USD',
      shipping: {
        freeShippingThreshold: 75,
        standardShipping: 9.99,
        expressShipping: 19.99,
      },
      policies: {
        returns: '30-day return policy',
        warranty: 'Standard manufacturer warranty',
      },
      contact: {
        support: 'Available via chat',
      },
    }, null, 2),
  }];
}

async function readProductResource(
  productId: string,
  backends: GatewayBackends,
  _context: MCPToolContext
): Promise<MCPContent[]> {
  try {
    const product = await backends.products.getProductDetails(productId);
    
    if (!product) {
      return [{
        type: 'text',
        text: JSON.stringify({ error: 'Product not found', productId }),
      }];
    }
    
    return [{
      type: 'text',
      text: JSON.stringify(product, null, 2),
    }];
  } catch (error) {
    return [{
      type: 'text',
      text: JSON.stringify({ error: 'Failed to fetch product' }),
    }];
  }
}

async function readCategoryProducts(
  categoryName: string,
  backends: GatewayBackends,
  _context: MCPToolContext
): Promise<MCPContent[]> {
  try {
    const result = await backends.products.searchProducts(
      '',
      { category: categoryName },
      { limit: 50 }
    );
    
    return [{
      type: 'text',
      text: JSON.stringify({
        category: categoryName,
        products: result.products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          inStock: p.availability?.inStock ?? true,
        })),
        total: result.total,
        hasMore: result.hasMore,
      }, null, 2),
    }];
  } catch (error) {
    return [{
      type: 'text',
      text: JSON.stringify({ error: 'Failed to fetch category products' }),
    }];
  }
}

async function readSearchResults(
  query: string,
  backends: GatewayBackends,
  _context: MCPToolContext
): Promise<MCPContent[]> {
  try {
    const result = await backends.products.searchProducts(query, undefined, { limit: 20 });
    
    return [{
      type: 'text',
      text: JSON.stringify({
        query,
        products: result.products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          inStock: p.availability?.inStock ?? true,
        })),
        total: result.total,
        hasMore: result.hasMore,
      }, null, 2),
    }];
  } catch (error) {
    return [{
      type: 'text',
      text: JSON.stringify({ error: 'Failed to search products' }),
    }];
  }
}

