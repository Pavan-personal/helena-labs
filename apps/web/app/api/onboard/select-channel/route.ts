import { NextResponse } from 'next/server';
import { setIncidentChannel } from '@helena/db';
import { getWorkspaceFromSession, attachSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const workspace = await getWorkspaceFromSession();
  if (!workspace) {
    const raw = req.headers.get('cookie') ?? '';
    const preview = raw.slice(0, 120);
    console.error('select-channel no_session, raw cookie header:', preview);
    const target = new URL('/?install_error=no_session', new URL(req.url).origin);
    target.searchParams.set('cookie_len', String(raw.length));
    target.searchParams.set('cookie_preview', preview);
    return NextResponse.redirect(target);
  }

  const form = await req.formData();
  const raw = form.get('channel')?.toString();
  if (!raw) {
    return NextResponse.redirect(new URL('/dashboard/onboard?err=no_channel', new URL(req.url).origin));
  }
  const [channelId, channelName] = raw.split('|');
  if (!channelId || !channelName) {
    return NextResponse.redirect(new URL('/dashboard/onboard?err=bad_channel', new URL(req.url).origin));
  }

  if (workspace.chat_platform === 'slack' && workspace.bot_token) {
    try {
      const joinRes = await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${workspace.bot_token}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ channel: channelId })
      });
      const json = (await joinRes.json()) as { ok: boolean; error?: string };
      if (!json.ok && json.error && json.error !== 'already_in_channel') {
        console.error('conversations.join failed:', json.error);
      }
    } catch (e) {
      console.error('slack join error:', e);
    }
  }

  try {
    await setIncidentChannel(workspace.id, channelId, channelName);
  } catch (e) {
    console.error('setIncidentChannel failed:', e);
    return NextResponse.redirect(new URL('/dashboard/onboard?err=save_failed', new URL(req.url).origin));
  }

  const res = NextResponse.redirect(new URL('/dashboard', new URL(req.url).origin));
  return attachSessionCookie(res, workspace.id);
}
