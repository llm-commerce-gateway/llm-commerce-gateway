import type { GatewayQueryPayload } from './format-gateway-query';

/**
 * Server-only: POST to a Commerce Gateway's `/api/gateway/query` endpoint.
 *
 * `GATEWAY_BASE_URL` + `GATEWAY_API_TOKEN` are env-driven. The bundled
 * `examples/demo-gateway` is the reference target; swap in any gateway that
 * honors the same contract (see packages/commerce-gateway).
 */
export async function queryGateway(query: string): Promise<GatewayQueryPayload> {
  const baseUrl = process.env.GATEWAY_BASE_URL?.trim();
  const token = process.env.GATEWAY_API_TOKEN?.trim();

  if (!baseUrl || !token) {
    return {
      error: 'Missing GATEWAY_BASE_URL or GATEWAY_API_TOKEN',
      details:
        'Set both to your gateway origin and a Bearer token accepted by /api/gateway/query.',
    };
  }

  const origin = baseUrl.replace(/\/$/, '');
  const url = `${origin}/api/gateway/query`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = (await upstream.json().catch(() => ({}))) as GatewayQueryPayload;

  if (!upstream.ok) {
    return {
      error: typeof data.error === 'string' ? data.error : upstream.statusText,
      ...data,
    };
  }

  return data;
}
