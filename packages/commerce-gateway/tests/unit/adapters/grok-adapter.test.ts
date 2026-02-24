import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrokAdapter } from '../../../src/adapters/grok/GrokAdapter';
import {
  MockCartBackend,
  MockOrderBackend,
  MockProductBackend,
} from '../../mocks/backends';

function createAdapter() {
  return new GrokAdapter({
    apiKey: 'xai-test-key',
    backends: {
      products: new MockProductBackend(),
      cart: new MockCartBackend(),
      orders: new MockOrderBackend(),
    },
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GrokAdapter', () => {
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  it('executes tool calls and sends tool results follow-up', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resp-1',
          object: 'chat.completion',
          created: 1,
          model: 'grok-2',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'tc-1',
                    type: 'function',
                    function: { name: 'search_products', arguments: '{"query":"oil"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resp-2',
          object: 'chat.completion',
          created: 2,
          model: 'grok-2',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Found products' },
              finish_reason: 'stop',
            },
          ],
        })
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const adapter = createAdapter();
    const response = await adapter.handleRequest({
      sessionId: 'sess-1',
      messages: [{ role: 'user', content: 'Find oil products' }],
    });

    expect(response.choices[0]?.message.content).toBe('Found products');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string) as {
      messages: Array<{ role: string; tool_call_id?: string }>;
    };
    expect(
      secondCallBody.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'tc-1')
    ).toBe(true);
  });

  it('handles malformed tool arguments without crashing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resp-1',
          object: 'chat.completion',
          created: 1,
          model: 'grok-2',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'tc-bad-json',
                    type: 'function',
                    function: { name: 'search_products', arguments: '{"query":"oil"' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resp-2',
          object: 'chat.completion',
          created: 2,
          model: 'grok-2',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Recovered from bad arguments' },
              finish_reason: 'stop',
            },
          ],
        })
      );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const adapter = createAdapter();
    const response = await adapter.handleRequest({
      sessionId: 'sess-2',
      messages: [{ role: 'user', content: 'Find oil products' }],
    });

    expect(response.choices[0]?.message.content).toBe('Recovered from bad arguments');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string) as {
      messages: Array<{ role: string; content?: string }>;
    };
    const toolMessage = secondCallBody.messages.find((m) => m.role === 'tool');
    expect(toolMessage?.content?.toLowerCase()).toContain('error');
  });

  it('surfaces Grok API errors with message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Unauthorized' } }, 401));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const adapter = createAdapter();
    await expect(
      adapter.handleRequest({
        messages: [{ role: 'user', content: 'hello' }],
      })
    ).rejects.toThrow('Grok API error: Unauthorized');
  });

  it('streams chunk and done events', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"stream-1","object":"chat.completion.chunk","created":1,"model":"grok-2","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"id":"stream-1","object":"chat.completion.chunk","created":1,"model":"grok-2","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n'
          )
        );
        controller.enqueue(encoder.encode('data: [DONE]\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const adapter = createAdapter();
    const events: Array<{ type: string; data?: unknown }> = [];

    for await (const event of adapter.handleStreamingRequest({
      sessionId: 'sess-stream',
      messages: [{ role: 'user', content: 'Say hi' }],
    })) {
      events.push(event);
    }

    expect(events[0]?.type).toBe('start');
    expect(events.some((e) => e.type === 'chunk')).toBe(true);
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
