import { NextResponse } from 'next/server';
import { loadEnv } from '@helena/shared';
import { encodeSessionToken, getWorkspaceFromSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Redirect the user to GitHub App install screen. GitHub returns them to
 * our callback with installation_id + code + our state param so we can
 * associate the install with the right workspace.
 */
export async function GET(req: Request) {
  const env = loadEnv();
  if (!env.GITHUB_CLIENT_ID) {
    return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 });
  }

  const workspace = await getWorkspaceFromSession(
    new URL(req.url).searchParams.get('hs') ?? undefined
  );
  if (!workspace) {
    return NextResponse.redirect(new URL('/?install_error=no_session', new URL(req.url).origin));
  }

  const state = encodeSessionToken(workspace.id);
  const appSlug = 'helena-btl-labs';
  const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  installUrl.searchParams.set('state', state);

  return NextResponse.redirect(installUrl.toString());
}
