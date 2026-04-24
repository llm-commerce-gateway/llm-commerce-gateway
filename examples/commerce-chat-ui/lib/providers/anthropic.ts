import Anthropic from '@anthropic-ai/sdk';
import type { ProductResult } from '../parse-tool-results';
import {
  anthropicCommerceTools,
  COMMERCE_SYSTEM_PROMPT,
  runCommerceTool,
  type ToolCallRecord,
} from '../tools';
import type { ChatMessage, LlmProvider, LlmRunResult } from './types';

const MAX_TOOL_ROUNDS = 12;

export function createAnthropicProvider(): LlmProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.LLM_MODEL?.trim() || 'claude-sonnet-4-20250514';

  return {
    id: 'anthropic',
    displayName: 'Claude',
    model,

    async run(messages: ChatMessage[]): Promise<LlmRunResult> {
      const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const products: ProductResult[] = [];
      const toolCalls: ToolCallRecord[] = [];
      let finalText = '';

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const msg = await client.messages.create({
          model,
          max_tokens: 8192,
          system: COMMERCE_SYSTEM_PROMPT,
          messages: claudeMessages,
          tools: anthropicCommerceTools,
        });

        if (msg.stop_reason !== 'tool_use') {
          finalText = msg.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('');
          break;
        }

        claudeMessages.push({ role: 'assistant', content: msg.content });

        const blocks = msg.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of blocks) {
          const argsStr =
            typeof block.input === 'object' && block.input !== null
              ? JSON.stringify(block.input)
              : String(block.input ?? '{}');
          const { text, products: p, trace } = await runCommerceTool(block.name, argsStr);
          products.push(...p);
          toolCalls.push(trace);
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: text,
          });
        }

        claudeMessages.push({ role: 'user', content: results });
      }

      return {
        content: finalText || '(No text response)',
        products: dedupe(products),
        toolCalls,
      };
    },
  };
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
