import { NextResponse } from 'next/server';
import { getWorkspaceById, updateWorkspaceIntegration } from '@helena/db';
import { encodeSessionToken, getWorkspaceFromSession, attachSessionCookie } from '@/lib/session';
import { listInstallationRepos } from '@/lib/github';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GitHub sends the user back here after they install the app.
 * Query params:
 *   installation_id  the numeric install id
 *   setup_action     'install' | 'update'
 *   state            our workspace-scoped signed session token
 *   code             optional oauth code if user identity is requested
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const installationIdRaw = url.searchParams.get('installation_id');
  const state = url.searchParams.get('state');

  if (!installationIdRaw) {
    return NextResponse.redirect(
      new URL('/dashboard/integrations?err=no_installation', url.origin)
    );
  }
  const installationId = Number(installationIdRaw);
  if (!Number.isFinite(installationId)) {
    return NextResponse.redirect(
      new URL('/dashboard/integrations?err=bad_installation_id', url.origin)
    );
  }

  const workspace = await getWorkspaceFromSession(state ?? undefined);
  if (!workspace) {
    return NextResponse.redirect(new URL('/?install_error=no_session', url.origin));
  }

  let repos: string[] = [];
  try {
    const list = await listInstallationRepos(installationId);
    repos = list.map((r) => r.full_name);
  } catch (e) {
    console.error('list repos failed:', e);
  }

  await updateWorkspaceIntegration(workspace.id, {
    github_installation_id: installationId,
    github_repos: repos,
    github_connected_at: new Date().toISOString()
  });

  const dest = new URL('/dashboard/integrations', url.origin);
  dest.searchParams.set('hs', encodeSessionToken(workspace.id));
  dest.searchParams.set('connected', 'github');
  const res = NextResponse.redirect(dest);
  return attachSessionCookie(res, workspace.id);
}
