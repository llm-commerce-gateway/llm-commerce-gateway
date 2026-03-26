/**
 * @betterdata/commerce-gateway - Capability Provider Interfaces
 *
 * This module exports interfaces and baseline implementations for
 * merchant capability providers. These providers abstract internal
 * SCM/commerce concepts and expose buyer-friendly APIs.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    LLM Gateway Tools                        │
 * │  (check_availability, get_fulfillment_options, etc.)        │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  Capability Providers                       │
 * │  (AvailabilityProvider, FulfillmentProvider, etc.)          │
 * │                                                             │
 * │  ┌─────────────────┐  ┌──────────────────────────────────┐  │
 * │  │   OSS Baseline  │  │      Cloud/SCM Enhanced          │  │
 * │  │                 │  │                                  │  │
 * │  │ Simple boolean  │  │ Multi-location ATP               │  │
 * │  │ Static rates    │  │ Dynamic carrier rates            │  │
 * │  │ Trust-all auth  │  │ Full DNS/meta verification       │  │
 * │  └─────────────────┘  └──────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   AvailabilityProvider,
 *   SimpleAvailabilityProvider,
 *   FulfillmentProvider,
 *   StaticFulfillmentProvider,
 * } from '@betterdata/commerce-gateway/providers';
 *
 * // Use baseline providers for development
 * const availability = new SimpleAvailabilityProvider(getProduct);
 * const fulfillment = new StaticFulfillmentProvider([
 *   { id: 'standard', method: 'Standard Shipping', price: 5.99, ... },
 * ]);
 *
 * // Or implement your own for production
 * class MyAvailabilityProvider implements AvailabilityProvider {
 *   async checkAvailability(input) { ... }
 * }
 * ```
 *
 * @packageDocumentation
 * @license Apache-2.0
 */

// ============================================================================
// Availability Provider
// ============================================================================

export { SimpleAvailabilityProvider } from './availability';
export type {
  AvailabilityProvider,
  CheckAvailabilityInput,
  CheckAvailabilityOutput,
} from './availability';

// ============================================================================
// Fulfillment Provider
// ============================================================================

export { StaticFulfillmentProvider } from './fulfillment';
export type {
  FulfillmentProvider,
  GetFulfillmentOptionsInput,
  GetFulfillmentOptionsOutput,
  FulfillmentOption,
  StaticFulfillmentOption,
} from './fulfillment';

// ============================================================================
// Verification Provider
// ============================================================================

export { TrustAllVerificationProvider } from './verification';
export type {
  VerificationProvider,
  VerificationMethod,
  ChallengeStatus,
  Challenge,
  ChallengeResult,
} from './verification';

// ============================================================================
// Default Providers Factory
// ============================================================================

import { SimpleAvailabilityProvider } from './availability';
import { StaticFulfillmentProvider, StaticFulfillmentOption } from './fulfillment';
import { TrustAllVerificationProvider } from './verification';
import type { AvailabilityProvider } from './availability';
import type { FulfillmentProvider } from './fulfillment';
import type { VerificationProvider } from './verification';

/**
 * Default shipping options for baseline provider.
 */
export const DEFAULT_SHIPPING_OPTIONS: StaticFulfillmentOption[] = [
  {
    id: 'standard',
    method: 'Standard Shipping',
    carrier: 'USPS',
    price: 5.99,
    currency: 'USD',
    minDays: 5,
    maxDays: 7,
  },
  {
    id: 'express',
    method: 'Express Shipping',
    carrier: 'UPS',
    price: 14.99,
    currency: 'USD',
    minDays: 2,
    maxDays: 3,
  },
  {
    id: 'overnight',
    method: 'Overnight',
    carrier: 'FedEx',
    price: 29.99,
    currency: 'USD',
    minDays: 1,
    maxDays: 1,
  },
];

/**
 * Configuration for baseline providers.
 */
export interface BaselineProvidersConfig {
  /**
   * Function to get product data for availability checks.
   */
  getProduct: (productId: string) => Promise<{
    id: string;
    inStock: boolean;
    quantity?: number;
  } | null>;

  /**
   * Custom shipping options (defaults to standard/express/overnight).
   */
  shippingOptions?: StaticFulfillmentOption[];

  /**
   * Free shipping threshold in dollars.
   */
  freeShippingThreshold?: number;

  /**
   * Currency code (defaults to USD).
   */
  currency?: string;
}

/**
 * Baseline providers bundle.
 */
export interface BaselineProviders {
  availability: AvailabilityProvider;
  fulfillment: FulfillmentProvider;
  verification: VerificationProvider;
}

/**
 * Create baseline providers for development/OSS use.
 *
 * These providers work without SCM integration:
 * - Availability: Simple in-stock boolean
 * - Fulfillment: Static rate table
 * - Verification: Trust-all (no verification)
 *
 * @param config - Provider configuration
 * @returns Bundle of baseline providers
 *
 * @example
 * ```typescript
 * const providers = createBaselineProviders({
 *   getProduct: async (id) => db.products.findUnique({ where: { id } }),
 *   freeShippingThreshold: 75,
 * });
 *
 * // Use in gateway
 * const availability = await providers.availability.checkAvailability({
 *   productId: 'prod_123',
 *   quantity: 2,
 * });
 * ```
 */
export function createBaselineProviders(config: BaselineProvidersConfig): BaselineProviders {
  return {
    availability: new SimpleAvailabilityProvider(config.getProduct),
    fulfillment: new StaticFulfillmentProvider(
      config.shippingOptions ?? DEFAULT_SHIPPING_OPTIONS,
      {
        freeShippingThreshold: config.freeShippingThreshold,
        currency: config.currency,
      }
    ),
    verification: new TrustAllVerificationProvider(),
  };
}
