import type { ToolDefinition, ToolResult, ToolError } from '../types/index';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ============================================================================
// OpenAI Function Calling Format
// https://platform.openai.com/docs/guides/function-calling
// ============================================================================

/** Normalize error to structured format */
function normalizeError(error: string | ToolError | undefined): ToolError | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') {
    return { code: 'UNKNOWN_ERROR', message: error };
  }
  return error;
}

export interface OpenAITool {
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

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OpenAIToolResult {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

// ============================================================================
// Format Tools for OpenAI
// ============================================================================

/**
 * Convert internal tool definition to OpenAI function calling format
 */
export function formatToolForOpenAI(tool: ToolDefinition<unknown, unknown>): OpenAITool {
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
 * Convert multiple tools to OpenAI format
 */
export function formatToolsForOpenAI(
  tools: ToolDefinition<unknown, unknown>[]
): OpenAITool[] {
  return tools.map(formatToolForOpenAI);
}

// ============================================================================
// Format Results for OpenAI
// ============================================================================

/**
 * Format tool result for OpenAI's expected response format
 */
export function formatResultForOpenAI<T>(
  toolCallId: string,
  result: ToolResult<T>
): OpenAIToolResult {
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
 * Format multiple results for OpenAI
 */
export function formatResultsForOpenAI<T>(
  results: Array<{ toolCallId: string; result: ToolResult<T> }>
): OpenAIToolResult[] {
  return results.map(({ toolCallId, result }) =>
    formatResultForOpenAI(toolCallId, result)
  );
}

// ============================================================================
// Parse OpenAI Tool Calls
// ============================================================================

/**
 * Extract tool calls from OpenAI response
 */
export function parseOpenAIToolCalls(toolCalls: OpenAIToolCall[]): Array<{
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
// GPT Actions Format (for ChatGPT Plugins)
// ============================================================================

export interface GPTAction {
  operationId: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Convert tool to GPT Actions format for ChatGPT plugins
 */
export function formatToolForGPTAction(tool: ToolDefinition<unknown, unknown>): GPTAction {
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
    operationId: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required,
    },
  };
}

// ============================================================================
// OpenAI Assistants Format
// ============================================================================

export interface AssistantTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Convert tool to OpenAI Assistants format
 */
export function formatToolForAssistant(tool: ToolDefinition<unknown, unknown>): AssistantTool {
  const jsonSchema = zodToJsonSchema(tool.parameters, {
    target: 'openApi3',
    $refStrategy: 'none',
  });

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: jsonSchema as Record<string, unknown>,
    },
  };
}

