'use server';

import { redirect } from 'next/navigation';
import { setIncidentChannel } from '@helena/db';
import { requireWorkspace } from '@/lib/session';

export async function joinChannelAction(formData: FormData) {
  const workspace = await requireWorkspace();
  const raw = formData.get('channel')?.toString();
  if (!raw) return;
  const [channelId, channelName] = raw.split('|');
  if (!channelId || !channelName) return;

  const res = await fetch('https://slack.com/api/conversations.join', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workspace.bot_token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ channel: channelId })
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok && json.error && json.error !== 'already_in_channel') {
    console.error('conversations.join failed:', json.error);
  }

  await setIncidentChannel(workspace.id, channelId, channelName);
  redirect('/dashboard');
}
