import { NextResponse } from 'next/server';
import { getWorkspaceBySecret, insertIncident, findSimilarByDedup } from '@helena/db';
import { SentryWebhookSchema } from '@helena/shared';
import { normalizeSentry } from '@/lib/normalize';
import { postToChat } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  const workspace = await getWorkspaceBySecret(secret);
  if (!workspace) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = SentryWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const incident = normalizeSentry(parsed.data);
  const inserted = await insertIncident(workspace.id, incident);

  const isNovel = incident.dedupKey
    ? (await findSimilarByDedup(workspace.id, incident.dedupKey, 2)).length <= 1
    : true;

  if (
    workspace.incident_channel_id &&
    (isNovel || incident.severity === 'critical' || incident.severity === 'high')
  ) {
    const text = `:bug: *Sentry* _${incident.severity}_\n*${inserted.title}*`;
    try {
      await postToChat(workspace, workspace.incident_channel_id, text);
    } catch (e) {
      console.error('sentry chat post failed:', e);
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
