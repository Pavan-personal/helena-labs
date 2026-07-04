import { NextResponse } from 'next/server';
import { getWorkspaceBySecret, insertIncident, findSimilarByDedup } from '@helena/db';
import { extractFromImage } from '@helena/btl';
import { GrafanaWebhookSchema } from '@helena/shared';
import { normalizeGrafana } from '@/lib/normalize';
import { postToSlack } from '@/lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
  const parsed = GrafanaWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 });
  }

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

    if (
      workspace.incident_channel_id &&
      (isNovel || item.incident.severity === 'critical' || item.incident.severity === 'high')
    ) {
      const text = formatGrafanaCard(inserted.title, item.incident.severity, captions[0]);
      try {
        await postToSlack(workspace.incident_channel_id, text, workspace.bot_token);
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
