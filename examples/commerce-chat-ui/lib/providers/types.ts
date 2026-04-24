import type { ProductResult } from '../parse-tool-results';
import type { ToolCallRecord } from '../tools';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type LlmProviderId = 'anthropic' | 'openai' | 'xai';

export type LlmRunResult = {
  content: string;
  products: ProductResult[];
  toolCalls: ToolCallRecord[];
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  /** Human-readable name shown in the optional provider badge. */
  readonly displayName: string;
  /** Model slug actually used for the run, for trace display. */
  readonly model: string;
  run(messages: ChatMessage[]): Promise<LlmRunResult>;
}
