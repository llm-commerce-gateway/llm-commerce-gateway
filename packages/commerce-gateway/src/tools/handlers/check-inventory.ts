import type { ToolContext } from '../../types/index';
import type { CheckInventoryInput, CheckInventoryOutput, LotExpiryInfo } from '../schemas';
import { createTool } from '../registry';
import type { GatewayBackends } from '../../backends/interfaces';
import { isFeatureEnabled } from '../../feature-flags';

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
 * Check Inventory Handler
 * 
 * Checks real-time inventory availability across locations.
 * Provides availability status and alternative options if needed.
 */
async function checkInventoryHandler(
  input: CheckInventoryInput,
  context: ToolContext
): Promise<CheckInventoryOutput> {
  const backends = requireBackends(context);
  
  const { productId, variantId, locationId, quantity = 1 } = input;

  try {
    // Use backend to check inventory
    const inventory = await backends.products.checkInventory(
      [productId],
      { locationId }
    );

    if (inventory.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }

    const inv = inventory[0];
    if (!inv) {
      throw new Error(`Product not found: ${productId}`);
    }
    const totalAvailable = inv.quantity;
    const canFulfill = totalAvailable >= quantity;

    // Check if lot/expiry feature is enabled
    const includeLotExpiry = isFeatureEnabled('ENABLE_LOT_EXPIRY');

    // Map backend InventoryStatus to tool output format
    const locations = inv.locations?.map(loc => {
      const baseLocation = {
        locationId: loc.locationId,
        locationName: loc.locationName,
        quantityAvailable: loc.quantity,
        leadTimeDays: loc.leadTimeDays,
      };

      // 🟡 EXPERIMENTAL: Only include lot/expiry when flag is enabled
      if (includeLotExpiry && loc.lotExpiry) {
        return {
          ...baseLocation,
          lotExpiry: loc.lotExpiry as LotExpiryInfo,
        };
      }

      return baseLocation;
    });

    // Build availability message
    let message: string;
    if (canFulfill) {
      if (totalAvailable <= 10) {
        message = `In stock with ${totalAvailable} units available. Low stock - order soon!`;
      } else {
        message = `In stock with ${totalAvailable} units available. Ships within 1-2 business days.`;
      }
    } else if (totalAvailable > 0) {
      message = `Only ${totalAvailable} units available. More stock expected soon.`;
    } else {
      message = `Currently out of stock. Expected back in stock within 2-3 weeks.`;
    }

    // Note: Alternatives would need to come from backend or be calculated separately
    // For now, we'll leave it empty as it requires additional product queries
    const alternatives: Array<{
      variantId: string;
      variantName: string;
      quantityAvailable: number;
    }> = [];

    // Build the base response
    const response: CheckInventoryOutput = {
      productId,
      variantId,
      availability: {
        inStock: inv.inStock,
        quantityAvailable: totalAvailable,
        canFulfill,
        message,
      },
      locations: locations && locations.length > 0 ? locations : undefined,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };

    // 🟡 EXPERIMENTAL: Only include product-level lot/expiry when flag is enabled
    if (includeLotExpiry && inv.lotExpiry) {
      response.lotExpiry = inv.lotExpiry as LotExpiryInfo;
    }

    return response;
  } catch (error) {
    console.error('Check inventory error:', error);
    throw new Error(`Failed to check inventory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered check_inventory tool
 */
export const checkInventoryTool = createTool<CheckInventoryInput, CheckInventoryOutput>(
  'check_inventory',
  `Check real-time inventory availability for a product.
  Returns quantity available, location-specific stock levels, and alternative options.
  Use this tool when customers ask about availability, stock levels, 
  or want to know if an item will ship quickly.`,
  checkInventoryHandler,
  {
    requiresAuth: false,
    rateLimit: { requests: 200, windowMs: 60000 },
  }
);
