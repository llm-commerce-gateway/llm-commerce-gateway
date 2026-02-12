/**
 * @betterdata/llm-gateway - OpenAI Assistants API
 * 
 * Support for OpenAI's Assistants API with persistent threads and runs.
 * Provides a managed conversation experience with tool execution.
 * 
 * @example
 * ```typescript
 * import { OpenAIAssistantsClient } from '@betterdata/llm-gateway/openai';
 * 
 * const client = new OpenAIAssistantsClient({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   backends: { products, cart, orders },
 * });
 * 
 * // Create an assistant
 * const assistant = await client.createAssistant({
 *   name: 'Shopping Helper',
 *   instructions: 'Help users find and purchase products.',
 *   tools: ['search_products', 'add_to_cart'],
 * });
 * 
 * // Create a thread and run
 * const thread = await client.createThread();
 * const run = await client.createRun(thread.id, assistant.id, 'Find blue running shoes');
 * ```
 * 
 * @license MIT
 */

import type { GatewayBackends } from '../../backends/interfaces';
import type { SessionManager } from '../../session/SessionManager';
import { TOOL_SCHEMAS } from '../BaseAdapter';
import type { OpenAIFunction, JSONSchema } from '../types';
import { executeTool } from '../../mcp/tools/index';
import type { MCPToolContext } from '../../mcp/types';

// ============================================================================
// Types
// ============================================================================

export interface AssistantsConfig {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string;
  backends: GatewayBackends;
  session?: SessionManager;
  debug?: boolean;
}

export interface CreateAssistantOptions {
  name: string;
  instructions?: string;
  tools?: string[];
  model?: string;
  metadata?: Record<string, string>;
}

export interface Assistant {
  id: string;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: JSONSchema } }>;
  metadata?: Record<string, string>;
  createdAt: number;
}

export interface Thread {
  id: string;
  metadata?: Record<string, string>;
  createdAt: number;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: { value: string } }>;
  runId?: string;
  createdAt: number;
}

export interface Run {
  id: string;
  threadId: string;
  assistantId: string;
  status: 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled' | 'expired';
  requiredAction?: {
    type: 'submit_tool_outputs';
    submitToolOutputs: {
      toolCalls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
  };
  lastError?: { code: string; message: string };
  model: string;
  instructions?: string;
  createdAt: number;
  completedAt?: number;
}

// ============================================================================
// OpenAI Assistants Client
// ============================================================================

/**
 * Client for OpenAI's Assistants API.
 * Manages assistants, threads, messages, and runs with automatic tool execution.
 */
export class OpenAIAssistantsClient {
  private apiKey: string;
  private organizationId?: string;
  private baseUrl: string;
  private backends: GatewayBackends;
  private session?: SessionManager;
  private debug: boolean;

  constructor(config: AssistantsConfig) {
    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.backends = config.backends;
    this.session = config.session;
    this.debug = config.debug ?? false;
  }

  // ============================================================================
  // Assistant Management
  // ============================================================================

  /**
   * Create a new assistant with commerce tools
   */
  async createAssistant(options: CreateAssistantOptions): Promise<Assistant> {
    const tools = this.buildTools(options.tools ?? Object.keys(TOOL_SCHEMAS));

    const response = await this.request('POST', '/assistants', {
      name: options.name,
      instructions: options.instructions ?? this.getDefaultInstructions(),
      tools,
      model: options.model ?? 'gpt-4-turbo',
      metadata: options.metadata,
    });

    return this.mapAssistant(response);
  }

  /**
   * Get an existing assistant
   */
  async getAssistant(assistantId: string): Promise<Assistant | null> {
    try {
      const response = await this.request('GET', `/assistants/${assistantId}`);
      return this.mapAssistant(response);
    } catch {
      return null;
    }
  }

