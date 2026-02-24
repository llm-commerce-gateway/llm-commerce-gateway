/**
 * @betterdata/commerce-gateway - Fulfillment Provider Interface
 *
 * Provides buyer-facing shipping and fulfillment options.
 * This interface abstracts away internal SCM concepts (warehouses, allocation)
 * and exposes only what buyers need to make shipping decisions.
 *
 * OSS: StaticFulfillmentProvider (fixed rate table)
 * Cloud/SCM: Dynamic rates, multi-location optimization, carrier integration
 *
 * @example
 * ```typescript
 * import type { FulfillmentProvider } from '@betterdata/commerce-gateway/providers';
 *
 * class MyFulfillmentProvider implements FulfillmentProvider {
 *   async getFulfillmentOptions(input) {
 *     return {
 *       canFulfill: true,
 *       message: 'Ships from our warehouse',
 *       options: [
 *         { id: 'standard', method: 'Standard', price: { amount: 5.99, currency: 'USD' }, ... },
 *       ],
 *     };
 *   }
 * }
 * ```
 *
 * @license MIT
 */

// ============================================================================
// Input/Output Types
// ============================================================================

/**
 * Input for fulfillment options request.
 *
 * Uses buyer-friendly vocabulary:
 * - items: What I want to buy
 * - destination: Where I want it shipped
 * - neededBy: When I need it
 *
 * Does NOT include:
 * - locationId (internal - system decides best origin)
 * - allocationStrategy (internal SCM concept)
 * - carrierId (internal - show carrier names instead)
 */
export interface GetFulfillmentOptionsInput {
  /** Items to ship */
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;

  /** Destination address */
  destination: {
    postalCode?: string;
    city?: string;
    state?: string;
    country: string;
  };

  /**
   * When the buyer needs the items.
   * ISO date format: "2024-12-20"
   */
  neededBy?: string;

  /** Organization context (for multi-tenant) */
  organizationId?: string;
}

/**
 * A single fulfillment option.
 */
export interface FulfillmentOption {
  /** Unique ID for this option */
  id: string;

  /** Shipping method name */
  method: string;

  /** Carrier name (optional) */
  carrier?: string;

  /** Shipping price */
  price: {
    amount: number;
    currency: string;
  };

  /** Estimated delivery window */
  estimatedDelivery: {
    /** Earliest arrival date (ISO format) */
    min: string;

    /** Latest arrival date (ISO format) */
    max: string;

    /** Human-readable display string */
    display: string;
  };

  /** True if this option meets the neededBy deadline */
  meetsDeadline?: boolean;

  /** True if this is the fastest option */
  isFastest?: boolean;

  /** True if this is the cheapest option */
  isCheapest?: boolean;

  /** True if this is the recommended option */
  isRecommended?: boolean;

  /** Optional description or notes */
  description?: string;
}

/**
 * Output for fulfillment options request.
 */
export interface GetFulfillmentOptionsOutput {
  /** Can we fulfill this order? */
  canFulfill: boolean;

  /** Human-readable summary message */
  message: string;

  /** Available shipping options */
  options: FulfillmentOption[];

  /**
   * Split shipment info (if order must ship from multiple locations).
   * Only present when split shipment is required.
   */
  splitShipment?: {
    required: boolean;
    reason: string;
    shipments: Array<{
      items: Array<{ productId: string; quantity: number }>;
      options: FulfillmentOption[];
    }>;
  };

  /** True if faster options are available (for urgency messaging) */
  fasterOptionsAvailable?: boolean;

  /** Free shipping threshold info */
  freeShippingThreshold?: {
    amount: number;
    currency: string;
    message: string;
  };
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Fulfillment Provider Interface.
 *
 * Implement this to connect your shipping/fulfillment system to the LLM Gateway.
 * The provider abstracts internal logistics and returns buyer-friendly options.
 *
 * @example
 * ```typescript
 * // Simple implementation (OSS baseline)
 * class StaticFulfillmentProvider implements FulfillmentProvider {
 *   async getFulfillmentOptions(input) {
 *     return {
 *       canFulfill: true,
 *       message: 'Ships from our warehouse',
 *       options: [
 *         { id: 'standard', method: 'Standard Shipping', price: { amount: 5.99, currency: 'USD' }, ... },
 *         { id: 'express', method: 'Express Shipping', price: { amount: 14.99, currency: 'USD' }, ... },
 *       ],
 *     };
 *   }
 * }
 *
 * // SCM-enhanced implementation
 * class SCMFulfillmentProvider implements FulfillmentProvider {
 *   async getFulfillmentOptions(input) {
 *     // Find best origin location
 *     const origin = await this.findBestLocation(input.items, input.destination);
 *
 *     // Get live carrier rates
 *     const rates = await this.getCarrierRates(origin, input.destination, input.items);
 *
 *     // Calculate delivery dates
 *     const options = rates.map(rate => ({
 *       id: rate.id,
 *       method: rate.serviceName,
 *       carrier: rate.carrierName,
 *       price: { amount: rate.totalCost, currency: 'USD' },
 *       estimatedDelivery: this.calculateDeliveryWindow(rate),
 *       meetsDeadline: input.neededBy ? rate.deliveryDate <= input.neededBy : undefined,
 *     }));
 *
 *     return { canFulfill: true, message: 'Ships from ' + origin.name, options };
 *   }
 * }
 * ```
 */
export interface FulfillmentProvider {
  /**
   * Get fulfillment options for items.
   *
   * @param input - Items, destination, and deadline
   * @returns Available shipping options
   */
  getFulfillmentOptions(input: GetFulfillmentOptionsInput): Promise<GetFulfillmentOptionsOutput>;

