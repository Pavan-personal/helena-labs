import { NextResponse } from 'next/server';
import { getDefaultWorkspace, insertIncident, findSimilarByDedup } from '@helena/db';
import { SentryWebhookSchema, loadEnv } from '@helena/shared';
import { normalizeSentry } from '@/lib/normalize';
import { postToSlack } from '@/lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const env = loadEnv();
  const authz = req.headers.get('authorization') ?? '';
  const providedToken =
    req.headers.get('sentry-hook-signature') ??
    req.headers.get('x-sentry-token') ??
    authz.replace(/^Bearer\s+/i, '');

  if (providedToken !== env.SENTRY_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = SentryWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

  const workspace = await getDefaultWorkspace();
  const incident = normalizeSentry(parsed.data);
  const inserted = await insertIncident(workspace.id, incident);

  const isNovel = incident.dedupKey
    ? (await findSimilarByDedup(workspace.id, incident.dedupKey, 2)).length <= 1
    : true;

  if (isNovel || incident.severity === 'critical' || incident.severity === 'high') {
    const alertChannel = process.env.SLACK_ALERT_CHANNEL ?? '#incidents';
    const text = `:bug: *Sentry* _${incident.severity}_\n*${inserted.title}*`;
    try {
      await postToSlack(alertChannel, text, workspace.bot_token);
    } catch (e) {
      console.error('sentry slack post failed:', e);
    }
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
