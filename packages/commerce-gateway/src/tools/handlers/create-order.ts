import type { ToolContext } from '../../types/index';
import type { CreateOrderInput, CreateOrderOutput } from '../schemas';
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
 * Create Order Handler
 * 
 * Converts a cart to an order with shipping and payment details.
 * Handles inventory reservation and order confirmation.
 */
async function createOrderHandler(
  input: CreateOrderInput,
  context: ToolContext
): Promise<CreateOrderOutput> {
  const backends = requireBackends(context);
  
  const { cartId, shippingAddress, billingAddress, paymentMethod, notes, giftMessage, isGift } = input;

  try {
    // Get cart from backend
    const cart = await backends.cart.getCart(cartId);
    if (!cart) {
      throw new Error(`Cart not found: ${cartId}`);
    }

    if (cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Use backend to create order
    const order = await backends.orders.createOrder(
      cart,
      shippingAddress,
      billingAddress ?? shippingAddress,
      {
        method: paymentMethod as any,
      },
      {
        notes,
        isGift,
        giftMessage,
      }
    );

    // Clear cart after order creation
    await backends.cart.clearCart(cartId);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: {
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
      },
      estimatedDelivery: order.estimatedDelivery,
      confirmationUrl: order.confirmationUrl ?? '', // Backend can provide this if needed
    };
  } catch (error) {
    console.error('Create order error:', error);
    throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Registered create_order tool
 */
export const createOrderTool = createTool<CreateOrderInput, CreateOrderOutput>(
  'create_order',
  `Create an order from the shopping cart.
  Requires shipping address and payment method.
  Calculates shipping, tax, and total.
  Returns order confirmation with estimated delivery.
  Use this tool when the customer is ready to complete their purchase.`,
  createOrderHandler,
  {
    requiresAuth: true, // Orders require authentication
    rateLimit: { requests: 10, windowMs: 60000 },
  }
);
