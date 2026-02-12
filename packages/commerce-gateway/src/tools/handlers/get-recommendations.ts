import type { ToolContext } from '../../types/index';
import type { GetRecommendationsInput, GetRecommendationsOutput } from '../schemas';
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
 * Get Recommendations Handler
 * 
 * Generates personalized product recommendations based on context,
 * browsing history, and recommendation strategy.
 */
async function getRecommendationsHandler(
  input: GetRecommendationsInput,
  context: ToolContext
): Promise<GetRecommendationsOutput> {
  const backends = requireBackends(context);
  
  const { productIds, context: userContext, strategy, limit = 10 } = input;

  try {
    // Check if backend supports recommendations
    if (!backends.products.getRecommendations) {
      throw new Error('Product backend does not support recommendations. Implement getRecommendations() method.');
    }

    // Use backend to get recommendations
    const recommendations = await backends.products.getRecommendations(
      {
        productIds,
        sessionId: context.sessionId,
        strategy: strategy ?? 'personalized',
        userPreferences: userContext ? {
          hairType: userContext.hairType,
          skinType: userContext.skinType,
          concerns: userContext.concerns,
          budget: userContext.budget,
        } : undefined,
      },
      limit
    );

    // Map backend Recommendation[] to tool output format
    const output = recommendations.map(rec => ({
      product: {
        id: rec.product.id,
        name: rec.product.name,
        slug: rec.product.slug,
        description: rec.product.description ?? '',
        price: rec.product.price,
        images: rec.product.images ?? [],
        availability: rec.product.availability ?? { inStock: true },
      },
      reason: rec.reason,
      confidence: rec.confidence,
      strategy: rec.strategy,
    }));

    return {
      recommendations: output,
      totalAvailable: output.length,
    };
  } catch (error) {
    console.error('Get recommendations error:', error);
    throw new Error(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered get_recommendations tool
 */
export const getRecommendationsTool = createTool<GetRecommendationsInput, GetRecommendationsOutput>(
  'get_recommendations',
  `Get personalized product recommendations based on user preferences and context.
  Supports multiple strategies: similar (related products), complementary (works well together),
  trending (popular items), bundle (value sets), and personalized (based on hair type, concerns, budget).
  Use this tool when customers need suggestions, want to discover products, 
  or are building a hair care regimen.`,
  getRecommendationsHandler,
  {
    requiresAuth: false,
    rateLimit: { requests: 100, windowMs: 60000 },
  }
);
