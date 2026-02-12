/**
 * @betterdata/llm-gateway - Perplexity Adapter
 *
 * Adapter for Perplexity's API (OpenAI-compatible).
 * Supports Sonar and Sonar Pro models with web search capabilities.
 *
 * @example
 * ```typescript
 * import { PerplexityAdapter } from '@betterdata/llm-gateway/adapters';
 *
 * const adapter = new PerplexityAdapter({
 *   apiKey: process.env.PERPLEXITY_API_KEY!,
 *   backends: { products, cart, orders },
 *   tools: ['search_products', 'add_to_cart'],
 * });
 *
 * const response = await adapter.handleRequest({
 *   messages: [{ role: 'user', content: 'Find running shoes under $100' }],
 * });
 * ```
 *
 * @license MIT
 */

import { BaseAdapter } from '../BaseAdapter';
import type {
  LLMRequest,
  LLMResponse,
  ChatMessage,
  StreamEvent,
  ToolContext,
} from '../types';
import type { PerplexityAdapterConfig } from './types';

// ============================================================================
// OpenAI-Compatible Types (Perplexity uses these)
// ============================================================================

interface ChatRequest {
  model: string;
  messages: ChatMessageRequest[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  return_citations?: boolean;
  return_images?: boolean;
}

interface ChatMessageRequest {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
}

interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatResponse {
  id: string;
  model: string;
  choices: ChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: Array<{ url: string; text?: string }>;
  images?: Array<{ url: string; originUrl?: string }>;
}

interface ChatChoice {
  index: number;
  message: ChatMessageRequest;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

// ============================================================================
// Perplexity Adapter
// ============================================================================

/**
 * Perplexity Adapter
 *
 * Handles chat completions with the Perplexity API (OpenAI-compatible).
 * Note: Tool calling support depends on the model used.
 */
export class PerplexityAdapter extends BaseAdapter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxToolIterations: number;
  private returnCitations: boolean;
  private returnImages: boolean;

  constructor(config: PerplexityAdapterConfig) {
    super(config);

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.perplexity.ai';
    this.defaultModel = config.model ?? 'sonar-pro';
    this.maxToolIterations = config.maxToolIterations ?? 10;
    this.returnCitations = config.returnCitations ?? false;
    this.returnImages = config.returnImages ?? false;
  }

  // ============================================================================
  // Main Request Handler
  // ============================================================================

  /**
   * Handle a chat completion request
   */
  async handleRequest(request: LLMRequest): Promise<LLMResponse> {
    const sessionId = request.sessionId ?? this.generateId('session');
    const session = await this.getOrCreateSession(sessionId, {
      userId: request.userId,
      organizationId: request.organizationId,
    });

    // Build messages
    const messages = this.buildMessages(request, session);

    // Get tools
    const tools = this.getTools();

    // Make initial API call
    let response = await this.callPerplexity({
      model: request.model ?? this.defaultModel,
      messages: this.toChatMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as ChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      return_citations: this.returnCitations,
      return_images: this.returnImages,
    });

    // Handle tool calls iteratively
    let iterations = 0;

    while (
      response.choices[0]?.finish_reason === 'tool_calls' &&
      response.choices[0]?.message?.tool_calls &&
      iterations < this.maxToolIterations
    ) {
      iterations++;
      this.log(`Processing tool calls (iteration ${iterations})`);

      // Execute tools
      const toolResults = await this.executeToolCalls(
        response.choices[0].message.tool_calls,
        {
          sessionId,
          userId: request.userId,
          organizationId: request.organizationId,
          cart: this.getCart(sessionId),
          backends: this.config.backends,
        }
      );

      // Build new messages with tool results
      const newMessages: ChatMessageRequest[] = [
        ...this.toChatMessages(messages),
        response.choices[0].message,
        ...toolResults,
      ];

      // Make follow-up API call
      response = await this.callPerplexity({
        model: request.model ?? this.defaultModel,
        messages: newMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        return_citations: this.returnCitations,
        return_images: this.returnImages,
      });
    }

    // Build response
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choice returned from Perplexity');
    }

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
    };

