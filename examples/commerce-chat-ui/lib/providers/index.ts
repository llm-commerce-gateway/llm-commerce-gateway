import { createAnthropicProvider } from './anthropic';
import { createOpenAIProvider, createXAIProvider } from './openai-compatible';
import type { LlmProvider, LlmProviderId } from './types';

export type {
  ChatMessage,
  LlmProvider,
  LlmProviderId,
  LlmRunResult,
} from './types';

const BUILDERS: Record<LlmProviderId, () => LlmProvider> = {
  anthropic: createAnthropicProvider,
  openai: createOpenAIProvider,
  xai: createXAIProvider,
};

/**
 * Pick the LLM provider from `LLM_PROVIDER`. This is the only place the UI
 * touches "which model"; there is no in-app toggle.
 *
 *   LLM_PROVIDER=anthropic   (default) + ANTHROPIC_API_KEY
 *   LLM_PROVIDER=openai                + OPENAI_API_KEY
 *   LLM_PROVIDER=xai                   + XAI_API_KEY
 *
 * Override the model slug with `LLM_MODEL=...`.
 */
export function getLlmProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? 'anthropic').trim().toLowerCase();
  const key = (raw as LlmProviderId) in BUILDERS ? (raw as LlmProviderId) : null;
  if (!key) {
    throw new Error(
      `Unsupported LLM_PROVIDER="${raw}". Expected one of: anthropic, openai, xai.`,
    );
  }
  return BUILDERS[key]();
}

/** For the read-only badge in the UI — safe to call without API keys. */
export function getPublicProviderInfo(): { id: LlmProviderId; displayName: string } {
  const raw = (process.env.LLM_PROVIDER ?? 'anthropic').trim().toLowerCase() as LlmProviderId;
  switch (raw) {
    case 'openai':
      return { id: 'openai', displayName: 'OpenAI' };
    case 'xai':
      return { id: 'xai', displayName: 'Grok' };
    case 'anthropic':
    default:
      return { id: 'anthropic', displayName: 'Claude' };
  }
}
