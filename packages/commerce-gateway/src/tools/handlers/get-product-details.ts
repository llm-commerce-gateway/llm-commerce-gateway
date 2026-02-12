import type { ToolContext } from '../../types/index';
import type { GetProductDetailsInput, GetProductDetailsOutput } from '../schemas';
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
 * Get Product Details Handler
 * 
 * Retrieves comprehensive product information including variants,
 * inventory levels, and related products.
 */
async function getProductDetailsHandler(
  input: GetProductDetailsInput,
  context: ToolContext
): Promise<GetProductDetailsOutput> {
  const backends = requireBackends(context);
  
  const { productId, includeVariants, includeRelated, includeInventory } = input;

  try {
    // Get product details from backend
    const product = await backends.products.getProductDetails(productId);

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Get inventory if requested
    let availability = product.availability ?? { inStock: true };
    if (includeInventory) {
      const inventory = await backends.products.checkInventory([product.id]);
      if (inventory.length > 0) {
        const inv = inventory[0];
        if (inv) {
          availability = {
            inStock: inv.inStock,
            quantity: inv.quantity,
            leadTime: inv.locations?.[0]?.leadTimeDays 
              ? `${inv.locations[0].leadTimeDays} days`
              : undefined,
          };
        }
      }
    }

    // Get related products if requested
    let relatedProducts: string[] | undefined;
    if (includeRelated && backends.products.getRecommendations) {
      const recommendations = await backends.products.getRecommendations(
        { productIds: [product.id], strategy: 'similar' },
        4
      );
      relatedProducts = recommendations.map(r => r.product.id);
    }

    // Extract attributes, ingredients, usage, benefits from product attributes
    const attributes = product.attributes ?? {};
    const ingredients = attributes.ingredients
      ? (Array.isArray(attributes.ingredients) ? attributes.ingredients : [attributes.ingredients])
      : undefined;
    const usage = typeof attributes.usage === 'string' ? attributes.usage : undefined;
    const benefits = attributes.benefits
      ? (Array.isArray(attributes.benefits) ? attributes.benefits : [attributes.benefits])
      : undefined;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.variants?.[0]?.sku ?? '',
      description: product.description ?? '',
      shortDescription: undefined,
      price: product.price,
      images: product.images ?? [],
      category: product.category,
      tags: product.tags ?? [],
      rating: undefined, // Rating not in base Product interface
      availability,
      variants: includeVariants && product.variants
        ? product.variants.map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku ?? '',
            price: v.price ?? product.price,
            attributes: v.attributes ?? {},
            availability: v.availability ?? availability,
          }))
        : undefined,
      attributes,
      ingredients,
      usage,
      benefits,
      relatedProducts,
    };
  } catch (error) {
    console.error('Get product details error:', error);
    throw new Error(`Failed to get product details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered get_product_details tool
 */
export const getProductDetailsTool = createTool<GetProductDetailsInput, GetProductDetailsOutput>(
  'get_product_details',
  `Get comprehensive details about a specific product.
  Includes pricing, images, variants, inventory levels, ingredients, and usage instructions.
  Use this tool when customers want to learn more about a specific product,
  need ingredient lists, or want to see available size/variant options.`,
  getProductDetailsHandler,
  {
    requiresAuth: false,
    rateLimit: { requests: 200, windowMs: 60000 },
  }
);
