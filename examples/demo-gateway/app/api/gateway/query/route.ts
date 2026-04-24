import { type NextRequest, NextResponse } from 'next/server';
import { requireBearer } from '@/lib/auth';
import { getDataSource } from '@/lib/data-source';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = requireBearer(req);
  if (denied) return denied;

  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_QUERY', response: null },
      { status: 400 },
    );
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json(
      { error: 'Missing query', code: 'INVALID_QUERY', response: null },
      { status: 400 },
    );
  }

  const source = getDataSource();
  const started = Date.now();

  try {
    const { products, queryInterpreted } = await source.search(query);
    const latencyMs = Date.now() - started;
    const activeProducts = await source.count();

    return NextResponse.json({
      response: {
        products,
        products_found: products.length,
        query_interpreted: queryInterpreted,
      },
      products_found: products.length,
      active_products: activeProducts,
      latency_ms: latencyMs,
      provider: 'demo-gateway',
      connector: source.id,
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Query failed';
    return NextResponse.json(
      { error: message, code: 'QUERY_FAILED', response: null, connector: source.id },
      { status: 500 },
    );
  }
}
