/**
 * @betterdata/llm-gateway - LLM Adapters
 *
 * Unified adapters for different LLM providers.
 * All adapters share the same backend interfaces for consistent tool execution.
 *
 * @example
 * ```typescript
 * // OpenAI
 * import { OpenAIAdapter } from '@betterdata/llm-gateway/openai';
 *
 * // Grok
 * import { GrokAdapter } from '@betterdata/llm-gateway/grok';
 *
 * // Anthropic (Claude)
 * import { AnthropicAdapter } from '@betterdata/llm-gateway/anthropic';
 *
 * // Google (Gemini)
 * import { GeminiAdapter } from '@betterdata/llm-gateway/google';
 *
 * // Perplexity
 * import { PerplexityAdapter } from '@betterdata/llm-gateway/perplexity';
 *
 * // Llama (Together AI, Groq, local)
 * import { LlamaAdapter } from '@betterdata/llm-gateway/llama';
 *
 * // Or import all from adapters
 * import { OpenAIAdapter, GrokAdapter, AnthropicAdapter, GeminiAdapter, BaseAdapter } from '@betterdata/llm-gateway/adapters';
 * ```
 *
 * @license MIT
 */

// Base adapter
export { BaseAdapter, TOOL_SCHEMAS } from './BaseAdapter';

// OpenAI
export { OpenAIAdapter, createOpenAIHandler } from './openai/OpenAIAdapter';
export { OpenAIAssistantsClient } from './openai/assistants';

// Grok
export { GrokAdapter, createGrokHandler } from './grok/GrokAdapter';

// Anthropic (Claude)
export { AnthropicAdapter, createAnthropicHandler } from './anthropic/AnthropicAdapter';

// Google (Gemini)
export { GeminiAdapter, createGeminiHandler } from './google/GeminiAdapter';

// Perplexity
export { PerplexityAdapter, createPerplexityHandler } from './perplexity/PerplexityAdapter';

// Llama (Together AI, Groq, local)
export {
  LlamaAdapter,
  createLlamaHandler,
  createTogetherAdapter,
  createGroqAdapter,
  createLocalLlamaAdapter,
} from './llama/LlamaAdapter';

// Types
export type {
  // Common types
  LLMAdapter,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  MessageRole,
  ToolCall,
  FunctionCall,
  ToolResult,
  ToolContext,

  // Streaming
  StreamEvent,
  StreamChunk,
  StreamChoice,

  // Session
  AdapterSession,
  AdapterToolDefinition,
  JSONSchema,

  // Configuration
  BaseAdapterConfig,
  OpenAIAdapterConfig,
  GrokAdapterConfig,
  AnthropicAdapterConfig,
  GeminiAdapterConfig,
  PerplexityAdapterConfig,
  LlamaAdapterConfig,

  // OpenAI specific
  OpenAIFunction,
  OpenAIAssistant,
  OpenAIThread,
  OpenAIRun,

  // Grok specific
  GrokTool,
} from './types';

// OpenAI Assistants types
export type {
  AssistantsConfig,
  CreateAssistantOptions,
  Assistant,
  Thread,
  Message,
  Run,
} from './openai/assistants';

