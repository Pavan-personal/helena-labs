import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, encodeSessionToken, getWorkspaceFromSession } from '@/lib/session';
import { getServerClient } from '@helena/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'read';

  if (action === 'set') {
    const db = getServerClient();
    const { data } = await db.from('workspaces').select('id').limit(1).maybeSingle();
    if (!data) {
      return NextResponse.json({ error: 'no workspace exists yet' }, { status: 404 });
    }
    const wid = (data as { id: string }).id;
    const token = encodeSessionToken(wid);
    const dest = new URL('/api/debug/session?action=read', url.origin);
    const res = NextResponse.redirect(dest.toString());
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });
    return res;
  }

  const jar = await cookies();
  const cookieValue = jar.get(COOKIE_NAME)?.value ?? null;
  const workspace = await getWorkspaceFromSession();

  return NextResponse.json({
    incoming_cookie_present: cookieValue !== null,
    incoming_cookie_length: cookieValue?.length ?? 0,
    incoming_cookie_preview: cookieValue ? `${cookieValue.slice(0, 20)}...` : null,
    workspace_from_session: workspace
      ? {
          id: workspace.id,
          slack_team_name: workspace.slack_team_name,
          onboarded: workspace.onboarded,
          incident_channel_name: workspace.incident_channel_name
        }
      : null,
    all_cookies: jar.getAll().map((c) => ({ name: c.name, len: c.value.length }))
  });
}
