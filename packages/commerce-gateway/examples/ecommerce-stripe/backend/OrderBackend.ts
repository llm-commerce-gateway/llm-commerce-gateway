/**
 * E-Commerce with Stripe - Order Backend
 * 
 * Stripe-based checkout implementation.
 */

import type { OrderBackend, Order, Cart, ShippingAddress, PaymentInfo } from '@betterdata/commerce-gateway/backends';

interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: string;
  status: string;
  customer_email?: string;
  amount_total?: number;
  currency?: string;
}

interface StripeConfig {
  secretKey: string;
  successUrl: string;
  cancelUrl: string;
}

export class StripeOrderBackend implements OrderBackend {
  private secretKey: string;
  private successUrl: string;
  private cancelUrl: string;
  private orders: Map<string, Order> = new Map(); // In production, use a database

  constructor(config: StripeConfig) {
    this.secretKey = config.secretKey;
    this.successUrl = config.successUrl;
    this.cancelUrl = config.cancelUrl;
  }

  async createOrder(
    cart: Cart,
    shippingAddress: ShippingAddress,
    paymentInfo?: PaymentInfo
  ): Promise<Order> {
    // Create Stripe Checkout Session
    const checkoutSession = await this.createStripeCheckoutSession(cart, shippingAddress);

    const order: Order = {
      id: `order_${Date.now()}`,
      status: 'pending',
      items: cart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: cart.subtotal,
      tax: 0, // Calculate tax as needed
      shipping: 0, // Calculate shipping as needed
      total: cart.total,
      currency: cart.currency,
      shippingAddress,
      paymentStatus: 'pending',
      checkoutUrl: checkoutSession.url,
      stripeSessionId: checkoutSession.id,
      createdAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    // Update payment status from Stripe if pending
    if (order.paymentStatus === 'pending' && order.stripeSessionId) {
      const session = await this.getStripeSession(order.stripeSessionId);
      if (session.payment_status === 'paid') {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
      }
    }

    return order;
  }

  async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = status;
    order.updatedAt = new Date();
    this.orders.set(orderId, order);
    return order;
  }

  private async createStripeCheckoutSession(
    cart: Cart,
    shippingAddress: ShippingAddress
  ): Promise<StripeCheckoutSession> {
    const lineItems = cart.items.map(item => ({
      price_data: {
        currency: cart.currency.toLowerCase(),
        product_data: {
          name: item.name,
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: Math.round(item.unitPrice * 100), // Stripe uses cents
      },
      quantity: item.quantity,
    }));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.encodeFormData({
        mode: 'payment',
        success_url: this.successUrl,
        cancel_url: this.cancelUrl,
        'customer_email': shippingAddress.email,
        'line_items': lineItems,
        'shipping_address_collection[allowed_countries][]': 'US',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe error: ${error}`);
    }

    return response.json() as Promise<StripeCheckoutSession>;
  }

  private async getStripeSession(sessionId: string): Promise<StripeCheckoutSession> {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Stripe session');
    }

    return response.json() as Promise<StripeCheckoutSession>;
  }

  private encodeFormData(data: Record<string, unknown>): string {
    const encode = (key: string, value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap((v, i) => encode(`${key}[${i}]`, v));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.entries(value).flatMap(([k, v]) => encode(`${key}[${k}]`, v));
      }
      return [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`];
    };

    return Object.entries(data).flatMap(([k, v]) => encode(k, v)).join('&');
  }
}

// Extend Order type with Stripe-specific fields
declare module '@betterdata/commerce-gateway/backends' {
  interface Order {
    stripeSessionId?: string;
    checkoutUrl?: string;
  }
}

