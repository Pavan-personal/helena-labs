import { NextResponse } from 'next/server';
import { upsertWorkspaceFromDiscord } from '@helena/db';
import { loadEnv } from '@helena/shared';
import { attachSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DiscordTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  guild?: {
    id: string;
    name: string;
  };
  error?: string;
  error_description?: string;
}

interface DiscordUserResponse {
  id: string;
  username?: string;
  email?: string;
  verified?: boolean;
}

export async function GET(req: Request) {
  const env = loadEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    const back = new URL('/', url.origin);
    back.searchParams.set('install_error', errorParam);
    return NextResponse.redirect(back.toString());
  }

  if (!code || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_BOT_TOKEN) {
    return NextResponse.json({ error: 'missing config or code' }, { status: 400 });
  }

  const redirectUri = `${url.origin}/api/auth/discord/callback`;

  const form = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  const token = (await tokenRes.json()) as DiscordTokenResponse;

  if (!token.access_token || !token.guild?.id) {
    const back = new URL('/', url.origin);
    back.searchParams.set('install_error', token.error ?? token.error_description ?? 'discord_oauth_failed');
    return NextResponse.redirect(back.toString());
  }

  let installerEmail: string | undefined;
  let installerId: string | undefined;
  try {
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const user = (await userRes.json()) as DiscordUserResponse;
    if (user.id) installerId = user.id;
    if (user.email && user.verified !== false) installerEmail = user.email;
  } catch {
    // best effort
  }

  // For Discord bots the bot itself has a static token from the app config,
  // not exchanged per install. We store that on the workspace so we can post
  // messages later.
  const workspace = await upsertWorkspaceFromDiscord({
    discordGuildId: token.guild.id,
    discordGuildName: token.guild.name,
    botToken: env.DISCORD_BOT_TOKEN,
    installerUserId: installerId,
    installerEmail
  });

  const dest = workspace.onboarded ? '/dashboard' : '/dashboard/onboard';
  const res = NextResponse.redirect(new URL(dest, url.origin));
  return attachSessionCookie(res, workspace.id);
}
