/**
 * @betterdata/commerce-gateway - Universal Tool Registry
 * 
 * Manages tool definitions that work across all LLM providers.
 * Tools are defined once and automatically converted to provider-specific formats.
 * 
 * @license Apache-2.0
 */

import { z } from 'zod';
import type {
  ToolHandler,
  ToolOptions,
  ToolContext,
  ToolResult,
  LLMProvider,
} from './types';

// ============================================================================
// JSON Schema Types (for LLM function calling)
// ============================================================================

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
  pattern?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique tool name (snake_case recommended) */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** Zod schema for input validation (optional if parameters provided) */
  inputSchema?: z.ZodType<TInput>;
  /** JSON Schema representation (auto-generated from Zod if not provided) */
  parameters?: JSONSchema;
  /** Tool execution handler */
  handler: ToolHandler<TInput, TOutput>;
  /** Tool options */
  options?: ToolOptions;
}

// ============================================================================
// Provider-Specific Formats
// ============================================================================

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

export interface OpenAIFunctionDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

export interface GrokToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface GoogleToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

// ============================================================================
// Tool Registry
// ============================================================================

class ToolRegistryClass {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a new tool
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is being overwritten`);
    }
    
    // Auto-generate JSON Schema from Zod if not provided
    if (!tool.parameters && tool.inputSchema) {
      tool.parameters = this.zodToJsonSchema(tool.inputSchema!);
    }
    
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool with input validation
   */
  async execute<TInput, TOutput>(
    name: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
      };
    }

    try {
      // Validate input
      const validatedInput = tool.inputSchema ? tool.inputSchema.parse(input) : input;
      
      // Custom validation if provided
      if (tool.options?.validate) {
        const validationResult = tool.options.validate(validatedInput);
        if (validationResult !== true) {
          return {
            success: false,
            error: typeof validationResult === 'string' 
              ? validationResult 
              : 'Validation failed',
          };
        }
      }
      
      // Execute handler
      const result = await tool.handler(validatedInput, context);
      return result as ToolResult<TOutput>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Input validation failed: ${error.errors.map(e => e.message).join(', ')}`,
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get tools formatted for a specific LLM provider
   */
  getForProvider(provider: LLMProvider): unknown[] {
    const tools = this.getAll();
    
    switch (provider) {
      case 'anthropic':
        return tools.map(tool => this.toAnthropicFormat(tool));
      case 'openai':
        return tools.map(tool => this.toOpenAIFormat(tool));
      case 'grok':
        return tools.map(tool => this.toGrokFormat(tool));
      case 'google':
        return tools.map(tool => this.toGoogleFormat(tool));
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Convert tool to Anthropic MCP format
   */
  toAnthropicFormat(tool: ToolDefinition): AnthropicToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters ?? { type: 'object', properties: {} },
    };
  }

  /**
   * Convert tool to OpenAI function format
   */
  toOpenAIFormat(tool: ToolDefinition): OpenAIFunctionDefinition {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      },
    };
  }

  /**
   * Convert tool to Grok format
   */
  toGrokFormat(tool: ToolDefinition): GrokToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters ?? { type: 'object', properties: {} },
    };
  }

  /**
   * Convert tool to Google Vertex AI format
   */
  toGoogleFormat(tool: ToolDefinition): GoogleToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters ?? { type: 'object', properties: {} },
    };
  }

  /**
   * Convert Zod schema to JSON Schema
   * Note: This is a simplified implementation. For complex schemas,
   * consider using zod-to-json-schema library.
   */
  private zodToJsonSchema(schema: z.ZodType): JSONSchema {
    // Handle ZodObject
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToJsonSchema(value as z.ZodType);
        
        // Check if field is required (not optional)
        if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        description: schema.description,
      };
    }

    // Handle ZodArray
    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJsonSchema(schema.element),
        description: schema.description,
      };
    }

    // Handle ZodString
    if (schema instanceof z.ZodString) {
      return {
        type: 'string',
        description: schema.description,
      };
    }

    // Handle ZodNumber
    if (schema instanceof z.ZodNumber) {
      return {
        type: 'number',
        description: schema.description,
      };
    }

    // Handle ZodBoolean
    if (schema instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description: schema.description,
      };
    }

    // Handle ZodEnum
    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options,
        description: schema.description,
      };
    }

    // Handle ZodOptional (unwrap and recurse)
    if (schema instanceof z.ZodOptional) {
      return this.zodToJsonSchema(schema.unwrap());
    }

    // Handle ZodDefault (unwrap and recurse)
    if (schema instanceof z.ZodDefault) {
      const inner = this.zodToJsonSchema(schema.removeDefault());
      return {
        ...inner,
        default: schema._def.defaultValue(),
      };
    }

    // Handle ZodNullable
    if (schema instanceof z.ZodNullable) {
      return this.zodToJsonSchema(schema.unwrap());
    }

    // Default fallback
    return {
      type: 'object',
      description: schema.description,
    };
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Export singleton instance
export const ToolRegistry = new ToolRegistryClass();

// Export for creating new instances (useful for testing)
export { ToolRegistryClass };

// ============================================================================
// Helper function to create tools
// ============================================================================

/**
 * Helper function to create and register a tool
 * 
 * @example
 * ```typescript
 * const searchTool = createTool({
 *   name: 'search_products',
 *   description: 'Search for products',
 *   inputSchema: z.object({
 *     query: z.string(),
 *     limit: z.number().optional(),
 *   }),
 *   handler: async (input, context) => {
 *     const results = await context.backends.products.searchProducts(input.query);
 *     return { success: true, data: results };
 *   },
 * });
 * ```
 */
export function createTool<TInput, TOutput>(
  definition: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  ToolRegistry.register(definition);
  return definition;
}

