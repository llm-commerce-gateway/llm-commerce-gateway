import type {
  DataSource,
  DataSourceSearchResult,
  GatewayProduct,
} from './types';

/**
 * Template data source for recipes that proxy to a custom backend
 * (`DATA_SOURCE=custom`). Fill in the two HTTP calls and you're done.
 *
 * Contract: your backend should accept `{ query: string }` and return
 * `{ products: GatewayProduct[] }`. That's it. Everything else (ranking,
 * /api/health, auth against the chat UI) stays identical.
 *
 * See `examples/recipes/chat-custom-api/README.md` for the step-by-step.
 */

const DEFAULT_QUERY_PATH = '/search';
const DEFAULT_COUNT_PATH = '/count';

function requireBaseUrl(): string {
  const url = process.env.CUSTOM_DATA_SOURCE_URL?.trim();
  if (!url) {
    throw new Error(
      'CUSTOM_DATA_SOURCE_URL is required when DATA_SOURCE=custom',
    );
  }
  return url.replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const token = process.env.CUSTOM_DATA_SOURCE_TOKEN?.trim();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const customDataSource: DataSource = {
  id: 'custom',

  async search(query: string): Promise<DataSourceSearchResult> {
    const base = requireBaseUrl();
    const path = process.env.CUSTOM_DATA_SOURCE_QUERY_PATH?.trim() || DEFAULT_QUERY_PATH;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`Custom data source returned ${res.status}`);
    }

    const data = (await res.json().catch(() => ({}))) as {
      products?: GatewayProduct[];
      query_interpreted?: string;
    };

    return {
      products: Array.isArray(data.products) ? data.products : [],
      queryInterpreted: data.query_interpreted ?? query,
    };
  },

  async count(): Promise<number> {
    const base = requireBaseUrl();
    const path = process.env.CUSTOM_DATA_SOURCE_COUNT_PATH?.trim() || DEFAULT_COUNT_PATH;

    try {
      const res = await fetch(`${base}${path}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return 0;
      const data = (await res.json().catch(() => ({}))) as { count?: number };
      return typeof data.count === 'number' ? data.count : 0;
    } catch {
      return 0;
    }
  },
};
