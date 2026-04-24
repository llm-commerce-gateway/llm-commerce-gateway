import OpenAI from 'openai';
import type { ProductResult } from '../parse-tool-results';
import {
  COMMERCE_SYSTEM_PROMPT,
  openaiCommerceTools,
  runCommerceTool,
  type ToolCallRecord,
} from '../tools';
import type { ChatMessage, LlmProvider, LlmProviderId, LlmRunResult } from './types';

const MAX_TOOL_ROUNDS = 12;

type Config = {
  id: LlmProviderId;
  displayName: string;
  baseURL?: string;
  apiKeyEnv: string;
  defaultModel: string;
};

function createProvider(cfg: Config): LlmProvider {
  const apiKey = process.env[cfg.apiKeyEnv]?.trim();
  if (!apiKey) {
    throw new Error(`${cfg.apiKeyEnv} is required when LLM_PROVIDER=${cfg.id}`);
  }

  const client = new OpenAI({ apiKey, baseURL: cfg.baseURL });
  const model = process.env.LLM_MODEL?.trim() || cfg.defaultModel;

  return {
    id: cfg.id,
    displayName: cfg.displayName,
    model,

    async run(messages: ChatMessage[]): Promise<LlmRunResult> {
      type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
      const chat: ChatMsg[] = [
        { role: 'system', content: COMMERCE_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
      ];

      const products: ProductResult[] = [];
      const toolCalls: ToolCallRecord[] = [];
      let finalText = '';

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const completion = await client.chat.completions.create({
          model,
          messages: chat,
          tools: openaiCommerceTools,
          tool_choice: 'auto',
        });

        const choice = completion.choices[0];
        if (!choice?.message) {
          finalText = 'No response from model.';
          break;
        }

        if (
          choice.finish_reason !== 'tool_calls' ||
          !choice.message.tool_calls?.length
        ) {
          finalText = choice.message.content ?? '';
          break;
        }

        chat.push(choice.message);

        for (const tc of choice.message.tool_calls) {
          if (tc.type !== 'function') continue;
          const { text, products: p, trace } = await runCommerceTool(
            tc.function.name,
            tc.function.arguments || '{}',
          );
          products.push(...p);
          toolCalls.push(trace);
          chat.push({ role: 'tool', tool_call_id: tc.id, content: text });
        }
      }

      return {
        content: finalText || '(No text response)',
        products: dedupe(products),
        toolCalls,
      };
    },
  };
}

export function createOpenAIProvider(): LlmProvider {
  return createProvider({
    id: 'openai',
    displayName: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  });
}

export function createXAIProvider(): LlmProvider {
  return createProvider({
    id: 'xai',
    displayName: 'Grok',
    baseURL: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
    defaultModel: 'grok-4-0709',
  });
}

function dedupe(items: ProductResult[]): ProductResult[] {
  const seen = new Set<string>();
  const out: ProductResult[] = [];
  for (const p of items) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
