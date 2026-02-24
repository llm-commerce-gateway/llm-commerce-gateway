/**
 * @betterdata/commerce-gateway/openai
 * 
 * OpenAI Function Calling and Assistants API adapters.
 * 
 * @example
 * ```typescript
 * // Function Calling (Chat Completions)
 * import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';
 * 
 * const adapter = new OpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   backends: { products, cart, orders },
 * });
 * 
 * const response = await adapter.handleRequest({
 *   messages: [{ role: 'user', content: 'Find shoes under $100' }],
 * });
 * 
 * // Assistants API (Persistent Threads)
 * import { OpenAIAssistantsClient } from '@betterdata/commerce-gateway/openai';
 * 
 * const client = new OpenAIAssistantsClient({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   backends: { products, cart, orders },
 * });
 * 
 * const assistant = await client.createAssistant({
 *   name: 'Shopping Helper',
 *   tools: ['search_products', 'add_to_cart'],
 * });
 * ```
 * 
 * @license MIT
 */

// Main exports
export { OpenAIAdapter, createOpenAIHandler } from './OpenAIAdapter';
export { OpenAIAssistantsClient } from './assistants';

// Types
export type {
  OpenAIAdapterConfig,
  OpenAIFunction,
} from '../types';

export type {
  AssistantsConfig,
  CreateAssistantOptions,
  Assistant,
  Thread,
  Message,
  Run,
} from './assistants';

