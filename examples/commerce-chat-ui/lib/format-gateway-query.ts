import {
  parseProductsFromToolResult,
  type ProductResult,
} from './parse-tool-results';

export type GatewayQueryPayload = {
  response?: unknown;
  products_found?: number;
  /** Total active catalog rows (demo-gateway); same semantics as GET /api/health. */
  active_products?: number;
  latency_ms?: number;
  /** When present, surfaces as evidence id in governed demo rail. */
  query_log_id?: string;
  provider?: string | null;
  connector?: string | null;
  error?: unknown;
  code?: string;
  details?: string;
  attempts?: unknown;
  fallback_used?: boolean;
};

/** UI copy for demo-gateway `connector` codes. */
export function gatewayConnectorLabel(connector: string | null | undefined): string {
  if (connector === 'demo-static') return 'Demo catalog';
  if (connector === 'custom') return 'Custom data source';
  if (connector?.trim()) return connector.trim();
  return '';
}

export type GatewayResultMeta = {
  connector: string | null;
  active_products?: number;
};

/**
 * Turn a hosted gateway query JSON body into assistant-visible text and product cards.
 */
export function formatGatewayQueryMessage(
  payload: GatewayQueryPayload,
): { content: string; products: ProductResult[]; gatewayMeta?: GatewayResultMeta } {
  if (payload.error != null) {
    const err =
      typeof payload.error === 'string'
        ? payload.error
        : JSON.stringify(payload.error);
    return {
      content: `Gateway error: ${err}${payload.details ? ` — ${payload.details}` : ''}`,
      products: [],
      gatewayMeta:
        payload.connector != null || typeof payload.active_products === 'number'
          ? {
              connector: payload.connector ?? null,
              active_products:
                typeof payload.active_products === 'number'
                  ? payload.active_products
                  : undefined,
            }
          : undefined,
    };
  }

  const r = payload.response;
  let content: string;
  if (typeof r === 'string') {
    content = r;
  } else if (r != null && typeof r === 'object') {
    content = JSON.stringify(r, null, 2);
  } else {
    content = 'No response body.';
  }

  const meta: string[] = [];
  if (typeof payload.latency_ms === 'number') {
    meta.push(`${payload.latency_ms}ms`);
  }
  if (payload.provider) {
    meta.push(`provider: ${payload.provider}`);
  }
  if (typeof payload.products_found === 'number') {
    meta.push(`products_found: ${payload.products_found}`);
  }
  if (meta.length > 0) {
    content += `\n\n_${meta.join(' · ')}_`;
  }

  const forParse =
    typeof r === 'string' ? r : JSON.stringify(r ?? {});
  const products = parseProductsFromToolResult(forParse);

  const gatewayMeta: GatewayResultMeta | undefined =
    payload.connector != null || typeof payload.active_products === 'number'
      ? {
          connector: payload.connector ?? null,
          active_products:
            typeof payload.active_products === 'number'
              ? payload.active_products
              : undefined,
        }
      : undefined;

  return { content, products, gatewayMeta };
}
