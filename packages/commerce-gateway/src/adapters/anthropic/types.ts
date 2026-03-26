/**
 * @betterdata/commerce-gateway - Anthropic Adapter Types
 *
 * Type definitions for Anthropic Claude API.
 *
 * @license Apache-2.0
 */

import type { BaseAdapterConfig } from '../types';

// ============================================================================
// Anthropic Configuration
// ============================================================================

export interface AnthropicAdapterConfig extends BaseAdapterConfig {
  /** Anthropic API key */
  apiKey: string;

  /** Base URL (default: https://api.anthropic.com) */
  baseUrl?: string;

  /** Default model (default: claude-3-5-sonnet-latest) */
  model?: string;

  /** Anthropic-Version header (default: 2023-06-01) */
  anthropicVersion?: string;

  /** Max tool iterations (default: 10) */
  maxToolIterations?: number;
}

// ============================================================================
// Anthropic API Types
// ============================================================================

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: 'text'; text: string }>;
  is_error?: boolean;
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

export interface AnthropicMessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  temperature?: number;
  stream?: boolean;
}

export type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };

export interface AnthropicMessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Streaming Types
// ============================================================================

export type AnthropicStreamEvent =
  | { type: 'message_start'; message: Partial<AnthropicMessagesResponse> }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'content_block_delta'; index: number; delta: AnthropicDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } };

export type AnthropicDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string };
