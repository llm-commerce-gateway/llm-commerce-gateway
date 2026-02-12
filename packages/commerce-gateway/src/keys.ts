import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Environment configuration for LLM Gateway
 */
export const keys = () =>
  createEnv({
    server: {
      // Redis for rate limiting and caching
      UPSTASH_REDIS_REST_URL: z.string().url().optional(),
      UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

      // Google Cloud / Vertex AI
      GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
      GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
      GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
      VERTEX_AI_MODEL: z.string().default('gemini-1.5-pro'),

      // OpenAI (for comparison/fallback)
      OPENAI_API_KEY: z.string().min(1).optional(),
      OPENAI_MODEL: z.string().default('gpt-4-turbo'),

      // Anthropic (for MCP server)
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
      ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

      // Grok/xAI
      GROK_API_KEY: z.string().min(1).optional(),
      GROK_MODEL: z.string().default('grok-2'),

      // Gateway configuration
      LLM_GATEWAY_PORT: z.coerce.number().default(3100),
      LLM_GATEWAY_HOST: z.string().default('0.0.0.0'),
      LLM_GATEWAY_BASE_URL: z.string().url().optional(),

      // API key for gateway authentication
      LLM_GATEWAY_API_KEY: z.string().min(1).optional(),

      // Vector store (Pinecone)
      PINECONE_API_KEY: z.string().min(1).optional(),
      PINECONE_ENVIRONMENT: z.string().optional(),
      PINECONE_INDEX: z.string().default('product-embeddings'),

      // Dub integration for link system
      DUB_API_KEY: z.string().min(1).optional(),
      DUB_WORKSPACE_ID: z.string().optional(),

      // Feature flags
      ENABLE_VECTOR_SEARCH: z.coerce.boolean().default(false),
      ENABLE_ANALYTICS: z.coerce.boolean().default(true),
      ENABLE_CACHING: z.coerce.boolean().default(true),

      // Logging
      LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    },
    runtimeEnv: {
      // Redis
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

      // Google Cloud
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      VERTEX_AI_MODEL: process.env.VERTEX_AI_MODEL,

      // OpenAI
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,

      // Anthropic
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,

      // Grok
      GROK_API_KEY: process.env.GROK_API_KEY,
      GROK_MODEL: process.env.GROK_MODEL,

      // Gateway
      LLM_GATEWAY_PORT: process.env.LLM_GATEWAY_PORT,
      LLM_GATEWAY_HOST: process.env.LLM_GATEWAY_HOST,
      LLM_GATEWAY_BASE_URL: process.env.LLM_GATEWAY_BASE_URL,
      LLM_GATEWAY_API_KEY: process.env.LLM_GATEWAY_API_KEY,

      // Vector store
      PINECONE_API_KEY: process.env.PINECONE_API_KEY,
      PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
      PINECONE_INDEX: process.env.PINECONE_INDEX,

      // Dub
      DUB_API_KEY: process.env.DUB_API_KEY,
      DUB_WORKSPACE_ID: process.env.DUB_WORKSPACE_ID,

      // Features
      ENABLE_VECTOR_SEARCH: process.env.ENABLE_VECTOR_SEARCH,
      ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS,
      ENABLE_CACHING: process.env.ENABLE_CACHING,

      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL,
    },
  });

