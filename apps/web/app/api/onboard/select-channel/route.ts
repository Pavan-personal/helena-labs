import { NextResponse } from 'next/server';
import { setIncidentChannel } from '@helena/db';
import {
  getWorkspaceFromSession,
  attachSessionCookie,
  encodeSessionToken
} from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const formToken = form.get('hs')?.toString();
  const urlToken = new URL(req.url).searchParams.get('hs') ?? undefined;
  const explicitToken = formToken || urlToken;

  const workspace = await getWorkspaceFromSession(explicitToken);
  if (!workspace) {
    const raw = req.headers.get('cookie') ?? '';
    const preview = raw.slice(0, 120);
    console.error('select-channel no_session, raw cookie header:', preview);
    const target = new URL('/?install_error=no_session', new URL(req.url).origin);
    target.searchParams.set('cookie_len', String(raw.length));
    target.searchParams.set('cookie_preview', preview);
    target.searchParams.set('had_form_token', formToken ? '1' : '0');
    return NextResponse.redirect(target);
  }

  const raw = form.get('channel')?.toString();
  if (!raw) {
    const dest = new URL('/dashboard/onboard', new URL(req.url).origin);
    dest.searchParams.set('err', 'no_channel');
    dest.searchParams.set('hs', encodeSessionToken(workspace.id));
    return NextResponse.redirect(dest);
  }
  const [channelId, channelName] = raw.split('|');
  if (!channelId || !channelName) {
    const dest = new URL('/dashboard/onboard', new URL(req.url).origin);
    dest.searchParams.set('err', 'bad_channel');
    dest.searchParams.set('hs', encodeSessionToken(workspace.id));
    return NextResponse.redirect(dest);
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
    const dest = new URL('/dashboard/onboard', new URL(req.url).origin);
    dest.searchParams.set('err', 'save_failed');
    dest.searchParams.set('hs', encodeSessionToken(workspace.id));
    return NextResponse.redirect(dest);
  }

  const dest = new URL('/dashboard', new URL(req.url).origin);
  dest.searchParams.set('hs', encodeSessionToken(workspace.id));
  const res = NextResponse.redirect(dest);
  return attachSessionCookie(res, workspace.id);
}
