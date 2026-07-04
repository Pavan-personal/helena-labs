import { NextResponse } from 'next/server';
import { loadEnv } from '@helena/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES = [
  'app_mentions:read',
  'channels:history',
  'channels:read',
  'channels:join',
  'chat:write',
  'commands',
  'files:read',
  'groups:history',
  'users:read'
].join(',');

export async function GET(req: Request) {
  const env = loadEnv();
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/slack/callback`;

  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);

  return NextResponse.redirect(url.toString());
}
