import { NextResponse } from 'next/server';
import { getDefaultWorkspace, insertIncident, findSimilarByDedup } from '@helena/db';
import { extractFromImage } from '@helena/btl';
import { GrafanaWebhookSchema, loadEnv } from '@helena/shared';
import { normalizeGrafana } from '@/lib/normalize';
import { postToSlack } from '@/lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const env = loadEnv();
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  if (secret !== env.GRAFANA_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = GrafanaWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await getDefaultWorkspace();
  const normalized = normalizeGrafana(parsed.data);

  for (const item of normalized) {
    const captions: string[] = [];
    if (item.imageURL) {
      try {
        const v = await extractFromImage({
          workspaceId: workspace.id,
          imageUrl: item.imageURL,
          hint: item.incident.title
        });
        captions.push(v.caption);
      } catch (e) {
        console.error('grafana vision failed:', e);
      }
    }

    const inserted = await insertIncident(workspace.id, {
      ...item.incident,
      screenshotCaptions: captions.length > 0 ? captions : undefined
    });

    const isNovel = item.incident.dedupKey
      ? (await findSimilarByDedup(workspace.id, item.incident.dedupKey, 2)).length <= 1
      : true;

    if (isNovel || item.incident.severity === 'critical' || item.incident.severity === 'high') {
      const alertChannel = process.env.SLACK_ALERT_CHANNEL ?? '#incidents';
      const text = formatGrafanaCard(inserted.title, item.incident.severity, captions[0]);
      try {
        await postToSlack(alertChannel, text, workspace.bot_token);
      } catch (e) {
        console.error('grafana slack post failed:', e);
      }
    }
  }

  return NextResponse.json({ ok: true, count: normalized.length });
}

function formatGrafanaCard(title: string, severity: string, caption?: string): string {
  const lines = [
    `:rotating_light: *Grafana alert*  _severity: ${severity}_`,
    `*${title}*`
  ];
  if (caption) lines.push(`> ${caption}`);
  return lines.join('\n');
}
