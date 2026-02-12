import type { ToolDefinition, ToolResult, ToolError } from '../types/index';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ============================================================================
// Anthropic Claude Tool Format
// https://docs.anthropic.com/claude/docs/tool-use
// ============================================================================

/** Normalize error to structured format */
function normalizeError(error: string | ToolError | undefined): ToolError | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') {
    return { code: 'UNKNOWN_ERROR', message: error };
  }
  return error;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: 'text'; text: string }>;
  is_error?: boolean;
}

// ============================================================================
// Format Tools for Anthropic
// ============================================================================

/**
 * Convert internal tool definition to Anthropic format
 */
export function formatToolForAnthropic(tool: ToolDefinition<unknown, unknown>): AnthropicTool {
  const jsonSchema = zodToJsonSchema(tool.parameters, {
    target: 'openApi3',
    $refStrategy: 'none',
  });

  // Extract properties and required fields from the schema
  const schema = jsonSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required,
    },
  };
}

/**
 * Convert multiple tools to Anthropic format
 */
export function formatToolsForAnthropic(
  tools: ToolDefinition<unknown, unknown>[]
): AnthropicTool[] {
  return tools.map(formatToolForAnthropic);
}

// ============================================================================
// Format Results for Anthropic
// ============================================================================

/**
 * Format tool result for Anthropic's expected response format
 */
export function formatResultForAnthropic<T>(
  toolUseId: string,
  result: ToolResult<T>
): AnthropicToolResult {
  if (result.success) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify(result.data, null, 2),
    };
  }

  const error = normalizeError(result.error);
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: JSON.stringify({
      error: error?.code,
      message: error?.message,
      details: error?.details,
    }),
    is_error: true,
  };
}

/**
 * Format multiple results for Anthropic
 */
export function formatResultsForAnthropic<T>(
  results: Array<{ toolUseId: string; result: ToolResult<T> }>
): AnthropicToolResult[] {
  return results.map(({ toolUseId, result }) =>
    formatResultForAnthropic(toolUseId, result)
  );
}

// ============================================================================
// Parse Anthropic Tool Calls
// ============================================================================

/**
 * Extract tool calls from Anthropic response content
 */
export function parseAnthropicToolCalls(
  content: Array<{ type: string; [key: string]: unknown }>
): AnthropicToolUse[] {
  return content
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({
      type: 'tool_use' as const,
      id: block.id as string,
      name: block.name as string,
      input: block.input as Record<string, unknown>,
    }));
}

// ============================================================================
// MCP Server Format
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Convert internal tool definition to MCP format (for Claude Desktop)
 */
export function formatToolForMCP(tool: ToolDefinition<unknown, unknown>): MCPTool {
  const jsonSchema = zodToJsonSchema(tool.parameters, {
    target: 'openApi3',
    $refStrategy: 'none',
  });

  const schema = jsonSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required,
    },
  };
}

/**
 * Convert multiple tools to MCP format
 */
export function formatToolsForMCP(
  tools: ToolDefinition<unknown, unknown>[]
): MCPTool[] {
  return tools.map(formatToolForMCP);
}

