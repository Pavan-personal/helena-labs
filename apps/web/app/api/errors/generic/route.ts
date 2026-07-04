import { NextResponse } from 'next/server';
import { getDefaultWorkspace, insertIncident, findSimilarByDedup } from '@helena/db';
import {
  GenericWebhookSchema,
  computeDedupKey,
  extractTopFrames,
  loadEnv,
  type NormalizedIncident
} from '@helena/shared';
import { postToSlack } from '@/lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const env = loadEnv();
  const key = req.headers.get('x-helena-key') ?? new URL(req.url).searchParams.get('key');
  if (key !== env.GENERIC_WEBHOOK_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = GenericWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await getDefaultWorkspace();

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
  if (isNovel || incident.severity === 'critical' || incident.severity === 'high') {
    const alertChannel = process.env.SLACK_ALERT_CHANNEL ?? '#incidents';
    const text = `:warning: *${parsed.data.source}* _${incident.severity}_\n*${inserted.title}*\n${parsed.data.message}`;
    try {
      await postToSlack(alertChannel, text, workspace.bot_token);
    } catch (e) {
      console.error('generic slack post failed:', e);
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
