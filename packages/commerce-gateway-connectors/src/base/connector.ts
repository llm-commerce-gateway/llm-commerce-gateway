/**
 * @betterdata/commerce-gateway-connectors - Base Connector
 * 
 * Abstract base class for e-commerce platform connectors.
 * Provides common functionality and structure for all connectors.
 * 
 * @license MIT
 */

import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  GatewayBackends,
} from '@betterdata/commerce-gateway/backends/interfaces';

/**
 * Base configuration interface for all connectors
 */
export interface BaseConnectorConfig {
  /** Platform-specific configuration */
  [key: string]: unknown;
}

/**
 * Abstract base class for e-commerce platform connectors
 * 
 * All connectors should extend this class and implement the required backends.
 * 
 * @example
 * ```typescript
 * class MyConnector extends BaseConnector {
 *   getBackends(): GatewayBackends {
 *     return {
 *       products: new MyProductBackend(this.config),
 *       cart: new MyCartBackend(this.config),
 *       orders: new MyOrderBackend(this.config),
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseConnector {
  protected config: BaseConnectorConfig;

  constructor(config: BaseConnectorConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Validate connector configuration
   * Override in subclasses to add platform-specific validation
   */
  protected validateConfig(): void {
    if (!this.config || typeof this.config !== 'object') {
      throw new Error('Connector config is required');
    }
  }

  /**
   * Get all backends for this connector
   * Must be implemented by subclasses
   */
  abstract getBackends(): GatewayBackends;

  /**
   * Get the product backend
   */
  getProductBackend(): ProductBackend {
    return this.getBackends().products;
  }

  /**
   * Get the cart backend
   */
  getCartBackend(): CartBackend {
    return this.getBackends().cart;
  }

  /**
   * Get the order backend
   */
  getOrderBackend(): OrderBackend {
    return this.getBackends().orders;
  }

  /**
   * Get the link generator (if available)
   */
  getLinkGenerator(): GatewayBackends['links'] {
    return this.getBackends().links;
  }
}
