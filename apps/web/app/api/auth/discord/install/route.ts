import { NextResponse } from 'next/server';
import { loadEnv } from '@helena/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bot permissions integer:
 *   VIEW_CHANNEL (0x400)          = 1024
 *   SEND_MESSAGES (0x800)         = 2048
 *   EMBED_LINKS (0x4000)          = 16384
 *   READ_MESSAGE_HISTORY (0x10000)= 65536
 *   USE_APPLICATION_COMMANDS (0x80000000000) = large
 * We ask for a broad-but-safe set for message posting and reading.
 */
const PERMISSIONS = '277025770496';
const SCOPES = ['bot', 'applications.commands', 'identify', 'email'].join(' ');

export async function GET(req: Request) {
  const env = loadEnv();
  if (!env.DISCORD_CLIENT_ID) {
    return NextResponse.json({ error: 'Discord not configured' }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/discord/callback`;

  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('permissions', PERMISSIONS);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(url.toString());
}
