import type { ToolContext } from '../../types/index';
import type { CheckAvailabilityInput, CheckAvailabilityOutput } from '../schemas';
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
 * Check Availability Handler (Buyer-safe)
 *
 * Returns buyer-friendly availability signals without location or quantity leakage.
 */
async function checkAvailabilityHandler(
  input: CheckAvailabilityInput,
  context: ToolContext
): Promise<CheckAvailabilityOutput> {
  const backends = requireBackends(context);

  const { productId, variantId, quantity = 1 } = input;

  try {
    const inventory = await backends.products.checkInventory([productId]);

    if (inventory.length === 0 || !inventory[0]) {
      throw new Error(`Product not found: ${productId}`);
    }

    const status = inventory[0]!;
    const available = status.inStock && status.quantity >= quantity;
    const confidence = available ? 0.9 : 0.4;

    const message = available
      ? 'In stock and available to ship.'
      : 'Currently unavailable. Check back soon.';

    const response: CheckAvailabilityOutput = {
      productId,
      variantId,
      availability: {
        available,
        message,
        confidence,
      },
    };

    if (status.shippingEstimate) {
      response.delivery = {
        estimate: status.shippingEstimate,
      };
    }

    return response;
  } catch (error) {
    console.error('Check availability error:', error);
    throw new Error(`Failed to check availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered check_availability tool
 */
export const checkAvailabilityTool = createTool<CheckAvailabilityInput, CheckAvailabilityOutput>(
  'check_availability',
  `Check buyer-safe availability for a product.
  Returns availability status, confidence, and optional delivery estimate.
  Does not expose location or quantity details.`,
  checkAvailabilityHandler,
  {
    requiresAuth: false,
    rateLimit: { requests: 200, windowMs: 60000 },
  }
);
