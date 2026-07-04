import { NextResponse } from 'next/server';
import { getWorkspaceBySlackId, insertIncident } from '@helena/db';
import { extractFromImage } from '@helena/btl';
import { verifySlackSignature, fetchSlackFile, bufferToDataUrl } from '@/lib/slack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface SlackEventEnvelope {
  type: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    subtype?: string;
    channel?: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    files?: Array<{
      id: string;
      name?: string;
      mimetype?: string;
      url_private?: string;
      url_private_download?: string;
    }>;
  };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-slack-signature');
  const ts = req.headers.get('x-slack-request-timestamp');

  if (!verifySlackSignature(raw, sig, ts)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: SlackEventEnvelope;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  if (payload.type === 'url_verification' && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== 'event_callback' || !payload.event) {
    return NextResponse.json({ ok: true });
  }

  const ev = payload.event;
  const isTextMessage =
    ev.type === 'message' && !ev.bot_id && !ev.subtype && (ev.text || (ev.files && ev.files.length > 0));
  const isAppMention = ev.type === 'app_mention';

  if (!isTextMessage && !isAppMention) {
    return NextResponse.json({ ok: true });
  }

  if (!payload.team_id) {
    return NextResponse.json({ ok: true });
  }

  const workspace = await getWorkspaceBySlackId(payload.team_id);
  if (!workspace || !workspace.bot_token) {
    return NextResponse.json({ ok: true });
  }
  const botToken = workspace.bot_token;

  const captions: string[] = [];
  if (ev.files && ev.files.length > 0) {
    for (const f of ev.files) {
      const src = f.url_private_download ?? f.url_private;
      if (!src) continue;
      if (!f.mimetype?.startsWith('image/')) continue;
      const buf = await fetchSlackFile(src, botToken);
      if (!buf) continue;
      try {
        const vision = await extractFromImage({
          workspaceId: workspace.id,
          imageUrl: bufferToDataUrl(buf, f.mimetype),
          hint: ev.text
        });
        captions.push(vision.caption);
      } catch (e) {
        console.error('vision failed:', e);
      }
    }
  }

  const title = (ev.text ?? '').split('\n')[0]?.slice(0, 200) || 'Slack message';
  const body = ev.text ?? '';

  await insertIncident(workspace.id, {
    source: 'slack',
    severity: 'medium',
    externalId: ev.thread_ts ?? ev.ts,
    channel: ev.channel,
    title,
    body,
    screenshotCaptions: captions.length > 0 ? captions : undefined
  });

  return NextResponse.json({ ok: true });
}
