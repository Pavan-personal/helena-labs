import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { loadEnv } from '@helena/shared';
import { encodeSessionToken, getWorkspaceFromSession } from '@/lib/session';
import { isDemoWorkspace } from '@/lib/demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NONCE_COOKIE = 'gh_install_state';

/**
 * Kick off a GitHub App install. We require an explicit `hs` param (no
 * ambient session fallback) to defeat CSRF-on-install, and we set a
 * one-time nonce cookie that must be echoed by the callback.
 */
export async function GET(req: Request) {
  const env = loadEnv();
  if (!env.GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const hs = url.searchParams.get('hs');
  if (!hs) {
    return NextResponse.redirect(new URL('/?install_error=no_session', url.origin));
  }

  const workspace = await getWorkspaceFromSession(hs);
  if (workspace && isDemoWorkspace(workspace.id)) {
    return NextResponse.redirect(
      new URL('/dashboard/integrations?err=demo_blocked', url.origin)
    );
  }
  if (!workspace) {
    return NextResponse.redirect(new URL('/?install_error=no_session', url.origin));
  }

  const nonce = randomBytes(32).toString('base64url');
  const state = `${nonce}.${encodeSessionToken(workspace.id)}`;
  const appSlug = 'helena-btl-labs';
  const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  installUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(installUrl.toString());
  res.headers.append(
    'Set-Cookie',
    `${NONCE_COOKIE}=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  return res;
}
