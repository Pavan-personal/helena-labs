import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await clearSessionCookie();
  const url = new URL('/?signed_out=1', new URL(req.url).origin);
  return NextResponse.redirect(url);
}
