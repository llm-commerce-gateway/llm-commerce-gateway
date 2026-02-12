import type { z } from 'zod';
import type { ToolContext, ToolResult, ToolDefinition } from '../types/index';
import { ToolSchemas, type ToolName } from './schemas';

// ============================================================================
// Tool Registry - Central registration and lookup for all tools
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, ToolDefinition<unknown, unknown>> = new Map();
  private static instance: ToolRegistry;

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Register a tool with the registry
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered. Overwriting...`);
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  /**
   * Get a tool by name
   */
  get<TInput = unknown, TOutput = unknown>(name: string): ToolDefinition<TInput, TOutput> | undefined {
    return this.tools.get(name) as ToolDefinition<TInput, TOutput> | undefined;
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition<unknown, unknown>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool with validation and error handling
   */
  async execute<TInput, TOutput>(
    name: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const startTime = Date.now();
    const tool = this.get<TInput, TOutput>(name);

    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${name}" is not registered`,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cached: false,
          version: '1.0.0',
        },
      };
    }

    try {
      // Validate input against schema
      const validatedInput = tool.parameters.parse(input);

      // Execute the tool handler
      const result = await tool.handler(validatedInput, context);

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cached: false,
          version: '1.0.0',
        },
      };
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input parameters',
            details: error,
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            cached: false,
            version: '1.0.0',
          },
        };
      }

      // Handle other errors
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error,
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cached: false,
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get tool definitions for a specific LLM provider format
   */
  getToolDefinitionsForProvider(provider: 'anthropic' | 'openai' | 'google' | 'grok'): unknown[] {
    const tools = this.getAllTools();

    switch (provider) {
      case 'anthropic':
        return tools.map((tool) => this.formatForAnthropic(tool));
      case 'openai':
      case 'grok': // Grok uses OpenAI-compatible format
        return tools.map((tool) => this.formatForOpenAI(tool));
      case 'google':
        return tools.map((tool) => this.formatForGoogle(tool));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private formatForAnthropic(tool: ToolDefinition<unknown, unknown>): object {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: this.zodToJsonSchema(tool.parameters),
    };
  }

  private formatForOpenAI(tool: ToolDefinition<unknown, unknown>): object {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    };
  }

  private formatForGoogle(tool: ToolDefinition<unknown, unknown>): object {
    return {
      name: tool.name,
      description: tool.description,
      parameters: this.zodToJsonSchema(tool.parameters),
    };
  }

  private zodToJsonSchema(schema: z.ZodSchema<unknown>): object {
    // Use zod-to-json-schema for proper conversion
    // This is a simplified version - in production, use the library
    try {
      const { zodToJsonSchema } = require('zod-to-json-schema');
      return zodToJsonSchema(schema, { target: 'openApi3' });
    } catch {
      // Fallback for when the library isn't available
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }
  }
}

// ============================================================================
// Tool Registration Helper
// ============================================================================

export function createTool<TInput, TOutput>(
  name: ToolName,
  description: string,
  handler: (input: TInput, context: ToolContext) => Promise<TOutput>,
  options?: {
    requiresAuth?: boolean;
    rateLimit?: { requests: number; windowMs: number };
  }
): ToolDefinition<TInput, TOutput> {
  const schema = ToolSchemas[name];
  if (!schema) {
    throw new Error(`No schema found for tool: ${name}`);
  }

  return {
    name,
    description,
    parameters: schema.input as unknown as z.ZodSchema<TInput>,
    handler,
    requiresAuth: options?.requiresAuth,
    rateLimit: options?.rateLimit,
  };
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const toolRegistry = ToolRegistry.getInstance();

