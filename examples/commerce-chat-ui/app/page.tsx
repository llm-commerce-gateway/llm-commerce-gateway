'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage, type Message } from '../components/ChatMessage';
import type { ProductResult } from '../lib/parse-tool-results';
import type { ToolCallRecord } from '../lib/tools';

type ProviderInfo = { id: string; displayName: string; model?: string };

type ChatApiResponse = {
  content?: string;
  products?: ProductResult[];
  provider?: ProviderInfo;
  toolCalls?: ToolCallRecord[];
  error?: string;
};

const WELCOME =
  "Hi! Ask me about products in the catalog — try \u201C@shop Nike\u201D, \u201Cvitamin C serum under $80\u201D, or \u201Cwhat do you have in stock?\u201D";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput('');
    setLoading(true);

    const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const body = (await res.json().catch(() => ({}))) as ChatApiResponse;

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              typeof body.error === 'string'
                ? body.error
                : `Request failed (${res.status})`,
          },
        ]);
        return;
      }

      if (body.provider) setProvider(body.provider);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: body.content ?? '(No response)',
          products: Array.isArray(body.products) ? body.products : [],
          toolCalls: Array.isArray(body.toolCalls) ? body.toolCalls : [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            CG
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Commerce Chat UI</p>
            <p className="text-xs text-gray-400">LLM → Commerce Gateway → Data</p>
          </div>
        </div>
        {provider ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-700">
              {provider.displayName}
            </span>
            {provider.model ? <span className="font-mono text-gray-400">{provider.model}</span> : null}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading ? (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-2 text-sm text-gray-400">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-gray-100 bg-white px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products…"
          disabled={loading}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {loading ? '\u2026' : 'Send'}
        </button>
      </form>

      <footer className="border-t border-gray-100 bg-white py-1.5 text-center text-xs text-gray-400">
        llm-commerce-gateway · example
      </footer>
    </div>
  );
}
