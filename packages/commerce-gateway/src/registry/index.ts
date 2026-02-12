/**
 * @betterdata/llm-gateway/registry
 * 
 * Commerce Gateway Registry integration
 * 
 * @license MIT
 */

export { RegistryClient, createRegistryClient } from './client';
export type { 
  RegistryClientConfig,
  BrandResolution,
  GTINResolution,
  CategoryResolution,
} from './client';

export { parseShopQuery } from './shop-parser';
export type { ParsedShopQuery } from './shop-parser';

export { isValidWellKnownSchema, parseWellKnownSchema } from './well-known-schema';
export type { WellKnownCommerceGateway } from './well-known-schema';

