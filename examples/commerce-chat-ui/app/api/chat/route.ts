import { NextResponse } from 'next/server';
import { getLlmProvider, type ChatMessage } from '@/lib/providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = { messages?: ChatMessage[] };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.filter(
        (m): m is ChatMessage =>
          !!m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
    : [];

  if (messages.length === 0) {
    return NextResponse.json(
      { error: 'messages[] is required' },
      { status: 400 },
    );
  }

  let provider;
  try {
    provider = getLlmProvider();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'LLM provider misconfigured';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const { content, products, toolCalls } = await provider.run(messages);
    return NextResponse.json({
      content,
      products,
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        model: provider.model,
      },
      toolCalls,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'LLM call failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
