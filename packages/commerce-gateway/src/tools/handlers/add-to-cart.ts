import type { ToolContext } from '../../types/index';
import type { AddToCartInput, AddToCartOutput } from '../schemas';
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
 * Add to Cart Handler
 * 
 * Adds a product to the shopping cart with optional inventory reservation.
 * Creates a new cart if one doesn't exist for the session.
 */
async function addToCartHandler(
  input: AddToCartInput,
  context: ToolContext
): Promise<AddToCartOutput> {
  const backends = requireBackends(context);
  
  const { productId, variantId, quantity = 1, reserveInventory, reserveDurationMinutes } = input;

  try {
    // Ensure we have a session ID
    if (!context.sessionId) {
      throw new Error('Session ID is required for cart operations');
    }

    // Get or create cart for this session
    const cart = await backends.cart.getOrCreateCart(context.sessionId);

    // Get product details to validate and get pricing
    const product = await backends.products.getProductDetails(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Check inventory if reservation is requested
    if (reserveInventory) {
      const inventory = await backends.products.checkInventory([productId], variantId ? { locationId: undefined } : undefined);
      if (inventory.length > 0) {
        const inv = inventory[0];
        if (inv) {
          if (!inv.inStock) {
            throw new Error(`Product is out of stock`);
          }
          if (inv.quantity < quantity) {
            throw new Error(`Insufficient inventory. Only ${inv.quantity} units available.`);
          }
        }
      }
    }

    // Get variant info if specified
    const variant = variantId && product.variants
      ? product.variants.find(v => v.id === variantId)
      : undefined;

    // Use backend to add item to cart
    const updatedCart = await backends.cart.addToCart(
      cart.id,
      {
        productId,
        variantId,
        quantity,
      },
      {
        reserveInventory,
        reserveDurationMinutes,
      }
    );

    // Find the added item in the cart
    const addedItem = updatedCart.items.find(
      item => item.productId === productId && item.variantId === variantId
    );

    if (!addedItem) {
      throw new Error('Failed to add item to cart');
    }

    // Build response message
    const itemName = variant?.name ?? product.name;
    const reservationMessage = reserveInventory && updatedCart.reservedUntil
      ? `Items reserved for ${reserveDurationMinutes ?? 30} minutes.`
      : '';

    return {
      cartId: updatedCart.id,
      item: {
        productId: addedItem.productId,
        variantId: addedItem.variantId,
        name: addedItem.name,
        quantity: addedItem.quantity,
        unitPrice: addedItem.unitPrice,
        totalPrice: addedItem.totalPrice,
      },
      cart: {
        itemCount: updatedCart.itemCount,
        subtotal: updatedCart.subtotal,
        currency: updatedCart.currency,
        reservedUntil: updatedCart.reservedUntil?.toISOString(),
      },
      checkoutUrl: updatedCart.checkoutUrl,
      message: `Added ${quantity} ${itemName} to your cart. ${reservationMessage}`.trim(),
    };
  } catch (error) {
    console.error('Add to cart error:', error);
    throw new Error(`Failed to add to cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered add_to_cart tool
 */
export const addToCartTool = createTool<AddToCartInput, AddToCartOutput>(
  'add_to_cart',
  `Add a product to the shopping cart.
  Supports specifying quantity and variant selection.
  Optionally reserves inventory for a limited time to prevent overselling.
  Returns updated cart totals and a checkout link.
  Use this tool when customers want to buy a product or add it to their cart.`,
  addToCartHandler,
  {
    requiresAuth: false, // Cart works with sessions
    rateLimit: { requests: 50, windowMs: 60000 },
  }
);