  /**
   * Update an assistant
   */
  async updateAssistant(
    assistantId: string,
    options: Partial<CreateAssistantOptions>
  ): Promise<Assistant> {
    const updateData: Record<string, unknown> = {};

    if (options.name) updateData.name = options.name;
    if (options.instructions) updateData.instructions = options.instructions;
    if (options.model) updateData.model = options.model;
    if (options.metadata) updateData.metadata = options.metadata;
    if (options.tools) updateData.tools = this.buildTools(options.tools);

    const response = await this.request('POST', `/assistants/${assistantId}`, updateData);
    return this.mapAssistant(response);
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    await this.request('DELETE', `/assistants/${assistantId}`);
  }

  /**
   * List assistants
   */
  async listAssistants(options?: {
    limit?: number;
    order?: 'asc' | 'desc';
  }): Promise<Assistant[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.order) params.set('order', options.order);

    const response = await this.request('GET', `/assistants?${params.toString()}`);
    return (response.data ?? []).map((a: unknown) => this.mapAssistant(a));
  }

  // ============================================================================
  // Thread Management
  // ============================================================================

  /**
   * Create a new conversation thread
   */
  async createThread(metadata?: Record<string, string>): Promise<Thread> {
    const response = await this.request('POST', '/threads', { metadata });
    return {
      id: response.id,
      metadata: response.metadata,
      createdAt: response.created_at,
    };
  }

