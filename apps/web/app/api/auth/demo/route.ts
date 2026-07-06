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
/**
 * Dedicated demo tenant, not tied to any real Slack/Discord install.
 * Judges get a full pre-seeded workspace with 71 incidents + 13 runbooks
 * spanning 12 months, and can never accidentally access a real user's data.
 */
const DEMO_WORKSPACE_ID = 'de11de11-de11-4de1-8de1-de11de11de11';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '/dashboard';
  const dest = to.startsWith('/dashboard') ? to : '/dashboard';
  const res = NextResponse.redirect(new URL(dest, url.origin));
  return attachSessionCookie(res, DEMO_WORKSPACE_ID);
}
