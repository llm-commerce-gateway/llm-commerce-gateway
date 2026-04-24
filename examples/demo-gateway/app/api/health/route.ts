import { NextResponse } from 'next/server';
import { getDataSource } from '@/lib/data-source';

export const runtime = 'nodejs';

export async function GET() {
  const source = getDataSource();

  try {
    const activeProducts = await source.count();
    return NextResponse.json({
      status: 'ok',
      connector: source.id,
      active_products: activeProducts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'error',
        connector: source.id,
        active_products: 0,
        error: message,
      },
      { status: 503 },
    );
  }
}
