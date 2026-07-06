import { NextResponse } from 'next/server';
import { attachSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-click demo login. Sets the session cookie server-side so the token
 * never appears in the URL, then redirects to the dashboard. The workspace
 * id here is the pre-seeded demo tenant (71 incidents, 13 runbooks, 12
 * months of activity across slack/grafana/sentry/github).
 */
const DEMO_WORKSPACE_ID = '77aa1d7d-a3ae-4dc5-bb92-e07abe81a5f5';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '/dashboard';
  const dest = to.startsWith('/dashboard') ? to : '/dashboard';
  const res = NextResponse.redirect(new URL(dest, url.origin));
  return attachSessionCookie(res, DEMO_WORKSPACE_ID);
}