  /**
   * Get an existing thread
   */
  async getThread(threadId: string): Promise<Thread | null> {
    try {
      const response = await this.request('GET', `/threads/${threadId}`);
      return {
        id: response.id,
        metadata: response.metadata,
        createdAt: response.created_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    await this.request('DELETE', `/threads/${threadId}`);
  }

  // ============================================================================
  // Message Management
  // ============================================================================

  /**
   * Add a message to a thread
   */
  async addMessage(
    threadId: string,
    content: string,
    metadata?: Record<string, string>
  ): Promise<Message> {
    const response = await this.request('POST', `/threads/${threadId}/messages`, {
      role: 'user',
      content,
      metadata,
    });

    return this.mapMessage(response);
  }

  /**
   * Get messages in a thread
   */
  async getMessages(
    threadId: string,
    options?: { limit?: number; order?: 'asc' | 'desc'; after?: string; before?: string }
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.order) params.set('order', options.order);
    if (options?.after) params.set('after', options.after);
    if (options?.before) params.set('before', options.before);

    const response = await this.request('GET', `/threads/${threadId}/messages?${params.toString()}`);
    return (response.data ?? []).map((m: unknown) => this.mapMessage(m));
  }

  // ============================================================================
  // Run Management
  // ============================================================================

  /**
   * Create a run and wait for completion with automatic tool execution
   */
  async createRun(
    threadId: string,
    assistantId: string,
    userMessage?: string,
    options?: {
      instructions?: string;
      maxToolIterations?: number;
      pollInterval?: number;
    }
  ): Promise<{ run: Run; messages: Message[] }> {
    // Add user message if provided
    if (userMessage) {
      await this.addMessage(threadId, userMessage);
    }

    // Create the run
    const response = await this.request('POST', `/threads/${threadId}/runs`, {
      assistant_id: assistantId,
      instructions: options?.instructions,
    });

    let run = this.mapRun(response);
    const maxIterations = options?.maxToolIterations ?? 10;
    const pollInterval = options?.pollInterval ?? 1000;
    let iterations = 0;

    // Poll for completion
    while (
      ['queued', 'in_progress', 'requires_action'].includes(run.status) &&
      iterations < maxIterations
    ) {
      if (run.status === 'requires_action' && run.requiredAction) {
        iterations++;
        this.log(`Handling tool calls (iteration ${iterations})`);
        
        // Execute tools
        const toolOutputs = await this.executeToolCalls(
          run.requiredAction.submitToolOutputs.toolCalls,
          threadId
        );

        // Submit tool outputs
        const submitResponse = await this.request(
          'POST',
          `/threads/${threadId}/runs/${run.id}/submit_tool_outputs`,
          { tool_outputs: toolOutputs }
        );
        run = this.mapRun(submitResponse);
      } else {
        // Wait and poll
        await this.sleep(pollInterval);
        run = await this.getRun(threadId, run.id);
      }
    }

    // Get final messages
    const messages = await this.getMessages(threadId, { order: 'asc' });

    return { run, messages };
  }

  /**
   * Get a run by ID
   */
  async getRun(threadId: string, runId: string): Promise<Run> {
    const response = await this.request('GET', `/threads/${threadId}/runs/${runId}`);
    return this.mapRun(response);
  }

  /**
   * Cancel a run
   */
  async cancelRun(threadId: string, runId: string): Promise<Run> {
    const response = await this.request('POST', `/threads/${threadId}/runs/${runId}/cancel`);
    return this.mapRun(response);
  }

  // ============================================================================
  // Tool Execution
  // ============================================================================

  /**
   * Execute tool calls from a run
   */
  private async executeToolCalls(
    toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>,
    threadId: string
  ): Promise<Array<{ tool_call_id: string; output: string }>> {
    const outputs: Array<{ tool_call_id: string; output: string }> = [];

    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      
      const context: MCPToolContext = {
        backends: this.backends,
        sessionId: threadId,
        session: this.session,
        debug: this.debug,
      };

      try {
        const result = await executeTool(toolCall.function.name, args, context);
        const output = result.content
          .filter(c => c.type === 'text')
          .map(c => (c as { type: 'text'; text: string }).text)
          .join('\n\n');

        outputs.push({
          tool_call_id: toolCall.id,
          output,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed';
        outputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify({ error: message }),
        });
      }
    }

    return outputs;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Build OpenAI function tools from enabled tool names
   */
  private buildTools(enabledTools: string[]): OpenAIFunction[] {
    return enabledTools
      .filter(name => TOOL_SCHEMAS[name])
      .map(name => {
        const schema = TOOL_SCHEMAS[name];
        if (!schema) {
          throw new Error(`Schema not found for tool: ${name}`);
        }
        return {
          type: 'function' as const,
          function: {
            name: schema.name,
            description: schema.description,
            parameters: schema.parameters,
          },
        };
      });
  }

  /**
   * Get default assistant instructions
   */
  private getDefaultInstructions(): string {
    return `You are a helpful shopping assistant for an e-commerce store.

Your capabilities:
- Search for products using natural language
- Get detailed product information
- Add items to shopping cart
- Check inventory availability
- Get personalized recommendations
- Help complete purchases

Guidelines:
- Be friendly, helpful, and concise
- Provide product details when asked
- Offer recommendations proactively
- Guide customers through checkout
- Use the available tools to fulfill requests`;
  }

  /**
   * Make an API request
   */
  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'assistants=v2',
    };

    if (this.organizationId) {
      headers['OpenAI-Organization'] = this.organizationId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`OpenAI API error: ${errorData.error?.message ?? response.statusText}`);
    }

    return response.json();
  }

  /**
   * Map API response to Assistant type
   */
  private mapAssistant(data: any): Assistant {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      model: data.model,
      instructions: data.instructions,
      tools: data.tools ?? [],
      metadata: data.metadata,
      createdAt: data.created_at,
    };
  }

  /**
   * Map API response to Message type
   */
  private mapMessage(data: any): Message {
    return {
      id: data.id,
      threadId: data.thread_id,
      role: data.role,
      content: data.content,
      runId: data.run_id,
      createdAt: data.created_at,
    };
  }

  /**
   * Map API response to Run type
   */
  private mapRun(data: any): Run {
    return {
      id: data.id,
      threadId: data.thread_id,
      assistantId: data.assistant_id,
      status: data.status,
      requiredAction: data.required_action,
      lastError: data.last_error,
      model: data.model,
      instructions: data.instructions,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[Assistants] ${message}`, data ?? '');
    }
  }
}

