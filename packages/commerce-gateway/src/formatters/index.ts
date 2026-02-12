// Formatters barrel export
export * from './anthropic';
export * from './openai';
export * from './google';
export * from './grok';

import type { ToolDefinition, ToolResult, LLMProvider } from '../types/index';
import { formatToolsForAnthropic, formatResultForAnthropic } from './anthropic';
import { formatToolsForOpenAI, formatResultForOpenAI } from './openai';
import { formatToolsForGoogle, formatResultForGoogle } from './google';
import { formatToolsForGrok, formatResultForGrok } from './grok';

// ============================================================================
// Universal Formatter
// ============================================================================

/**
 * Format tools for any supported LLM provider
 */
export function formatToolsForProvider(
  tools: ToolDefinition<unknown, unknown>[],
  provider: LLMProvider
): unknown {
  switch (provider) {
    case 'anthropic':
      return formatToolsForAnthropic(tools);
    case 'openai':
      return formatToolsForOpenAI(tools);
    case 'google':
      return formatToolsForGoogle(tools);
    case 'grok':
      return formatToolsForGrok(tools);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Format a tool result for any supported LLM provider
 */
export function formatResultForProvider<T>(
  result: ToolResult<T>,
  provider: LLMProvider,
  callId: string,
  toolName?: string
): unknown {
  switch (provider) {
    case 'anthropic':
      return formatResultForAnthropic(callId, result);
    case 'openai':
      return formatResultForOpenAI(callId, result);
    case 'google':
      return formatResultForGoogle(toolName ?? 'unknown', result);
    case 'grok':
      return formatResultForGrok(callId, result);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Detect LLM provider from request headers or user agent
 */
export function detectProvider(headers: {
  'x-llm-provider'?: string;
  'user-agent'?: string;
}): LLMProvider | null {
  // Check explicit header first
  const explicit = headers['x-llm-provider']?.toLowerCase();
  if (explicit && isValidProvider(explicit)) {
    return explicit as LLMProvider;
  }

  // Try to detect from user agent
  const userAgent = headers['user-agent']?.toLowerCase() ?? '';
  
  if (userAgent.includes('anthropic') || userAgent.includes('claude')) {
    return 'anthropic';
  }
  if (userAgent.includes('openai') || userAgent.includes('chatgpt')) {
    return 'openai';
  }
  if (userAgent.includes('google') || userAgent.includes('vertex') || userAgent.includes('gemini')) {
    return 'google';
  }
  if (userAgent.includes('grok') || userAgent.includes('x.ai')) {
    return 'grok';
  }

  return null;
}

/**
 * Check if a string is a valid provider
 */
export function isValidProvider(provider: string): provider is LLMProvider {
  return ['anthropic', 'openai', 'google', 'grok'].includes(provider);
}

// ============================================================================
// MCP Format
// ============================================================================

/**
 * MCP Tool Definition format
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Format tools for Model Context Protocol (MCP)
 */
export function formatToolsForMCP(
  tools: ToolDefinition<unknown, unknown>[]
): MCPToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.parameters),
  }));
}

function zodToJsonSchema(schema: unknown): MCPToolDefinition['inputSchema'] {
  try {
    const { zodToJsonSchema: convert } = require('zod-to-json-schema');
    const result = convert(schema, { target: 'openApi3' });
    return result as MCPToolDefinition['inputSchema'];
  } catch {
    // Fallback when library isn't available
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }
}

// ============================================================================
// Response Transformation
// ============================================================================

/**
 * Transform gateway response to provider-specific format
 */
export function transformResponse<T>(
  data: T,
  provider: LLMProvider,
  options: {
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  } = {}
): unknown {
  const result: ToolResult<T> = {
    success: !options.isError,
    data: options.isError ? undefined : data,
    error: options.isError
      ? {
          code: 'ERROR',
          message: String(data),
        }
      : undefined,
  };

  return formatResultForProvider(
    result,
    provider,
    options.toolCallId ?? 'unknown',
    options.toolName
  );
}

