import { describe, it, expect } from 'vitest';
import { checkAvailabilityTool } from '../handlers/check-availability';
import { CheckAvailabilityOutputSchema } from '../schemas';
import type { GatewayBackends, InventoryStatus } from '../../backends/interfaces';

describe('check_availability (buyer-safe)', () => {
  it('does not leak location or quantity details', async () => {
    const inventoryStatus: InventoryStatus = {
      productId: 'prod_1',
      inStock: true,
      quantity: 12,
      shippingEstimate: '2-3 business days',
      locations: [
        {
          locationId: 'loc_1',
          locationName: 'Warehouse A',
          quantity: 12,
          leadTimeDays: 2,
        },
      ],
    };

    const backends: GatewayBackends = {
      products: {
        searchProducts: async () => ({ products: [], total: 0, hasMore: false }),
        getProductDetails: async () => null,
        checkInventory: async () => [inventoryStatus],
      },
      cart: {
        createCart: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
        getCart: async () => null,
        getOrCreateCart: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
        addToCart: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
        updateCartItem: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
        removeFromCart: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
        clearCart: async () => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, currency: 'USD', itemCount: 0 }),
      },
      orders: {
        createOrder: async () => ({
          id: 'order_1',
          orderNumber: '1001',
          status: 'pending',
          items: [],
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          currency: 'USD',
          createdAt: new Date(),
        }),
        getOrder: async () => null,
      },
    };

    const output = await checkAvailabilityTool.handler(
      { productId: 'prod_1', quantity: 1 },
      { backends }
    );

    CheckAvailabilityOutputSchema.parse(output);

    expect(output).not.toHaveProperty('locations');
    expect(output).not.toHaveProperty('quantityAvailable');
    expect(output.availability).not.toHaveProperty('quantityAvailable');
    expect(JSON.stringify(output)).not.toContain('locationId');
  });
});
