/**
 * @betterdata/commerce-gateway - Google Gemini Adapter
 *
 * Adapter for Google's Generative AI / Gemini API with function calling.
 * Supports Gemini 1.5 Pro, Gemini 1.5 Flash, and other models.
 *
 * @example
 * ```typescript
 * import { GeminiAdapter } from '@betterdata/commerce-gateway/adapters';
 *
 * const adapter = new GeminiAdapter({
 *   apiKey: process.env.GOOGLE_API_KEY!,
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
  GeminiAdapterConfig,
  GeminiContent,
  GeminiTextPart,
  GeminiFunctionCallPart,
  GeminiFunctionResponsePart,
  GeminiFunctionDeclaration,
  GeminiProperty,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
} from './types';

// ============================================================================
// Gemini Adapter
// ============================================================================

/**
 * Google Gemini Adapter
 *
 * Handles generateContent API with automatic function execution.
 */
export class GeminiAdapter extends BaseAdapter {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxToolIterations: number;

  constructor(config: GeminiAdapterConfig) {
    super(config);

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = config.model ?? 'gemini-1.5-pro';
    this.maxToolIterations = config.maxToolIterations ?? 10;
  }

  // ============================================================================
  // Main Request Handler
  // ============================================================================

  /**
   * Handle a generateContent request
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
    const tools = this.getGeminiTools();

    // Make initial API call
    let response = await this.callGemini(request.model ?? this.defaultModel, {
      contents: this.toGeminiContents(messages),
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      toolConfig: tools.length > 0 ? {
        functionCallingConfig: {
          mode: this.toGeminiToolMode(request.toolChoice),
          allowedFunctionNames: tools.map(t => t.name),
        },
      } : undefined,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
      },
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    });

    // Handle function calls iteratively
    let iterations = 0;
    const conversationContents = this.toGeminiContents(messages);

    while (iterations < this.maxToolIterations) {
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      // Check for function calls
      const functionCalls = candidate.content.parts.filter(
        (part): part is GeminiFunctionCallPart => 'functionCall' in part
      );

      if (functionCalls.length === 0) break;

      iterations++;
      this.log(`Processing function calls (iteration ${iterations})`);

      // Add model's response to conversation
      conversationContents.push(candidate.content);

      // Execute functions and collect responses
      const functionResponses: GeminiFunctionResponsePart[] = [];
      for (const fc of functionCalls) {
        const result = await this.executeTool(
          fc.functionCall.name,
          fc.functionCall.args,
          {
            sessionId,
            userId: request.userId,
            organizationId: request.organizationId,
            cart: this.getCart(sessionId),
            backends: this.config.backends,
          }
        );

        functionResponses.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: {
              content: result,
            },
          },
        });
      }

      // Add function responses to conversation
      conversationContents.push({
        role: 'user',
        parts: functionResponses,
      });

      // Make follow-up API call
      response = await this.callGemini(request.model ?? this.defaultModel, {
        contents: conversationContents,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
        toolConfig: tools.length > 0 ? {
          functionCallingConfig: {
            mode: 'AUTO',
            allowedFunctionNames: tools.map(t => t.name),
          },
        } : undefined,
        generationConfig: {
          temperature: request.temperature ?? this.config.temperature,
          maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
        },
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      });
    }

    // Build response
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error('No response candidate returned from Gemini');
    }

    const textContent = candidate.content.parts
      .filter((part): part is GeminiTextPart => 'text' in part)
      .map(part => part.text)
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
      id: this.generateId(),
      model: request.model ?? this.defaultModel,
      sessionId,
      usage: response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
      } : undefined,
      finishReason: this.mapFinishReason(candidate.finishReason),
    });
  }

  // ============================================================================
  // Streaming Handler
  // ============================================================================

  /**
   * Handle a streaming generateContent request
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
    const tools = this.getGeminiTools();

    // Emit start event
    yield {
      type: 'start',
      data: { id: this.generateId(), model: request.model ?? this.defaultModel },
    };

    // For now, use non-streaming and emit as single chunk
    const response = await this.callGemini(request.model ?? this.defaultModel, {
      contents: this.toGeminiContents(messages),
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      toolConfig: tools.length > 0 ? {
        functionCallingConfig: {
          mode: this.toGeminiToolMode(request.toolChoice),
          allowedFunctionNames: tools.map(t => t.name),
        },
      } : undefined,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens,
      },
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error('No response candidate returned from Gemini');
    }

    const textContent = candidate.content.parts
      .filter((part): part is GeminiTextPart => 'text' in part)
      .map(part => part.text)
      .join('\n');

    // Emit content as chunk
    yield {
      type: 'chunk',
      data: {
        id: this.generateId(),
        model: request.model ?? this.defaultModel,
        choices: [{
          index: 0,
          delta: { content: textContent },
          finishReason: this.mapFinishReason(candidate.finishReason),
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
        model: request.model ?? this.defaultModel,
        sessionId,
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
        } : undefined,
        finishReason: this.mapFinishReason(candidate.finishReason),
      }),
    };
  }

  // ============================================================================
  // Gemini API Calls
  // ============================================================================

  /**
   * Call Gemini generateContent API
   */
  private async callGemini(
    model: string,
    request: GeminiGenerateContentRequest
  ): Promise<GeminiGenerateContentResponse> {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { message: response.statusText },
      })) as { error?: { message?: string } };
      throw new Error(
        `Gemini API error: ${errorData.error?.message ?? response.statusText}`
      );
    }

    return response.json() as Promise<GeminiGenerateContentResponse>;
  }

  // ============================================================================
  // Tool Conversion
  // ============================================================================

  /**
   * Get tools in Gemini format
   */
  private getGeminiTools(): GeminiFunctionDeclaration[] {
    return this.listTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT' as const,
        properties: this.convertProperties(tool.parameters.properties ?? {}),
        required: tool.parameters.required,
      },
    }));
  }

  /**
   * Convert JSON Schema properties to Gemini format
   */
  private convertProperties(
    props: Record<string, unknown>
  ): Record<string, GeminiProperty> {
    const result: Record<string, GeminiProperty> = {};

    for (const [key, value] of Object.entries(props)) {
      const prop = value as Record<string, unknown>;
      result[key] = this.convertProperty(prop);
    }

    return result;
  }

  /**
   * Convert a single property to Gemini format
   */
  private convertProperty(prop: Record<string, unknown>): GeminiProperty {
    const typeMap: Record<string, GeminiProperty['type']> = {
      string: 'STRING',
      number: 'NUMBER',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      array: 'ARRAY',
      object: 'OBJECT',
    };

    const geminiProp: GeminiProperty = {
      type: typeMap[prop.type as string] ?? 'STRING',
    };

    if (prop.description) {
      geminiProp.description = prop.description as string;
    }

    if (prop.enum) {
      geminiProp.enum = prop.enum as string[];
    }

    if (prop.items && geminiProp.type === 'ARRAY') {
      geminiProp.items = this.convertProperty(prop.items as Record<string, unknown>);
    }

    if (prop.properties && geminiProp.type === 'OBJECT') {
      geminiProp.properties = this.convertProperties(
        prop.properties as Record<string, unknown>
      );
      if (prop.required) {
        geminiProp.required = prop.required as string[];
      }
    }

    return geminiProp;
  }

  /**
   * Convert tool choice to Gemini mode
   */
  private toGeminiToolMode(
    toolChoice?: LLMRequest['toolChoice']
  ): 'AUTO' | 'ANY' | 'NONE' {
    if (!toolChoice || toolChoice === 'auto') return 'AUTO';
    if (toolChoice === 'none') return 'NONE';
    if (toolChoice === 'required') return 'ANY';
    return 'AUTO';
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
   * Convert internal messages to Gemini format
   */
  private toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content ?? '' }],
      }));
  }

  /**
   * Map Gemini finish reason to standard finish reason
   */
  private mapFinishReason(finishReason: string): string {
    switch (finishReason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}

// ============================================================================
// Handler Helper
// ============================================================================

/**
 * Create an Express/Hono handler for the Gemini adapter
 */
export function createGeminiHandler(adapter: GeminiAdapter) {
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
