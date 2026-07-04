import { NextResponse, after } from 'next/server';
import { getOrCreateWorkspace, searchIncidents, getIncidentsByIds } from '@helena/db';
import { rerankCandidates, synthesizeAnswer } from '@helena/btl';
import { verifySlackSignature, postToSlack } from '@/lib/slack';
import { loadEnv } from '@helena/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-slack-signature');
  const ts = req.headers.get('x-slack-request-timestamp');

  if (!verifySlackSignature(raw, sig, ts)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const params = new URLSearchParams(raw);
  const teamId = params.get('team_id') ?? 'default';
  const channelId = params.get('channel_id') ?? '';
  const text = (params.get('text') ?? '').trim();
  const responseUrl = params.get('response_url');

  if (!text) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: /askoncall <describe the alert or symptom>'
    });
  }

  const env = loadEnv();
  const workspace = await getOrCreateWorkspace({
    slackTeamId: teamId,
    slackTeamName: teamId,
    botToken: env.SLACK_BOT_TOKEN
  });

  // Ack immediately with an ephemeral holding message.
  // after() keeps the serverless runtime alive so the pipeline can post via response_url.
  after(async () => {
    try {
      await processQuery({
        workspaceId: workspace.id,
        query: text,
        channelId,
        responseUrl,
        botToken: workspace.bot_token
      });
    } catch (e) {
      console.error('processQuery failed:', e);
      if (responseUrl) {
        await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response_type: 'ephemeral',
            text: `Pipeline error: ${e instanceof Error ? e.message : 'unknown'}`
          })
        });
      }
    }
  });

  return NextResponse.json({
    response_type: 'ephemeral',
    text: `Searching incident memory for "${text}"...`
  });
}

interface QueryContext {
  workspaceId: string;
  query: string;
  channelId: string;
  responseUrl: string | null;
  botToken: string;
}

async function processQuery(ctx: QueryContext): Promise<void> {
  const candidates = await searchIncidents(ctx.workspaceId, ctx.query, 30);

  if (candidates.length === 0) {
    await replyToSlack(ctx, 'No matching incidents found in memory yet.');
    return;
  }

  const ranked = await rerankCandidates({
    workspaceId: ctx.workspaceId,
    query: ctx.query,
    candidates: candidates.map((c) => ({ id: c.id, title: c.title, body: c.body }))
  });

  const topIds = ranked.slice(0, 5).map((r) => r.incidentId);
  const topIncidents = await getIncidentsByIds(topIds);
  const orderedIncidents = topIds
    .map((id) => topIncidents.find((i) => i.id === id))
    .filter((i): i is (typeof topIncidents)[number] => Boolean(i));

  if (orderedIncidents.length === 0) {
    await replyToSlack(ctx, 'Found candidates but rerank returned nothing usable.');
    return;
  }

  const synth = await synthesizeAnswer({
    workspaceId: ctx.workspaceId,
    query: ctx.query,
    incidents: orderedIncidents.map((i) => ({ id: i.id, title: i.title, body: i.body }))
  });

  const card = formatSlackCard(ctx.query, synth);
  await replyToSlack(ctx, card);
}

function formatSlackCard(query: string, synth: {
  title: string;
  summary: string;
  pastResolutions: string[];
  suggestedCommands: string[];
  confidence: string;
}): string {
  const lines: string[] = [];
  lines.push(`*${synth.title}* _(confidence: ${synth.confidence})_`);
  lines.push(`> query: ${query}`);
  lines.push('');
  lines.push(synth.summary);
  if (synth.pastResolutions.length > 0) {
    lines.push('');
    lines.push('*Past resolutions:*');
    for (const r of synth.pastResolutions) lines.push(`• ${r}`);
  }
  if (synth.suggestedCommands.length > 0) {
    lines.push('');
    lines.push('*Try:*');
    for (const c of synth.suggestedCommands) lines.push('```' + c + '```');
  }
  return lines.join('\n');
}

async function replyToSlack(ctx: QueryContext, text: string): Promise<void> {
  if (ctx.responseUrl) {
    await fetch(ctx.responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'in_channel', text })
    });
    return;
  }
  if (ctx.channelId) {
    await postToSlack(ctx.channelId, text, ctx.botToken);
  }
}