    // Update session
    session.messages.push(...request.messages);
    session.messages.push(responseMessage);
    session.cart = this.getCart(sessionId);
    await this.saveSession(session);

    return this.buildResponse(responseMessage, {
      id: response.id,
      model: response.model,
      sessionId,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
          }
        : undefined,
      finishReason: choice.finish_reason ?? undefined,
    });
  }

  // ============================================================================
  // Streaming Handler
  // ============================================================================

  /**
   * Handle a streaming chat completion request
   */
  async *handleStreamingRequest(
    request: LLMRequest
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const sessionId = request.sessionId ?? this.generateId('session');
    const session = await this.getOrCreateSession(sessionId, {
      userId: request.userId,
      organizationId: request.organizationId,
    });

    const messages = this.buildMessages(request, session);
    const tools = this.getTools();

    // Emit start event
    yield {
      type: 'start',
      data: { id: this.generateId(), model: request.model ?? this.defaultModel },
    };

    // For now, use non-streaming
    const response = await this.callPerplexity({
      model: request.model ?? this.defaultModel,
      messages: this.toChatMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as ChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      return_citations: this.returnCitations,
      return_images: this.returnImages,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choice returned from Perplexity');
    }

    // Emit content as chunk
    yield {
      type: 'chunk',
      data: {
        id: response.id,
        model: response.model,
        choices: [{
          index: 0,
          delta: { content: choice.message.content ?? '' },
          finishReason: choice.finish_reason,
        }],
      },
    };

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: choice.message.content,
    };

    // Update session
    session.messages.push(...request.messages);
    session.messages.push(responseMessage);
    session.cart = this.getCart(sessionId);
    await this.saveSession(session);

    // Emit done event
    yield {
      type: 'done',
      data: this.buildResponse(responseMessage, {
        id: response.id,
        model: response.model,
        sessionId,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
            }
          : undefined,
        finishReason: choice.finish_reason ?? undefined,
      }),
    };
  }

  // ============================================================================
  // API Calls
  // ============================================================================

  /**
   * Call Perplexity Chat Completions API
   */
  private async callPerplexity(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { message: response.statusText },
      })) as { error?: { message?: string } };
      throw new Error(
        `Perplexity API error: ${errorData.error?.message ?? response.statusText}`
      );
    }

    return response.json() as Promise<ChatResponse>;
  }

  // ============================================================================
  // Tool Conversion
  // ============================================================================

  /**
   * Get tools in OpenAI format
   */
  private getTools(): ToolDefinition[] {
    return this.listTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Execute tool calls and return results
   */
  private async executeToolCalls(
    toolCalls: ToolCallRequest[],
    context: ToolContext
  ): Promise<ChatMessageRequest[]> {
    const results: ChatMessageRequest[] = [];

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await this.executeTool(toolCall.function.name, args, context);

      results.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    return results;
  }

  // ============================================================================
  // Message Conversion
  // ============================================================================

  /**
   * Convert internal messages to API format
   */
  private toChatMessages(messages: ChatMessage[]): ChatMessageRequest[] {
    return messages.map(msg => ({
      role: msg.role as ChatMessageRequest['role'],
      content: msg.content,
      name: msg.name,
      tool_calls: msg.tool_calls?.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })),
      tool_call_id: msg.tool_call_id,
    }));
  }
}

// ============================================================================
// Handler Helper
// ============================================================================

/**
 * Create an Express/Hono handler for the Perplexity adapter
 */
export function createPerplexityHandler(adapter: PerplexityAdapter) {
  return async (
    req: { body: LLMRequest },
    res: { json: (data: unknown) => void }
  ) => {
    try {
      const response = await adapter.handleRequest(req.body);
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.json({ error: message });
    }
  };
}
