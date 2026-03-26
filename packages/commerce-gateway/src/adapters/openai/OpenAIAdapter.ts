/**
 * @betterdata/commerce-gateway - OpenAI Adapter
 * 
 * Adapter for OpenAI's Chat Completions API with Function Calling.
 * Provides seamless integration with GPT-4, GPT-3.5, and other OpenAI models.
 * 
 * @example
 * ```typescript
 * import { OpenAIAdapter } from '@betterdata/commerce-gateway/openai';
 * 
 * const adapter = new OpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   backends: { products, cart, orders },
 *   tools: ['search_products', 'add_to_cart'],
 * });
 * 
 * const response = await adapter.handleRequest({
 *   messages: [{ role: 'user', content: 'Find running shoes under $100' }],
 * });
 * ```
 * 
 * @license Apache-2.0
 */

import { BaseAdapter } from '../BaseAdapter';
import type {
  OpenAIAdapterConfig,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  ToolCall,
  OpenAIFunction,
  StreamEvent,
  ToolContext,
} from '../types';

// ============================================================================
// OpenAI API Types
// ============================================================================

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  tools?: OpenAIFunction[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  index?: number; // Present in streaming deltas
}

interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIChatChoice {
  index: number;
  message: OpenAIChatMessage;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChoice {
  index: number;
  delta: Partial<OpenAIChatMessage>;
  finish_reason: string | null;
}

// ============================================================================
// OpenAI Adapter
// ============================================================================

/**
 * OpenAI Function Calling Adapter
 * 
 * Handles chat completions with automatic tool execution.
 */
export class OpenAIAdapter extends BaseAdapter {
  private apiKey: string;
  private organizationId?: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: OpenAIAdapterConfig) {
    super(config);
    
    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.defaultModel = config.model ?? 'gpt-4-turbo';
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
    const tools = this.getOpenAITools();

    // Make initial API call
    let response = await this.callOpenAI({
      model: request.model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as OpenAIChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
    });

    // Handle tool calls iteratively
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (
      response.choices[0]?.finish_reason === 'tool_calls' &&
      response.choices[0]?.message?.tool_calls &&
      iterations < maxIterations
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
      const newMessages: OpenAIChatMessage[] = [
        ...this.toOpenAIMessages(messages),
        response.choices[0].message,
        ...toolResults,
      ];

      // Make follow-up API call
      response = await this.callOpenAI({
        model: request.model ?? this.defaultModel,
        messages: newMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      });
    }

    // Build response
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choice returned from OpenAI');
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
    const tools = this.getOpenAITools();

    // Emit start event
    yield {
      type: 'start',
      data: { id: this.generateId(), model: request.model ?? this.defaultModel },
    };

    // Make streaming API call
    const stream = await this.streamOpenAI({
      model: request.model ?? this.defaultModel,
      messages: this.toOpenAIMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as OpenAIChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      stream: true,
    });

    let fullMessage: ChatMessage = { role: 'assistant', content: '' };
    let pendingToolCalls: ToolCall[] = [];
    const toolCallBuilders: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      
      if (!choice) continue;

      // Handle content delta
      if (choice.delta.content) {
        fullMessage.content = (fullMessage.content ?? '') + choice.delta.content;
        yield {
          type: 'chunk',
          data: {
            id: chunk.id,
            model: chunk.model,
            choices: [{
              index: choice.index,
              delta: { content: choice.delta.content },
              finishReason: choice.finish_reason,
            }],
          },
        };
      }

      // Handle tool calls delta
      if (choice.delta.tool_calls) {
        for (const tcDelta of choice.delta.tool_calls) {
          const idx = tcDelta.index ?? 0;
          let builder = toolCallBuilders.get(idx);
          
          if (!builder) {
            builder = { id: '', name: '', arguments: '' };
            toolCallBuilders.set(idx, builder);
          }

          if (tcDelta.id) builder.id = tcDelta.id;
          if (tcDelta.function?.name) builder.name = tcDelta.function.name;
          if (tcDelta.function?.arguments) builder.arguments += tcDelta.function.arguments;
        }
      }

      // Handle finish
      if (choice.finish_reason === 'tool_calls') {
        // Build tool calls from accumulated data
        pendingToolCalls = Array.from(toolCallBuilders.values()).map(b => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: b.arguments },
        }));

        // Execute tool calls
        for (const toolCall of pendingToolCalls) {
          yield { type: 'tool_call', data: toolCall };

          const result = await this.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            {
              sessionId,
              userId: request.userId,
              organizationId: request.organizationId,
              cart: this.getCart(sessionId),
              backends: this.config.backends,
            }
          );

          yield {
            type: 'tool_result',
            data: {
              tool_call_id: toolCall.id,
              role: 'tool',
              content: result,
            },
          };
        }

        // Continue conversation with tool results
        // (In production, you'd make another streaming call here)
      }

      if (choice.finish_reason === 'stop') {
        break;
      }
    }

    // Update session
    session.messages.push(...request.messages);
    session.messages.push(fullMessage);
    session.cart = this.getCart(sessionId);
    await this.saveSession(session);

    // Emit done event
    yield {
      type: 'done',
      data: this.buildResponse(fullMessage, {
        model: request.model ?? this.defaultModel,
        sessionId,
        finishReason: 'stop',
      }),
    };
  }

  // ============================================================================
  // OpenAI API Calls
  // ============================================================================

  /**
   * Call OpenAI Chat Completions API
   */
  private async callOpenAI(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`OpenAI API error: ${errorData.error?.message ?? response.statusText}`);
    }

    return response.json() as Promise<OpenAIChatResponse>;
  }

  /**
   * Stream OpenAI Chat Completions API
   */
  private async *streamOpenAI(
    request: OpenAIChatRequest
  ): AsyncGenerator<OpenAIStreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`OpenAI API error: ${errorData.error?.message ?? response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk;
            yield chunk;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    return headers;
  }

  // ============================================================================
  // Tool Conversion
  // ============================================================================

  /**
   * Get tools in OpenAI format
   */
  private getOpenAITools(): OpenAIFunction[] {
    return this.listTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Execute tool calls and return results
   */
  private async executeToolCalls(
    toolCalls: OpenAIToolCall[],
    context: ToolContext
  ): Promise<OpenAIChatMessage[]> {
    const results: OpenAIChatMessage[] = [];

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
   * Convert internal messages to OpenAI format
   */
  private toOpenAIMessages(messages: ChatMessage[]): OpenAIChatMessage[] {
    return messages.map(msg => ({
      role: msg.role as OpenAIChatMessage['role'],
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
// Express/Hono Middleware Helper
// ============================================================================

/**
 * Create an Express/Hono handler for the OpenAI adapter
 */
export function createOpenAIHandler(adapter: OpenAIAdapter) {
  return async (req: { body: LLMRequest }, res: { json: (data: unknown) => void }) => {
    try {
      const response = await adapter.handleRequest(req.body);
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.json({ error: message });
    }
  };
}

