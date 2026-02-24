/**
 * @betterdata/commerce-gateway/grok
 * 
 * Grok (xAI) Function Calling adapter.
 * 
 * @example
 * ```typescript
 * import { GrokAdapter } from '@betterdata/commerce-gateway/grok';
 * 
 * const adapter = new GrokAdapter({
 *   apiKey: process.env.GROK_API_KEY!,
 *   backends: { products, cart, orders },
 * });
 * 
 * const response = await adapter.handleRequest({
 *   messages: [{ role: 'user', content: 'Find gaming headphones' }],
 *   model: 'grok-2',
 * });
 * ```
 * 
 * @see https://docs.x.ai/
 * @license MIT
 */

// Main exports
export { GrokAdapter, createGrokHandler } from './GrokAdapter';

// X/Twitter optimized formatter
export { TwitterFormatter, createTwitterFormatter } from './twitter-formatter';
export type { TwitterFormatterConfig } from './twitter-formatter';

// Types
export type { GrokAdapterConfig, GrokTool } from '../types';

