import { NextResponse } from 'next/server';
import { clearSessionOnResponse } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL('/?signed_out=1', new URL(req.url).origin);
  const res = NextResponse.redirect(url);
  return clearSessionOnResponse(res);
}
