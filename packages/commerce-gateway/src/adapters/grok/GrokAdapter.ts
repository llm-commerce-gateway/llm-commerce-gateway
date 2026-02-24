/**
 * @betterdata/commerce-gateway - Grok Adapter
 * 
 * Adapter for xAI's Grok API with Function Calling.
 * Grok uses an OpenAI-compatible API format with some extensions.
 * 
 * @example
 * ```typescript
 * import { GrokAdapter } from '@betterdata/commerce-gateway/grok';
 * 
 * const adapter = new GrokAdapter({
 *   apiKey: process.env.GROK_API_KEY!,
 *   backends: { products, cart, orders },
 *   tools: ['search_products', 'add_to_cart'],
 * });
 * 
 * const response = await adapter.handleRequest({
 *   messages: [{ role: 'user', content: 'Find premium headphones' }],
 * });
 * ```
 * 
 * @see https://docs.x.ai/
 * @license MIT
 */

import { BaseAdapter } from '../BaseAdapter';
import type {
  GrokAdapterConfig,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  GrokTool,
  StreamEvent,
  ToolContext,
} from '../types';

// ============================================================================
// Grok API Types (OpenAI-compatible)
// ============================================================================

interface GrokChatRequest {
  model: string;
  messages: GrokChatMessage[];
  tools?: GrokTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: GrokToolCall[];
  tool_call_id?: string;
}

interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  index?: number; // Present in streaming deltas
}

interface GrokChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: GrokChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GrokChatChoice {
  index: number;
  message: GrokChatMessage;
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | null;
}

interface GrokStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: GrokStreamChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GrokStreamChoice {
  index: number;
  delta: Partial<GrokChatMessage>;
  finish_reason: string | null;
}

// ============================================================================
// Grok Adapter
// ============================================================================

/**
 * Grok Function Calling Adapter
 * 
 * Handles chat completions with automatic tool execution using xAI's Grok API.
 * The API is largely OpenAI-compatible with some Grok-specific extensions.
 */
export class GrokAdapter extends BaseAdapter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: GrokAdapterConfig) {
    super(config);
    
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.x.ai/v1';
    this.defaultModel = config.model ?? 'grok-2';
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
    const tools = this.getGrokTools();

    // Make initial API call
    let response = await this.callGrok({
      model: request.model ?? this.defaultModel,
      messages: this.toGrokMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as GrokChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
    });

    // Handle tool calls iteratively
    let iterations = 0;
    const maxIterations = 10;

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
      const newMessages: GrokChatMessage[] = [
        ...this.toGrokMessages(messages),
        response.choices[0].message,
        ...toolResults,
      ];

      // Make follow-up API call
      response = await this.callGrok({
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
      throw new Error('No response choice returned from Grok');
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
    const tools = this.getGrokTools();

    // Emit start event
    yield {
      type: 'start',
      data: { id: this.generateId(), model: request.model ?? this.defaultModel },
    };

    // Make streaming API call
    const stream = await this.streamGrok({
      model: request.model ?? this.defaultModel,
      messages: this.toGrokMessages(messages),
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.toolChoice as GrokChatRequest['tool_choice'] ?? 'auto',
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      stream: true,
    });

    let fullMessage: ChatMessage = { role: 'assistant', content: '' };
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
        const pendingToolCalls = Array.from(toolCallBuilders.values()).map(b => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: b.arguments },
        }));

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
  // Grok API Calls
  // ============================================================================

  /**
   * Call Grok Chat Completions API
   */
  private async callGrok(request: GrokChatRequest): Promise<GrokChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`Grok API error: ${errorData.error?.message ?? response.statusText}`);
    }

    return response.json() as Promise<GrokChatResponse>;
  }

  /**
   * Stream Grok Chat Completions API
   */
  private async *streamGrok(
    request: GrokChatRequest
  ): AsyncGenerator<GrokStreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`Grok API error: ${errorData.error?.message ?? response.statusText}`);
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
            const chunk = JSON.parse(data) as GrokStreamChunk;
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
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  // ============================================================================
  // Tool Conversion
  // ============================================================================

  /**
   * Get tools in Grok format (OpenAI-compatible)
   */
  private getGrokTools(): GrokTool[] {
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
    toolCalls: GrokToolCall[],
    context: ToolContext
  ): Promise<GrokChatMessage[]> {
    const results: GrokChatMessage[] = [];

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
   * Convert internal messages to Grok format
   */
  private toGrokMessages(messages: ChatMessage[]): GrokChatMessage[] {
    return messages.map(msg => ({
      role: msg.role as GrokChatMessage['role'],
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
 * Create an Express/Hono handler for the Grok adapter
 */
export function createGrokHandler(adapter: GrokAdapter) {
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

