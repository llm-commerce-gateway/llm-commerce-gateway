/**
 * @betterdata/llm-gateway - Google Gemini Adapter Types
 *
 * Type definitions for Google Generative AI / Gemini API.
 *
 * @license MIT
 */

import type { BaseAdapterConfig } from '../types';

// ============================================================================
// Gemini Configuration
// ============================================================================

export interface GeminiAdapterConfig extends BaseAdapterConfig {
  /** Google API key */
  apiKey: string;

  /** Base URL (default: https://generativelanguage.googleapis.com/v1beta) */
  baseUrl?: string;

  /** Default model (default: gemini-1.5-pro) */
  model?: string;

  /** Max tool iterations (default: 10) */
  maxToolIterations?: number;
}

// ============================================================================
// Gemini API Types
// ============================================================================

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export type GeminiPart =
  | GeminiTextPart
  | GeminiFunctionCallPart
  | GeminiFunctionResponsePart;

export interface GeminiTextPart {
  text: string;
}

export interface GeminiFunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    name: string;
    response: {
      content: unknown;
    };
  };
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, GeminiProperty>;
    required?: string[];
  };
}

export interface GeminiProperty {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  enum?: string[];
  items?: GeminiProperty;
  properties?: Record<string, GeminiProperty>;
  required?: string[];
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig: {
      mode: 'AUTO' | 'ANY' | 'NONE';
      allowedFunctionNames?: string[];
    };
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  systemInstruction?: {
    parts: GeminiTextPart[];
  };
}

export interface GeminiGenerateContentResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface GeminiStreamChunk {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
