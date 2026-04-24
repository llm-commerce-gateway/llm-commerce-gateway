import { type NextRequest, NextResponse } from 'next/server';

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', response: null }, { status: 401 });
}

/** Returns null if OK, or a 401 NextResponse */
export function requireBearer(req: NextRequest): NextResponse | null {
  const expected = process.env.DEMO_GATEWAY_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        error: 'Server misconfigured: DEMO_GATEWAY_TOKEN is not set',
        response: null,
      },
      { status: 500 },
    );
  }

  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = m?.[1]?.trim();
  if (!token || token !== expected) {
    return unauthorized();
  }
  return null;
}