  /**
   * Optional: Validate a specific fulfillment option before order.
   */
  validateOption?(optionId: string, input: GetFulfillmentOptionsInput): Promise<{
    valid: boolean;
    message?: string;
  }>;

  /**
   * Optional: Health check for the fulfillment service.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

// ============================================================================
// Baseline Implementation
// ============================================================================

/**
 * Static fulfillment options configuration.
 */
export interface StaticFulfillmentOption {
  id: string;
  method: string;
  carrier?: string;
  price: number;
  currency: string;
  minDays: number;
  maxDays: number;
}

/**
 * Static fulfillment provider for OSS baseline.
 *
 * Returns fixed shipping options from configuration.
 * No carrier API integration, no multi-location optimization.
 */
export class StaticFulfillmentProvider implements FulfillmentProvider {
  private options: StaticFulfillmentOption[];
  private freeShippingThreshold?: number;
  private currency: string;

  constructor(
    options: StaticFulfillmentOption[],
    config?: {
      freeShippingThreshold?: number;
      currency?: string;
    }
  ) {
    this.options = options;
    this.freeShippingThreshold = config?.freeShippingThreshold;
    this.currency = config?.currency ?? 'USD';
  }

  async getFulfillmentOptions(
    input: GetFulfillmentOptionsInput
  ): Promise<GetFulfillmentOptionsOutput> {
    const today = new Date();
    const neededByDate = input.neededBy ? new Date(input.neededBy) : undefined;

    // Map static options to full output
    const options: FulfillmentOption[] = this.options.map((opt, index) => {
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + opt.minDays);

      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + opt.maxDays);

      const meetsDeadline = neededByDate
        ? maxDate <= neededByDate
        : undefined;

      return {
        id: opt.id,
        method: opt.method,
        carrier: opt.carrier ?? '',
        price: { amount: opt.price, currency: opt.currency },
        estimatedDelivery: {
          min: minDate.toISOString().split('T')[0] ?? '',
          max: maxDate.toISOString().split('T')[0] ?? '',
          display: this.formatDeliveryDisplay(minDate, maxDate),
        },
        meetsDeadline: meetsDeadline ?? false,
        isFastest: index === 0 || opt.minDays === Math.min(...this.options.map(o => o.minDays)),
        isCheapest: opt.price === Math.min(...this.options.map(o => o.price)),
        isRecommended: index === 0, // First option is default recommendation
      };
    });

    // Sort by speed (fastest first)
    options.sort((a, b) => {
      const aMin = new Date(a.estimatedDelivery.min).getTime();
      const bMin = new Date(b.estimatedDelivery.min).getTime();
      return aMin - bMin;
    });

    // Update fastest/cheapest flags after sort
    if (options.length > 0 && options[0]) {
      options[0].isFastest = true;
      const cheapest = options.reduce((min, opt) =>
        opt.price.amount < min.price.amount ? opt : min
      );
      cheapest.isCheapest = true;
    }

    const result: GetFulfillmentOptionsOutput = {
      canFulfill: true,
      message: 'Ships within 1-2 business days',
      options,
    };

    // Add free shipping info if applicable
    if (this.freeShippingThreshold) {
      result.freeShippingThreshold = {
        amount: this.freeShippingThreshold,
        currency: this.currency,
        message: `Free shipping on orders over $${this.freeShippingThreshold}`,
      };
    }

    // Check if faster options are available
    if (neededByDate && options.some(o => !o.meetsDeadline) && options.some(o => o.meetsDeadline)) {
      result.fasterOptionsAvailable = true;
    }

    return result;
  }

  private formatDeliveryDisplay(min: Date, max: Date): string {
    const formatDate = (d: Date) => {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (min.getTime() === max.getTime()) {
      return formatDate(min);
    }

    return `${formatDate(min)} - ${formatDate(max)}`;
  }
}
