import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { updateWorkspaceIntegration } from '@helena/db';
import { encodeSessionToken, getWorkspaceFromSession, attachSessionCookie } from '@/lib/session';
import { listInstallationRepos } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NONCE_COOKIE = 'gh_install_state';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationIdRaw = url.searchParams.get('installation_id');
  const state = url.searchParams.get('state');

  if (!installationIdRaw || !/^\d+$/.test(installationIdRaw) || installationIdRaw === '0') {
    return redirectErr(url.origin, 'bad_installation_id');
  }
  const installationId = Number(installationIdRaw);

  if (!state) return redirectErr(url.origin, 'missing_state');
  // encodeSessionToken() returns "<workspaceId>.<signature>" so the full
  // state has TWO dots. Split only on the FIRST dot to keep the whole
  // session token intact. Previously we destructured the first two parts
  // and lost the signature, which made getWorkspaceFromSession() reject
  // the token as unsigned.
  const firstDot = state.indexOf('.');
  if (firstDot < 0) return redirectErr(url.origin, 'bad_state');
  const nonce = state.slice(0, firstDot);
  const workspaceToken = state.slice(firstDot + 1);
  if (!nonce || !workspaceToken) return redirectErr(url.origin, 'bad_state');

  const jar = await cookies();
  const cookieNonce = jar.get(NONCE_COOKIE)?.value;
  if (!cookieNonce) return redirectErr(url.origin, 'nonce_missing');
  const a = Buffer.from(nonce);
  const b = Buffer.from(cookieNonce);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return redirectErr(url.origin, 'nonce_mismatch');
  }

  const workspace = await getWorkspaceFromSession(workspaceToken);
  if (!workspace) {
    return redirectErr(url.origin, 'no_workspace');
  }

  let repos: string[] = [];
  try {
    const list = await listInstallationRepos(installationId);
    repos = list.map((r) => r.full_name);
  } catch (e) {
    console.error('list repos failed:', e);
  }

  try {
    await updateWorkspaceIntegration(workspace.id, {
      github_installation_id: installationId,
      github_repos: repos,
      github_connected_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('save github failed:', e);
    return redirectErr(url.origin, 'save_failed');
  }

  const dest = new URL('/dashboard/integrations', url.origin);
  dest.searchParams.set('hs', encodeSessionToken(workspace.id));
  dest.searchParams.set('connected', 'github');
  const res = NextResponse.redirect(dest);
  // Clear the one-time nonce cookie
  res.headers.append(
    'Set-Cookie',
    `${NONCE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  return attachSessionCookie(res, workspace.id);
}

function redirectErr(origin: string, err: string): NextResponse {
  const dest = new URL('/dashboard/integrations', origin);
  dest.searchParams.set('err', err);
  return NextResponse.redirect(dest);
}
