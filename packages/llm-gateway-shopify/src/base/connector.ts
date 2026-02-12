/**
 * Base Connector — Abstract base for e-commerce platform connectors.
 * @license MIT
 */

import type {
  ProductBackend,
  CartBackend,
  OrderBackend,
  GatewayBackends,
} from '@betterdata/commerce-gateway/backends';

export interface BaseConnectorConfig {
  [key: string]: unknown;
}

export abstract class BaseConnector {
  protected config: BaseConnectorConfig;

  constructor(config: BaseConnectorConfig) {
    this.config = config;
    this.validateConfig();
  }

  protected validateConfig(): void {
    if (!this.config || typeof this.config !== 'object') {
      throw new Error('Connector config is required');
    }
  }

  abstract getBackends(): GatewayBackends;

  getProductBackend(): ProductBackend {
    return this.getBackends().products;
  }

  getCartBackend(): CartBackend {
    return this.getBackends().cart;
  }

  getOrderBackend(): OrderBackend {
    return this.getBackends().orders;
  }

  getLinkGenerator(): GatewayBackends['links'] {
    return this.getBackends().links;
  }
}
