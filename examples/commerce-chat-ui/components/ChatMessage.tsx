'use client';

import type { ProductResult } from '../lib/parse-tool-results';
import type { ToolCallRecord } from '../lib/tools';
import { ProductCard } from './ProductCard';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: ProductResult[];
  toolCalls?: ToolCallRecord[];
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const hasTrace = !isUser && Array.isArray(message.toolCalls) && message.toolCalls.length > 0;

  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(100%,36rem)] sm:max-w-[80%] ${
          isUser ? 'order-2' : 'order-1'
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-blue-600 text-white'
              : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800'
          }`}
        >
          {message.content || '…'}
        </div>

        {message.products && message.products.length > 0 ? (
          <div className="mt-2 grid max-w-xl grid-cols-1 gap-2 min-[480px]:grid-cols-2">
            {message.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : null}

        {hasTrace ? (
          <details className="mt-2 text-xs text-gray-500">
            <summary className="cursor-pointer select-none text-gray-400 hover:text-gray-600">
              {message.toolCalls!.length === 1
                ? '1 gateway call'
                : `${message.toolCalls!.length} gateway calls`}
            </summary>
            <ul className="mt-1 space-y-1 rounded-md border border-gray-100 bg-gray-50 p-2 font-mono">
              {message.toolCalls!.map((t, i) => (
                <li key={i} className="break-all">
                  <span className="text-blue-700">{t.name}</span>(
                  <span className="text-gray-700">{t.query}</span>){' → '}
                  <span className="text-gray-900">{t.productsFound} products</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
