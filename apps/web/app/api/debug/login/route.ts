import { NextResponse } from 'next/server';
import { getServerClient } from '@helena/db';
import { attachSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug: log in to a workspace without OAuth. Isolates cookie/session flow
 * from the Slack/Discord OAuth exchange.
 *
 * GET /api/debug/login              -> shows a picker with all workspaces
 * GET /api/debug/login?id=<uuid>    -> sets session cookie, redirects to dashboard
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('id');
  const db = getServerClient();

  if (workspaceId) {
    const { data } = await db
      .from('workspaces')
      .select('id, chat_platform, slack_team_name, discord_guild_name, onboarded')
      .eq('id', workspaceId)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ error: 'no workspace with that id' }, { status: 404 });
    }
    const w = data as {
      id: string;
      chat_platform: string;
      slack_team_name: string | null;
      discord_guild_name: string | null;
      onboarded: boolean;
    };
    const dest = w.onboarded ? '/dashboard' : '/dashboard/onboard';
    const res = NextResponse.redirect(new URL(dest, url.origin));
    return attachSessionCookie(res, w.id);
  }

  const { data: workspaces } = await db
    .from('workspaces')
    .select('id, chat_platform, slack_team_name, discord_guild_name, onboarded, incident_channel_name')
    .order('created_at', { ascending: false });

  const rows = workspaces ?? [];
  const html = `<!doctype html><html><head><title>helena debug login</title><style>
body{font-family:ui-monospace,monospace;background:#0a0a0a;color:#e5e5e5;padding:24px;line-height:1.6}
a{color:#7dd3fc;text-decoration:none;display:inline-block;margin-top:6px}
a:hover{color:#bae6fd}
.row{border:1px solid #262626;border-radius:8px;padding:16px;margin-bottom:12px}
.tag{display:inline-block;background:#1f2937;color:#9ca3af;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:6px}
</style></head><body>
<h2>Debug: log in as any workspace</h2>
<p>This bypasses OAuth and just sets the session cookie for the workspace you click. Use to test whether the dashboard and onboarding work independently of the OAuth callback.</p>
${rows
  .map(
    (w: any) => `
  <div class="row">
    <div>
      <span class="tag">${w.chat_platform}</span>
      <span class="tag">${w.onboarded ? 'onboarded' : 'not onboarded'}</span>
      ${w.incident_channel_name ? `<span class="tag">#${w.incident_channel_name}</span>` : ''}
    </div>
    <div style="margin-top:6px;font-size:16px;font-weight:600">
      ${w.chat_platform === 'discord' ? w.discord_guild_name : w.slack_team_name ?? 'unnamed'}
    </div>
    <div style="font-size:11px;color:#6b7280">${w.id}</div>
    <a href="/api/debug/login?id=${w.id}">→ Log in as this workspace</a>
  </div>
`
  )
  .join('')}
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
