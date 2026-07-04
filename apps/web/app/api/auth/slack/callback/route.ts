import { NextResponse } from 'next/server';
import { upsertWorkspaceFromSlack } from '@helena/db';
import { loadEnv } from '@helena/shared';
import { setSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id: string; name?: string };
  authed_user?: { id?: string; access_token?: string; scope?: string };
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

  if (!code) {
    return NextResponse.json({ error: 'missing code' }, { status: 400 });
  }

  const redirectUri = `${url.origin}/api/auth/slack/callback`;

  const form = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri
  });

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  const payload = (await res.json()) as SlackOAuthResponse;

  if (!payload.ok || !payload.access_token || !payload.team?.id) {
    const back = new URL('/', url.origin);
    back.searchParams.set('install_error', payload.error ?? 'oauth_failed');
    return NextResponse.redirect(back.toString());
  }

  let installerEmail: string | undefined;
  if (payload.authed_user?.id) {
    try {
      const userRes = await fetch(
        `https://slack.com/api/users.info?user=${encodeURIComponent(payload.authed_user.id)}`,
        { headers: { Authorization: `Bearer ${payload.access_token}` } }
      );
      const userJson = (await userRes.json()) as {
        ok: boolean;
        user?: { profile?: { email?: string } };
      };
      if (userJson.ok) installerEmail = userJson.user?.profile?.email;
    } catch {
      // best effort
    }
  }

  const workspace = await upsertWorkspaceFromSlack({
    slackTeamId: payload.team.id,
    slackTeamName: payload.team.name ?? payload.team.id,
    botToken: payload.access_token,
    installerUserId: payload.authed_user?.id,
    installerEmail
  });

  await setSessionCookie(workspace.id);

  const dest = workspace.onboarded ? '/dashboard' : '/dashboard/onboard';
  return NextResponse.redirect(new URL(dest, url.origin));
}
