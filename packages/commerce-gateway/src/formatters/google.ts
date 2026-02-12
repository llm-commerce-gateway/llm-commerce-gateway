import type { ToolDefinition, ToolResult, ToolError } from '../types/index';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ============================================================================
// Google Vertex AI / Gemini Tool Format
// https://cloud.google.com/vertex-ai/docs/generative-ai/multimodal/function-calling
// ============================================================================

/** Normalize error to structured format */
function normalizeError(error: string | ToolError | undefined): ToolError | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') {
    return { code: 'UNKNOWN_ERROR', message: error };
  }
  return error;
}

export interface GoogleTool {
  functionDeclarations: GoogleFunctionDeclaration[];
}

export interface GoogleFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, GoogleProperty>;
    required?: string[];
  };
}

export interface GoogleProperty {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  enum?: string[];
  items?: GoogleProperty;
  properties?: Record<string, GoogleProperty>;
  required?: string[];
}

export interface GoogleFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GoogleFunctionResponse {
  name: string;
  response: {
    content: unknown;
  };
}

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Convert JSON Schema type to Google's type format
 */
function convertType(jsonType: string): GoogleProperty['type'] {
  const typeMap: Record<string, GoogleProperty['type']> = {
    string: 'STRING',
    number: 'NUMBER',
    integer: 'INTEGER',
    boolean: 'BOOLEAN',
    array: 'ARRAY',
    object: 'OBJECT',
  };
  return typeMap[jsonType] ?? 'STRING';
}

/**
 * Convert JSON Schema property to Google property format
 */
function convertProperty(prop: Record<string, unknown>): GoogleProperty {
  const googleProp: GoogleProperty = {
    type: convertType(prop.type as string),
  };

  if (prop.description) {
    googleProp.description = prop.description as string;
  }

  if (prop.enum) {
    googleProp.enum = prop.enum as string[];
  }

  if (prop.items && googleProp.type === 'ARRAY') {
    googleProp.items = convertProperty(prop.items as Record<string, unknown>);
  }

  if (prop.properties && googleProp.type === 'OBJECT') {
    googleProp.properties = {};
    for (const [key, value] of Object.entries(prop.properties as Record<string, unknown>)) {
      googleProp.properties[key] = convertProperty(value as Record<string, unknown>);
    }
    if (prop.required) {
      googleProp.required = prop.required as string[];
    }
  }

  return googleProp;
}

// ============================================================================
// Format Tools for Google
// ============================================================================

/**
 * Convert internal tool definition to Google Vertex AI format
 */
export function formatToolForGoogle(tool: ToolDefinition<unknown, unknown>): GoogleFunctionDeclaration {
  const jsonSchema = zodToJsonSchema(tool.parameters, {
    target: 'openApi3',
    $refStrategy: 'none',
  });

  const schema = jsonSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };

  // Convert properties to Google format
  const googleProperties: Record<string, GoogleProperty> = {};
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      googleProperties[key] = convertProperty(value as Record<string, unknown>);
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'OBJECT',
      properties: googleProperties,
      required: schema.required,
    },
  };
}

/**
 * Convert multiple tools to Google format (wrapped in functionDeclarations)
 */
export function formatToolsForGoogle(
  tools: ToolDefinition<unknown, unknown>[]
): GoogleTool {
  return {
    functionDeclarations: tools.map(formatToolForGoogle),
  };
}

// ============================================================================
// Format Results for Google
// ============================================================================

/**
 * Format tool result for Google's expected response format
 */
export function formatResultForGoogle<T>(
  functionName: string,
  result: ToolResult<T>
): GoogleFunctionResponse {
  const error = normalizeError(result.error);
  return {
    name: functionName,
    response: {
      content: result.success
        ? result.data
        : {
            error: error?.code,
            message: error?.message,
            details: error?.details,
          },
    },
  };
}

/**
 * Format multiple results for Google
 */
export function formatResultsForGoogle<T>(
  results: Array<{ functionName: string; result: ToolResult<T> }>
): GoogleFunctionResponse[] {
  return results.map(({ functionName, result }) =>
    formatResultForGoogle(functionName, result)
  );
}

// ============================================================================
// Parse Google Function Calls
// ============================================================================

/**
 * Extract function calls from Google response
 */
export function parseGoogleFunctionCalls(
  functionCalls: GoogleFunctionCall[]
): Array<{
  name: string;
  input: Record<string, unknown>;
}> {
  return functionCalls.map((call) => ({
    name: call.name,
    input: call.args,
  }));
}

// ============================================================================
// Vertex AI Specific Configuration
// ============================================================================

export interface VertexAIConfig {
  projectId: string;
  location: string;
  modelId: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Create Vertex AI tool configuration
 */
export function createVertexAIToolConfig(
  tools: ToolDefinition<unknown, unknown>[],
  _config: Partial<VertexAIConfig> = {}
): {
  tools: GoogleTool[];
  toolConfig?: {
    functionCallingConfig: {
      mode: 'AUTO' | 'ANY' | 'NONE';
      allowedFunctionNames?: string[];
    };
  };
} {
  return {
    tools: [formatToolsForGoogle(tools)],
    toolConfig: {
      functionCallingConfig: {
        mode: 'AUTO',
        allowedFunctionNames: tools.map((t) => t.name),
      },
    },
  };
}

