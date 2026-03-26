/**
 * @betterdata/commerce-gateway-connectors - Connector Exports
 * 
 * Pre-built connectors for popular e-commerce platforms.
 * 
 * @license Apache-2.0
 */

// Base connector
export { BaseConnector, type BaseConnectorConfig } from './base/connector';

// Platform connectors
export { ShopifyConnector, type ShopifyConnectorConfig } from './shopify';
export { BigCommerceConnector, type BigCommerceConnectorConfig } from './bigcommerce';
export { WooCommerceConnector, type WooCommerceConnectorConfig } from './woocommerce';
