/**
 * @betterdata/llm-gateway - Perplexity Adapter Types
 *
 * Type definitions for Perplexity API (OpenAI-compatible).
 *
 * @license MIT
 */

import type { BaseAdapterConfig } from '../types';

// ============================================================================
// Perplexity Configuration
// ============================================================================

export interface PerplexityAdapterConfig extends BaseAdapterConfig {
  /** Perplexity API key */
  apiKey: string;

  /** Base URL (default: https://api.perplexity.ai) */
  baseUrl?: string;

  /** Default model (default: sonar-pro) */
  model?: 'sonar' | 'sonar-pro' | 'sonar-reasoning' | string;

  /** Max tool iterations (default: 10) */
  maxToolIterations?: number;

  /** Return citations in response */
  returnCitations?: boolean;

  /** Return images in response */
  returnImages?: boolean;
}

// ============================================================================
// Perplexity-specific Response Extensions
// ============================================================================

export interface PerplexityCitation {
  url: string;
  text?: string;
}

export interface PerplexityImage {
  url: string;
  originUrl?: string;
}

export interface PerplexityResponseExtensions {
  citations?: PerplexityCitation[];
  images?: PerplexityImage[];
}
