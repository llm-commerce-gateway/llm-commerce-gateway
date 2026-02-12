import type { ToolDefinition, ToolResult, ToolError } from '../types/index';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ============================================================================
// Grok (xAI) Tool Format
// Grok uses OpenAI-compatible function calling format
// https://docs.x.ai/docs
// ============================================================================

/** Normalize error to structured format */
function normalizeError(error: string | ToolError | undefined): ToolError | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') {
    return { code: 'UNKNOWN_ERROR', message: error };
  }
  return error;
}

export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GrokToolResult {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

// ============================================================================
// Format Tools for Grok
// ============================================================================

/**
 * Convert internal tool definition to Grok format
 * Grok uses OpenAI-compatible format with some extensions
 */
export function formatToolForGrok(tool: ToolDefinition<unknown, unknown>): GrokTool {
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
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: schema.properties ?? {},
        required: schema.required,
      },
    },
  };
}

/**
 * Convert multiple tools to Grok format
 */
export function formatToolsForGrok(
  tools: ToolDefinition<unknown, unknown>[]
): GrokTool[] {
  return tools.map(formatToolForGrok);
}

// ============================================================================
// Format Results for Grok
// ============================================================================

/**
 * Format tool result for Grok's expected response format
 */
export function formatResultForGrok<T>(
  toolCallId: string,
  result: ToolResult<T>
): GrokToolResult {
  const error = normalizeError(result.error);
  const content = result.success
    ? JSON.stringify(result.data)
    : JSON.stringify({
        error: error?.code,
        message: error?.message,
        details: error?.details,
      });

  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content,
  };
}

/**
 * Format multiple results for Grok
 */
export function formatResultsForGrok<T>(
  results: Array<{ toolCallId: string; result: ToolResult<T> }>
): GrokToolResult[] {
  return results.map(({ toolCallId, result }) =>
    formatResultForGrok(toolCallId, result)
  );
}

// ============================================================================
// Parse Grok Tool Calls
// ============================================================================

/**
 * Extract tool calls from Grok response
 */
export function parseGrokToolCalls(toolCalls: GrokToolCall[]): Array<{
  id: string;
  name: string;
  input: Record<string, unknown>;
}> {
  return toolCalls.map((call) => ({
    id: call.id,
    name: call.function.name,
    input: JSON.parse(call.function.arguments),
  }));
}

// ============================================================================
// Grok-Specific Features
// ============================================================================

/**
 * Grok supports real-time data access
 * This helper adds metadata for real-time enabled tools
 */
export function addGrokRealTimeMetadata(tool: GrokTool): GrokTool & { x_realtime?: boolean } {
  // Tools that benefit from Grok's real-time capabilities
  const realTimeTools = ['search_products', 'check_inventory', 'get_recommendations'];
  
  return {
    ...tool,
    x_realtime: realTimeTools.includes(tool.function.name),
  };
}

/**
 * Format tools for Grok with real-time metadata
 */
export function formatToolsForGrokWithRealTime(
  tools: ToolDefinition<unknown, unknown>[]
): Array<GrokTool & { x_realtime?: boolean }> {
  return tools.map((tool) => addGrokRealTimeMetadata(formatToolForGrok(tool)));
}

