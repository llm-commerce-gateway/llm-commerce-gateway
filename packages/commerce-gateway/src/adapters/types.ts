/**
 * @betterdata/llm-gateway - Adapter Types
 * 
 * Unified types for all LLM adapters (OpenAI, Grok, etc.)
 * 
 * @license MIT
 */

import type { GatewayBackends, Cart } from '../backends/interfaces';
import type { SessionManager } from '../session/SessionManager';

// ============================================================================
// Unified LLM Types
// ============================================================================

/** Supported LLM providers */
export type LLMProvider = 'openai' | 'grok' | 'anthropic' | 'google' | 'perplexity' | 'llama';

/** Message role */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

/** Chat message */
export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  function_call?: FunctionCall;
}

/** Tool call from LLM */
export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

/** Function call details */
export interface FunctionCall {
  name: string;
  arguments: string; // JSON string
}

/** Tool result to send back */
export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/** Unified LLM request */
export interface LLMRequest {
  /** Conversation messages */
  messages: ChatMessage[];
  
  /** Session ID for cart persistence */
  sessionId?: string;
  
  /** User ID (if authenticated) */
  userId?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Model to use (adapter-specific) */
  model?: string;
  
  /** Temperature (0-2) */
  temperature?: number;
  
  /** Max tokens in response */
  maxTokens?: number;
  
  /** Enable streaming */
  stream?: boolean;
  
  /** Tool choice mode */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/** Unified LLM response */
export interface LLMResponse {
  /** Response ID */
  id: string;
  
  /** Model used */
  model: string;
  
  /** Response choices */
  choices: LLMChoice[];
  
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** Session ID for continuity */
  sessionId?: string;
  
  /** Current cart state */
  cart?: Cart;
  
  /** Finish reason */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

/** Response choice */
export interface LLMChoice {
  index: number;
  message: ChatMessage;
  finishReason: string | null;
}

// ============================================================================
// Streaming Types
// ============================================================================

/** Streaming chunk */
export interface StreamChunk {
  id: string;
  model: string;
  choices: StreamChoice[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Stream choice delta */
export interface StreamChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finishReason: string | null;
}

/** Stream event types */
export type StreamEvent = 
  | { type: 'start'; data: { id: string; model: string } }
  | { type: 'chunk'; data: StreamChunk }
  | { type: 'tool_call'; data: ToolCall }
  | { type: 'tool_result'; data: ToolResult }
  | { type: 'done'; data: LLMResponse }
  | { type: 'error'; data: { message: string; code?: string } };

// ============================================================================
// Adapter Configuration
// ============================================================================

/** Base adapter configuration */
export interface BaseAdapterConfig {
  /** Backend implementations */
  backends: GatewayBackends;
  
  /** Session manager (optional) */
  session?: SessionManager;
  
  /** Which tools to enable */
  tools?: string[];
  
  /** Default model */
  model?: string;
  
  /** Default temperature */
  temperature?: number;
  
  /** Default max tokens */
  maxTokens?: number;
  
  /** System prompt to prepend */
  systemPrompt?: string;
  
  /** Enable debug logging */
  debug?: boolean;
}

/** OpenAI-specific configuration */
export interface OpenAIAdapterConfig extends BaseAdapterConfig {
  /** OpenAI API key */
  apiKey: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Base URL (for Azure OpenAI, etc.) */
  baseUrl?: string;
  
  /** Default model */
  model?: 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | string;
}

/** Grok-specific configuration */
export interface GrokAdapterConfig extends BaseAdapterConfig {
  /** Grok API key */
  apiKey: string;

  /** Base URL */
  baseUrl?: string;

  /** Default model */
  model?: 'grok-2' | 'grok-1' | string;
}

/** Anthropic-specific configuration */
export interface AnthropicAdapterConfig extends BaseAdapterConfig {
  /** Anthropic API key */
  apiKey: string;

  /** Base URL */
  baseUrl?: string;

  /** Default model */
  model?: 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-opus-20240229' | string;

  /** API version header */
  anthropicVersion?: string;

  /** Max tool iterations */
  maxToolIterations?: number;
}

/** Gemini-specific configuration */
export interface GeminiAdapterConfig extends BaseAdapterConfig {
  /** Google AI API key */
  apiKey: string;

  /** Base URL */
  baseUrl?: string;

  /** Default model */
  model?: 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'gemini-pro' | string;

  /** Max tool iterations */
  maxToolIterations?: number;
}

/** Perplexity-specific configuration */
export interface PerplexityAdapterConfig extends BaseAdapterConfig {
  /** Perplexity API key */
  apiKey: string;

  /** Base URL */
  baseUrl?: string;

  /** Default model */
  model?: 'sonar-pro' | 'sonar' | string;

  /** Return citations in response */
  returnCitations?: boolean;

  /** Return images in response */
  returnImages?: boolean;

  /** Max tool iterations */
  maxToolIterations?: number;
}

/** Llama-specific configuration (Together AI, Groq, local) */
export interface LlamaAdapterConfig extends BaseAdapterConfig {
  /** API key for the provider */
  apiKey: string;

  /** Base URL for the API */
  baseUrl: string;

  /** Default model */
  model?: string;

  /** Provider name */
  provider?: 'together' | 'groq' | 'local' | string;

  /** Max tool iterations */
  maxToolIterations?: number;

  /** Additional headers */
  additionalHeaders?: Record<string, string>;
}

// ============================================================================
// Adapter Interface
// ============================================================================

/** Session data */
export interface AdapterSession {
  id: string;
  messages: ChatMessage[];
  cart?: Cart;
  userId?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/** Tool definition (simplified) */
export interface AdapterToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

/** JSON Schema type */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** Unified adapter interface */
export interface LLMAdapter {
  /** Process a chat request */
  handleRequest(request: LLMRequest): Promise<LLMResponse>;
  
  /** Process a streaming request */
  handleStreamingRequest?(
    request: LLMRequest
  ): AsyncGenerator<StreamEvent, void, unknown>;
  
  /** Get available tools */
  listTools(): AdapterToolDefinition[];
  
  /** Get session by ID */
  getSession(sessionId: string): Promise<AdapterSession | null>;
  
  /** Create or update session */
  saveSession(session: AdapterSession): Promise<void>;
  
  /** Execute a tool */
  executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<string>;
}

/** Tool execution context */
export interface ToolContext {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  cart?: Cart;
  backends: GatewayBackends;
}

// ============================================================================
// OpenAI-Specific Types
// ============================================================================

/** OpenAI function definition format */
export interface OpenAIFunction {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/** OpenAI Assistants API types */
export interface OpenAIAssistant {
  id: string;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools: OpenAIFunction[];
  metadata?: Record<string, string>;
}

export interface OpenAIThread {
  id: string;
  metadata?: Record<string, string>;
}

export interface OpenAIRun {
  id: string;
  threadId: string;
  assistantId: string;
  status: 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';
  requiredAction?: {
    type: 'submit_tool_outputs';
    submitToolOutputs: {
      toolCalls: ToolCall[];
    };
  };
}

// ============================================================================
// Grok-Specific Types
// ============================================================================

/** Grok tool definition format */
export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

