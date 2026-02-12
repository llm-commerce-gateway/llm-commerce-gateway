/**
 * @betterdata/llm-gateway - Anthropic Claude Adapter
 *
 * Adapter for Anthropic's Messages API with tool use support.
 * Provides integration with Claude 3.5 Sonnet, Claude 3 Opus, and other models.
 *
 * @example
 * ```typescript
 * import { AnthropicAdapter } from '@betterdata/llm-gateway/adapters';
 *
 * const adapter = new AnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
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
} from '../types';
import type {
  AnthropicAdapterConfig,
  AnthropicMessage,
  AnthropicTool,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicToolChoice,
} from './types';

// ============================================================================
// Anthropic Adapter
// ============================================================================

/**
 * Anthropic Claude Adapter
 *
 * Handles messages API with automatic tool execution.
 */
export class AnthropicAdapter extends BaseAdapter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private anthropicVersion: string;
  private maxToolIterations: number;

  constructor(config: AnthropicAdapterConfig) {
    super(config);

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
    this.defaultModel = config.model ?? 'claude-3-5-sonnet-latest';
    this.anthropicVersion = config.anthropicVersion ?? '2023-06-01';
    this.maxToolIterations = config.maxToolIterations ?? 10;
  }

  // ============================================================================
  // Main Request Handler
  // ============================================================================

  /**
   * Handle a messages request
   */
  async handleRequest(request: LLMRequest): Promise<LLMResponse> {
    const sessionId = request.sessionId ?? this.generateId('session');
    const session = await this.getOrCreateSession(sessionId, {
      userId: request.userId,
      organizationId: request.organizationId,
    });

    // Build messages and extract system prompt
    const allMessages = this.buildMessages(request, session);
    const { systemPrompt, messages } = this.separateSystemPrompt(allMessages);

    // Get tools
    const tools = this.getAnthropicTools();

    // Make initial API call
    let response = await this.callAnthropic({
      model: request.model ?? this.defaultModel,
      messages: this.toAnthropicMessages(messages),
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: this.toAnthropicToolChoice(request.toolChoice),
      temperature: request.temperature ?? this.config.temperature,
    });

    // Handle tool calls iteratively
    let iterations = 0;
    const conversationMessages = this.toAnthropicMessages(messages);

    while (
      response.stop_reason === 'tool_use' &&
      iterations < this.maxToolIterations
    ) {
      iterations++;
      this.log(`Processing tool calls (iteration ${iterations})`);

      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is AnthropicToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) break;

      // Add assistant's response to conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute tools and collect results
      const toolResults: AnthropicToolResultBlock[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await this.executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          {
            sessionId,
            userId: request.userId,
            organizationId: request.organizationId,
            cart: this.getCart(sessionId),
            backends: this.config.backends,
          }
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add tool results to conversation
      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });

      // Make follow-up API call
      response = await this.callAnthropic({
        model: request.model ?? this.defaultModel,
        messages: conversationMessages,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        system: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: { type: 'auto' },
        temperature: request.temperature ?? this.config.temperature,
      });
    }

    // Build response
    const textContent = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: textContent,
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
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(response.stop_reason),
    });
  }

  // ============================================================================
  // Streaming Handler
  // ============================================================================

  /**
   * Handle a streaming messages request
   */
  async *handleStreamingRequest(
    request: LLMRequest
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const sessionId = request.sessionId ?? this.generateId('session');
    const session = await this.getOrCreateSession(sessionId, {
      userId: request.userId,
      organizationId: request.organizationId,
    });

    const allMessages = this.buildMessages(request, session);
    const { systemPrompt, messages } = this.separateSystemPrompt(allMessages);
    const tools = this.getAnthropicTools();

    // Emit start event
    yield {
      type: 'start',
      data: { id: this.generateId(), model: request.model ?? this.defaultModel },
    };

    // For now, use non-streaming and emit as single chunk
    // Full streaming implementation would use SSE parsing
    const response = await this.callAnthropic({
      model: request.model ?? this.defaultModel,
      messages: this.toAnthropicMessages(messages),
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: this.toAnthropicToolChoice(request.toolChoice),
      temperature: request.temperature ?? this.config.temperature,
    });

    const textContent = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Emit content as chunk
    yield {
      type: 'chunk',
      data: {
        id: response.id,
        model: response.model,
        choices: [{
          index: 0,
          delta: { content: textContent },
          finishReason: this.mapFinishReason(response.stop_reason),
        }],
      },
    };

    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: textContent,
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
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        },
        finishReason: this.mapFinishReason(response.stop_reason),
      }),
    };
  }

  // ============================================================================
  // Anthropic API Calls
  // ============================================================================

  /**
   * Call Anthropic Messages API
   */
  private async callAnthropic(
    request: AnthropicMessagesRequest
  ): Promise<AnthropicMessagesResponse> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { message: response.statusText },
      })) as { error?: { message?: string } };
      throw new Error(
        `Anthropic API error: ${errorData.error?.message ?? response.statusText}`
      );
    }

    return response.json() as Promise<AnthropicMessagesResponse>;
  }

  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion,
    };
  }

  // ============================================================================
  // Tool Conversion
  // ============================================================================

  /**
   * Get tools in Anthropic format
   */
  private getAnthropicTools(): AnthropicTool[] {
    return this.listTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties ?? {},
        required: tool.parameters.required,
      },
    }));
  }

  /**
   * Convert tool choice to Anthropic format
   */
  private toAnthropicToolChoice(
    toolChoice?: LLMRequest['toolChoice']
  ): AnthropicToolChoice | undefined {
    if (!toolChoice) return undefined;
    if (toolChoice === 'auto') return { type: 'auto' };
    if (toolChoice === 'none') return undefined;
    if (toolChoice === 'required') return { type: 'any' };
    if (typeof toolChoice === 'object' && toolChoice.function) {
      return { type: 'tool', name: toolChoice.function.name };
    }
    return { type: 'auto' };
  }

  // ============================================================================
  // Message Conversion
  // ============================================================================

  /**
   * Separate system prompt from messages
   */
  private separateSystemPrompt(messages: ChatMessage[]): {
    systemPrompt?: string;
    messages: ChatMessage[];
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const systemPrompt = systemMessages.length > 0
      ? systemMessages.map(m => m.content).join('\n\n')
      : undefined;

    return { systemPrompt: systemPrompt ?? undefined, messages: otherMessages };
  }

  /**
   * Convert internal messages to Anthropic format
   */
  private toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content ?? '',
      }));
  }

  /**
   * Map Anthropic stop reason to standard finish reason
   */
  private mapFinishReason(
    stopReason: AnthropicMessagesResponse['stop_reason']
  ): string {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}

// ============================================================================
// Handler Helper
// ============================================================================

/**
 * Create an Express/Hono handler for the Anthropic adapter
 */
export function createAnthropicHandler(adapter: AnthropicAdapter) {
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
