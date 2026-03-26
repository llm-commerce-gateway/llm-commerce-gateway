/**
 * @betterdata/commerce-gateway - Availability Provider Interface
 *
 * Provides buyer-facing product availability information.
 * This interface abstracts away internal SCM concepts (locations, quantities)
 * and exposes only what buyers need to know.
 *
 * OSS: SimpleAvailabilityProvider (boolean in-stock check)
 * Cloud/SCM: Multi-location ATP, confidence scoring, delivery estimates
 *
 * @example
 * ```typescript
 * import type { AvailabilityProvider } from '@betterdata/commerce-gateway/providers';
 *
 * class MyAvailabilityProvider implements AvailabilityProvider {
 *   async checkAvailability(input) {
 *     const product = await db.product.findUnique({ where: { id: input.productId } });
 *     return {
 *       available: product.inStock,
 *       message: product.inStock ? 'In stock - ships today' : 'Currently out of stock',
 *       confidence: 'high',
 *     };
 *   }
 * }
 * ```
 *
 * @license Apache-2.0
 */

// ============================================================================
// Input/Output Types
// ============================================================================

/**
 * Input for availability check.
 *
 * Uses buyer-friendly vocabulary:
 * - productId: The product to check
 * - variantId: Optional variant (size, color, etc.)
 * - quantity: Optional - "Do you have 5 of these?"
 *
 * Does NOT include:
 * - locationId (internal SCM concept)
 * - warehouseId (internal SCM concept)
 * - allocationStrategy (internal SCM concept)
 */
export interface CheckAvailabilityInput {
  /** Product ID or slug to check */
  productId: string;

  /** Variant ID if checking a specific variant */
  variantId?: string;

  /** Quantity needed (optional - defaults to 1) */
  quantity?: number;

  /** Organization context (for multi-tenant) */
  organizationId?: string;
}

/**
 * Output for availability check.
 *
 * Uses buyer-friendly vocabulary:
 * - available: Can I buy this?
 * - message: Human-readable status
 * - confidence: How sure are we?
 * - shipsBy: When will it ship?
 * - deliveryEstimate: When will it arrive?
 *
 * Does NOT include:
 * - quantityAvailable (internal SCM concept)
 * - locations[] (internal SCM concept)
 * - reservationId (internal SCM concept)
 */
export interface CheckAvailabilityOutput {
  /** The product that was checked */
  productId: string;

  /** The variant that was checked (if specified) */
  variantId?: string;

  /** Is this product available for purchase? */
  available: boolean;

  /**
   * Human-readable availability message.
   *
   * @example
   * - "In stock - ships today"
   * - "In stock - only 3 left!"
   * - "Low stock - order soon"
   * - "Currently out of stock"
   * - "Available for backorder"
   * - "Expected back in stock Dec 20"
   */
  message: string;

  /**
   * Confidence level in the availability data.
   *
   * - high: Real-time inventory data, very accurate
   * - medium: Cached data or estimated availability
   * - low: Stale data or external system unavailable
   */
  confidence: 'high' | 'medium' | 'low';

  /**
   * When the item will ship (if available).
   *
   * @example "Ships today", "Ships in 1-2 days", "Ships Dec 18"
   */
  shipsBy?: string;

  /**
   * Estimated delivery window (if available).
   */
  deliveryEstimate?: {
    /** Earliest arrival date (ISO format) */
    min: string;

    /** Latest arrival date (ISO format) */
    max: string;

    /** Human-readable display string */
    display: string;
  };

  /**
   * Alternative products if requested quantity unavailable.
   * Only includes buyer-relevant info (no internal IDs).
   */
  alternatives?: Array<{
    /** Product ID */
    productId: string;

    /** Product name */
    name: string;

    /** Why this is a good alternative */
    reason: string;

    /** Is this alternative available? */
    available: boolean;
  }>;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Availability Provider Interface.
 *
 * Implement this to connect your inventory system to the LLM Gateway.
 * The provider abstracts internal SCM concepts and returns buyer-friendly data.
 *
 * @example
 * ```typescript
 * // Simple implementation (OSS baseline)
 * class SimpleAvailabilityProvider implements AvailabilityProvider {
 *   async checkAvailability(input) {
 *     const product = await getProduct(input.productId);
 *     return {
 *       productId: product.id,
 *       available: product.inStock,
 *       message: product.inStock ? 'In stock' : 'Out of stock',
 *       confidence: 'medium',
 *     };
 *   }
 * }
 *
 * // SCM-enhanced implementation
 * class SCMAvailabilityProvider implements AvailabilityProvider {
 *   async checkAvailability(input) {
 *     const atp = await this.calculateATP(input.productId, input.quantity);
 *     const delivery = await this.calculateDelivery(atp.bestLocation);
 *
 *     return {
 *       productId: input.productId,
 *       available: atp.canFulfill,
 *       message: this.generateMessage(atp),
 *       confidence: 'high',
 *       shipsBy: delivery.shipsBy,
 *       deliveryEstimate: {
 *         min: delivery.minDate,
 *         max: delivery.maxDate,
 *         display: `Arrives ${delivery.display}`,
 *       },
 *     };
 *   }
 * }
 * ```
 */
export interface AvailabilityProvider {
  /**
   * Check availability for a product.
   *
   * @param input - Product and quantity to check
   * @returns Buyer-friendly availability information
   */
  checkAvailability(input: CheckAvailabilityInput): Promise<CheckAvailabilityOutput>;

  /**
   * Optional: Batch check availability for multiple products.
   * More efficient than individual calls for cart/order flows.
   */
  checkAvailabilityBatch?(
    inputs: CheckAvailabilityInput[]
  ): Promise<CheckAvailabilityOutput[]>;

  /**
   * Optional: Health check for the availability service.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
}

// ============================================================================
// Baseline Implementation
// ============================================================================

/**
 * Simple availability provider for OSS baseline.
 *
 * Returns basic in-stock boolean from product metadata.
 * No multi-location, no ATP calculation, no delivery estimates.
 */
export class SimpleAvailabilityProvider implements AvailabilityProvider {
  private getProduct: (productId: string) => Promise<{
    id: string;
    inStock: boolean;
    quantity?: number;
  } | null>;

  constructor(
    getProduct: (productId: string) => Promise<{
      id: string;
      inStock: boolean;
      quantity?: number;
    } | null>
  ) {
    this.getProduct = getProduct;
  }

  async checkAvailability(input: CheckAvailabilityInput): Promise<CheckAvailabilityOutput> {
    const product = await this.getProduct(input.productId);

    if (!product) {
      return {
        productId: input.productId,
        variantId: input.variantId,
        available: false,
        message: 'Product not found',
        confidence: 'high',
      };
    }

    const requestedQty = input.quantity ?? 1;
    const available = product.inStock && (product.quantity === undefined || product.quantity >= requestedQty);

    let message: string;
    if (!available) {
      message = 'Currently out of stock';
    } else if (product.quantity !== undefined && product.quantity <= 5) {
      message = `In stock - only ${product.quantity} left!`;
    } else {
      message = 'In stock - ships within 1-2 business days';
    }

    return {
      productId: product.id,
      variantId: input.variantId,
      available,
      message,
      confidence: 'medium', // Simple check, not real-time ATP
    };
  }
}
