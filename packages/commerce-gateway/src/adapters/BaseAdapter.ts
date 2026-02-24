/**
 * @betterdata/commerce-gateway - Base Adapter
 * 
 * Shared logic for all LLM adapters.
 * Provides tool execution, session management, and response formatting.
 * 
 * @license MIT
 */

import type {
  LLMAdapter,
  BaseAdapterConfig,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  AdapterToolDefinition,
  AdapterSession,
  ToolContext,
} from './types';
import type { Cart } from '../backends/interfaces';
import { executeTool } from '../mcp/tools/index';
import type { MCPToolContext, MCPToolResult } from '../mcp/types';

// ============================================================================
// Built-in Tool Schemas
// ============================================================================

const TOOL_SCHEMAS: Record<string, AdapterToolDefinition> = {
  search_products: {
    name: 'search_products',
    description: `Search for products using natural language queries.
Supports filtering by category, price range, tags, and availability.
Returns product details including pricing, images, and stock status.
Use this when customers ask about finding products or browsing the catalog.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query for products',
        },
        filters: {
          type: 'object',
          description: 'Optional search filters',
          properties: {
            category: { type: 'string', description: 'Filter by category' },
            priceMin: { type: 'number', description: 'Minimum price' },
            priceMax: { type: 'number', description: 'Maximum price' },
            inStock: { type: 'boolean', description: 'Only show in-stock items' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
            },
          },
        },
        limit: {
          type: 'number',
          description: 'Number of results (default: 10, max: 20)',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  
  get_product_details: {
    name: 'get_product_details',
    description: `Get detailed information about a specific product.
Returns full product details including variants, pricing, images, and availability.
Use this when a customer wants to learn more about a specific product.`,
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID to get details for',
        },
      },
      required: ['productId'],
    },
  },
  
  add_to_cart: {
    name: 'add_to_cart',
    description: `Add a product to the shopping cart.
Supports specifying quantity and variant selection.
Returns updated cart totals and contents.
Use this when customers want to buy or save a product.`,
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID to add',
        },
        variantId: {
          type: 'string',
          description: 'Variant ID if applicable',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (default: 1)',
          minimum: 1,
          maximum: 99,
          default: 1,
        },
      },
      required: ['productId'],
    },
  },
  
  check_inventory: {
    name: 'check_inventory',
    description: `Check real-time inventory availability for a product.
Returns quantity available and location-specific stock levels.
Use this when customers ask about availability or shipping times.`,
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID to check',
        },
        variantId: {
          type: 'string',
          description: 'Variant ID if applicable',
        },
        locationId: {
          type: 'string',
          description: 'Specific location to check',
        },
      },
      required: ['productId'],
    },
  },
  
  get_recommendations: {
    name: 'get_recommendations',
    description: `Get personalized product recommendations.
Supports multiple strategies: similar, complementary, trending, bundle, and personalized.
Use this when customers need suggestions or want to discover products.`,
    parameters: {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Products to base recommendations on',
        },
        strategy: {
          type: 'string',
          enum: ['similar', 'complementary', 'trending', 'personalized', 'bundle'],
          description: 'Recommendation strategy',
          default: 'personalized',
        },
        limit: {
          type: 'number',
          description: 'Number of recommendations (default: 5)',
          minimum: 1,
          maximum: 10,
          default: 5,
        },
      },
    },
  },
  
  create_order: {
    name: 'create_order',
    description: `Create an order from the current cart.
Requires shipping address and payment method.
Returns order confirmation with number and estimated delivery.
Use this when customers are ready to complete their purchase.`,
    parameters: {
      type: 'object',
      properties: {
        shippingAddress: {
          type: 'object',
          description: 'Shipping address',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            address1: { type: 'string' },
            address2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['firstName', 'lastName', 'address1', 'city', 'state', 'postalCode', 'country'],
        },
        billingAddress: {
          type: 'object',
          description: 'Billing address (uses shipping if not provided)',
        },
        paymentMethod: {
          type: 'string',
          enum: ['credit_card', 'paypal', 'apple_pay', 'google_pay', 'affirm', 'klarna'],
          description: 'Payment method',
          default: 'credit_card',
        },
      },
      required: ['shippingAddress'],
    },
  },
};

// ============================================================================
// Base Adapter Class
// ============================================================================

/**
 * Base adapter providing shared functionality for all LLM adapters.
 * Extend this class to create platform-specific adapters.
 */
export abstract class BaseAdapter implements LLMAdapter {
  protected config: Required<BaseAdapterConfig>;
  protected enabledTools: string[];
  protected sessions: Map<string, AdapterSession> = new Map();
  protected carts: Map<string, Cart> = new Map();

  constructor(config: BaseAdapterConfig) {
    this.config = {
      backends: config.backends,
      session: config.session,
      tools: config.tools ?? Object.keys(TOOL_SCHEMAS),
      model: config.model ?? 'default',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      systemPrompt: config.systemPrompt ?? this.getDefaultSystemPrompt(),
      debug: config.debug ?? false,
    } as Required<BaseAdapterConfig>;

    this.enabledTools = this.config.tools.filter(t => TOOL_SCHEMAS[t]);
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  abstract handleRequest(request: LLMRequest): Promise<LLMResponse>;

  // ============================================================================
  // Tool Management
  // ============================================================================

  /**
   * Get list of enabled tools
   */
  listTools(): AdapterToolDefinition[] {
    return this.enabledTools
      .map(name => TOOL_SCHEMAS[name])
      .filter((tool): tool is AdapterToolDefinition => tool !== undefined);
  }

  /**
   * Get tool schema by name
   */
  protected getToolSchema(name: string): AdapterToolDefinition | undefined {
    if (!this.enabledTools.includes(name)) return undefined;
    return TOOL_SCHEMAS[name];
  }

  /**
   * Execute a tool and return the result as a string
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<string> {
    if (!this.enabledTools.includes(name)) {
      return JSON.stringify({ error: `Tool "${name}" is not enabled` });
    }

    this.log(`Executing tool: ${name}`, args);

    // Build MCP-compatible context
    const mcpContext: MCPToolContext = {
      backends: context.backends,
      sessionId: context.sessionId,
      session: this.config.session,
      cart: context.cart,
      userId: context.userId,
      organizationId: context.organizationId,
      debug: this.config.debug,
    };

    try {
      // Use the MCP tool execution
      const result = await executeTool(name, args, mcpContext);
      
      // Update cart if changed
      if (mcpContext.cart) {
        this.carts.set(context.sessionId, mcpContext.cart);
      }

      // Format result for LLM
      return this.formatToolResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      this.log(`Tool error: ${message}`);
      return JSON.stringify({ error: message });
    }
  }

  /**
   * Format tool result for LLM consumption
   */
  protected formatToolResult(result: MCPToolResult): string {
    // Extract text content from MCP result
    const textContent = result.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('\n\n');

    if (result.isError) {
      return JSON.stringify({ error: textContent });
    }

    return textContent;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AdapterSession | null> {
    // Check in-memory cache first
    let session = this.sessions.get(sessionId);
    
    // Try persistent storage
    if (!session && this.config.session) {
      const stored = await this.config.session.get(sessionId);
      if (stored) {
        // Convert SessionData to AdapterSession
        session = {
          id: stored.id,
          messages: stored.conversationHistory?.map(m => ({
            role: m.role as AdapterSession['messages'][0]['role'],
            content: m.content,
          })) ?? [],
          cart: undefined,
          userId: stored.userId,
          organizationId: undefined,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
          metadata: stored.metadata,
        };
        this.sessions.set(sessionId, session);
      }
    }

    return session ?? null;
  }

  /**
   * Save session
   */
  async saveSession(session: AdapterSession): Promise<void> {
    session.updatedAt = new Date();
    this.sessions.set(session.id, session);

    // Persist if session manager available
    if (this.config.session) {
      // Convert AdapterSession to SessionManager format
      await this.config.session.update(session.id, {
        metadata: {
          ...session.metadata,
          adapterMessages: session.messages,
        },
      });
    }
  }

  /**
   * Create new session
   */
  protected async createSession(
    sessionId: string,
    options?: { userId?: string; organizationId?: string }
  ): Promise<AdapterSession> {
    const session: AdapterSession = {
      id: sessionId,
      messages: [],
      userId: options?.userId,
      organizationId: options?.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Get or create session
   */
  protected async getOrCreateSession(
    sessionId: string,
    options?: { userId?: string; organizationId?: string }
  ): Promise<AdapterSession> {
    const existing = await this.getSession(sessionId);
    if (existing) return existing;
    return this.createSession(sessionId, options);
  }

  /**
   * Get cart for session
   */
  protected getCart(sessionId: string): Cart | undefined {
    return this.carts.get(sessionId);
  }

  // ============================================================================
  // Message Building
  // ============================================================================

  /**
   * Get default system prompt
   */
  protected getDefaultSystemPrompt(): string {
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
- Use the available tools to fulfill requests
- Format responses in a readable way`;
  }

  /**
   * Build messages array with system prompt
   */
  protected buildMessages(
    request: LLMRequest,
    session?: AdapterSession
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system prompt if not already present
    const hasSystemMessage = request.messages.some(m => m.role === 'system');
    if (!hasSystemMessage && this.config.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // Add session history
    if (session?.messages) {
      messages.push(...session.messages);
    }

    // Add request messages
    messages.push(...request.messages);

    return messages;
  }

  // ============================================================================
  // Response Building
  // ============================================================================

  /**
   * Generate a unique response ID
   */
  protected generateId(prefix: string = 'chatcmpl'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build a standard response
   */
  protected buildResponse(
    message: ChatMessage,
    options: {
      id?: string;
      model: string;
      sessionId?: string;
      usage?: { promptTokens: number; completionTokens: number };
      finishReason?: string;
    }
  ): LLMResponse {
    return {
      id: options.id ?? this.generateId(),
      model: options.model,
      choices: [
        {
          index: 0,
          message,
          finishReason: options.finishReason ?? 'stop',
        },
      ],
      usage: options.usage
        ? {
            promptTokens: options.usage.promptTokens,
            completionTokens: options.usage.completionTokens,
            totalTokens: options.usage.promptTokens + options.usage.completionTokens,
          }
        : undefined,
      sessionId: options.sessionId,
      cart: options.sessionId ? this.getCart(options.sessionId) : undefined,
      finishReason: (options.finishReason as LLMResponse['finishReason']) ?? 'stop',
    };
  }

  // ============================================================================
  // Logging
  // ============================================================================

  protected log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[Adapter] ${message}`, data ?? '');
    }
  }

  protected logError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Adapter Error] ${message}: ${errorMessage}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

export { TOOL_SCHEMAS };

