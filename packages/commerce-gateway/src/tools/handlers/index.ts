// Tool handlers barrel export
export { searchProductsTool } from './search-products';
export { getProductDetailsTool } from './get-product-details';
export { addToCartTool } from './add-to-cart';
export { checkAvailabilityTool } from './check-availability';
export { checkInventoryTool } from './check-inventory';
export { getRecommendationsTool } from './get-recommendations';
export { createOrderTool } from './create-order';

// Re-export all tool registrations
import { toolRegistry } from '../registry';
import { searchProductsTool } from './search-products';
import { getProductDetailsTool } from './get-product-details';
import { addToCartTool } from './add-to-cart';
import { checkAvailabilityTool } from './check-availability';
import { checkInventoryTool } from './check-inventory';
import { getRecommendationsTool } from './get-recommendations';
import { createOrderTool } from './create-order';

/**
 * Register all shopping tools with the tool registry
 */
export function registerAllTools(): void {
  toolRegistry.register(searchProductsTool);
  toolRegistry.register(getProductDetailsTool);
  toolRegistry.register(addToCartTool);
  toolRegistry.register(checkAvailabilityTool);
  toolRegistry.register(checkInventoryTool);
  toolRegistry.register(getRecommendationsTool);
  toolRegistry.register(createOrderTool);
  
  console.log(`[LLM Gateway] Registered ${toolRegistry.getToolNames().length} tools:`, 
    toolRegistry.getToolNames());
}

/**
 * Get all registered tool definitions for a specific provider
 */
export function getToolsForProvider(provider: 'anthropic' | 'openai' | 'google' | 'grok') {
  return toolRegistry.getToolDefinitionsForProvider(provider);
}

