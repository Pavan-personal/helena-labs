import { NextResponse } from 'next/server';
import { getWorkspaceBySecret, insertIncident, findSimilarByDedup } from '@helena/db';
import {
  GenericWebhookSchema,
  computeDedupKey,
  extractTopFrames,
  type NormalizedIncident
} from '@helena/shared';
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
  const parsed = GenericWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const dedupKey = computeDedupKey({
    source: parsed.data.source,
    title: parsed.data.title,
    topFrames: extractTopFrames(parsed.data.stack)
  });

  const incident: NormalizedIncident = {
    source: 'generic',
    severity: parsed.data.severity ?? 'medium',
    externalId: parsed.data.externalId,
    title: parsed.data.title,
    body: [parsed.data.message, parsed.data.stack].filter(Boolean).join('\n\n'),
    dedupKey,
    extractedJson: parsed.data.metadata
  };

  const inserted = await insertIncident(workspace.id, incident);

  const isNovel = (await findSimilarByDedup(workspace.id, dedupKey, 2)).length <= 1;

  if (
    workspace.incident_channel_id &&
    (isNovel || incident.severity === 'critical' || incident.severity === 'high')
  ) {
    const text = `:warning: *${parsed.data.source}* _${incident.severity}_\n*${inserted.title}*\n${parsed.data.message}`;
    try {
      await postToChat(workspace, workspace.incident_channel_id, text);
    } catch (e) {
      console.error('generic chat post failed:', e);
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
