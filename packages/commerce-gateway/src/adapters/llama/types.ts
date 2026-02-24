/**
 * @betterdata/commerce-gateway - Llama Adapter Types
 *
 * Type definitions for Llama-compatible APIs (Together, Groq, local).
 *
 * @license MIT
 */

import type { BaseAdapterConfig } from '../types';

// ============================================================================
// Llama Configuration
// ============================================================================

export interface LlamaAdapterConfig extends BaseAdapterConfig {
  /** API key for the provider */
  apiKey: string;

  /**
   * Base URL for the API endpoint.
   * Common providers:
   * - Together AI: https://api.together.xyz/v1
   * - Groq: https://api.groq.com/openai/v1
   * - Local: http://localhost:8000/v1
   */
  baseUrl: string;

  /**
   * Default model.
   * Common models:
   * - Together: meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo
   * - Groq: llama-3.1-70b-versatile
   */
  model?: string;

  /** Provider name for logging/debugging */
  provider?: 'together' | 'groq' | 'local' | string;

  /** Max tool iterations (default: 10) */
  maxToolIterations?: number;

  /** Additional headers to send with requests */
  additionalHeaders?: Record<string, string>;
}

// ============================================================================
// Provider-Specific Extensions
// ============================================================================

export interface TogetherExtensions {
  /** Enable prompt caching (Together-specific) */
  promptCaching?: boolean;
}

export interface GroqExtensions {
  /** Enable JSON mode (Groq-specific) */
  responseFormat?: { type: 'json_object' };
}
