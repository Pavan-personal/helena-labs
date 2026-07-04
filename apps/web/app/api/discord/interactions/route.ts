import { NextResponse, after } from 'next/server';
import { loadEnv, computeDedupKey } from '@helena/shared';
import {
  getWorkspaceByDiscordGuildId,
  insertIncident,
  searchIncidents,
  getIncidentsByIds,
  type WorkspaceRow
} from '@helena/db';
import { rerankCandidates, synthesizeAnswer } from '@helena/btl';
import {
  verifyDiscordSignature,
  editDiscordInteractionResponse,
  fetchDiscordMessage
} from '@/lib/discord';
import { slackToDiscordMarkdown } from '@/lib/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const INTERACTION_TYPE_PING = 1;
const INTERACTION_TYPE_APPLICATION_COMMAND = 2;

const RESPONSE_TYPE_PONG = 1;
const RESPONSE_TYPE_CHANNEL_MESSAGE = 4;
const RESPONSE_TYPE_DEFERRED_MESSAGE = 5;

const COMMAND_TYPE_CHAT_INPUT = 1;
const COMMAND_TYPE_MESSAGE = 3;

interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
}

interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  data?: {
    id?: string;
    name?: string;
    type?: number;
    target_id?: string;
    resolved?: {
      messages?: Record<string, { content: string; author?: { username?: string; id?: string } }>;
    };
    options?: DiscordInteractionOption[];
  };
  member?: {
    user?: { id: string; username?: string };
  };
  user?: { id: string; username?: string };
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-signature-ed25519');
  const ts = req.headers.get('x-signature-timestamp');

  if (!verifyDiscordSignature(raw, sig, ts)) {
    return new NextResponse('bad signature', { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  if (interaction.type === INTERACTION_TYPE_PING) {
    return NextResponse.json({ type: RESPONSE_TYPE_PONG });
  }

  if (interaction.type !== INTERACTION_TYPE_APPLICATION_COMMAND) {
    return NextResponse.json({ type: RESPONSE_TYPE_CHANNEL_MESSAGE, data: { content: 'unknown interaction' } });
  }

  const commandName = interaction.data?.name ?? '';
  const commandType = interaction.data?.type ?? COMMAND_TYPE_CHAT_INPUT;

  const guildId = interaction.guild_id;
  if (!guildId) {
    return NextResponse.json({
      type: RESPONSE_TYPE_CHANNEL_MESSAGE,
      data: { content: 'Please run this in a server.', flags: 64 }
    });
  }

  const workspace = await getWorkspaceByDiscordGuildId(guildId);
  if (!workspace) {
    return NextResponse.json({
      type: RESPONSE_TYPE_CHANNEL_MESSAGE,
      data: {
        content: 'Helena is not installed on this server. Visit helenalabs.vercel.app to add it.',
        flags: 64
      }
    });
  }

  if (commandType === COMMAND_TYPE_MESSAGE && commandName === 'Save to helena') {
    return handleSaveMessage(interaction, workspace);
  }

  if (commandName === 'askoncall') {
    return handleAskOnCall(interaction, workspace);
  }

  return NextResponse.json({
    type: RESPONSE_TYPE_CHANNEL_MESSAGE,
    data: { content: `Unknown command: ${commandName}`, flags: 64 }
  });
}

async function handleSaveMessage(
  interaction: DiscordInteraction,
  workspace: WorkspaceRow
): Promise<NextResponse> {
  const targetId = interaction.data?.target_id;
  const resolvedMsg = targetId
    ? interaction.data?.resolved?.messages?.[targetId]
    : undefined;

  let content = resolvedMsg?.content ?? '';
  const author = resolvedMsg?.author?.username ?? 'unknown';

  if (!content && targetId && interaction.channel_id && workspace.bot_token) {
    const fetched = await fetchDiscordMessage(
      interaction.channel_id,
      targetId,
      workspace.bot_token
    );
    if (fetched) content = fetched.content ?? '';
  }

  if (!content) {
    return NextResponse.json({
      type: RESPONSE_TYPE_CHANNEL_MESSAGE,
      data: { content: 'That message has no readable text content.', flags: 64 }
    });
  }

  const title = content.split('\n')[0]?.slice(0, 200) || 'Discord message';
  const dedupKey = computeDedupKey({ source: 'discord', title });

  await insertIncident(workspace.id, {
    source: 'slack',
    severity: 'medium',
    externalId: targetId,
    channel: interaction.channel_id,
    title,
    body: `[${author}] ${content}`,
    dedupKey
  });

  return NextResponse.json({
    type: RESPONSE_TYPE_CHANNEL_MESSAGE,
    data: { content: `Saved to helena memory. Title: "${title}"`, flags: 64 }
  });
}

async function handleAskOnCall(
  interaction: DiscordInteraction,
  workspace: WorkspaceRow
): Promise<NextResponse> {
  const env = loadEnv();
  const query = String(
    interaction.data?.options?.find((o) => o.name === 'query')?.value ?? ''
  ).trim();

  if (!query) {
    return NextResponse.json({
      type: RESPONSE_TYPE_CHANNEL_MESSAGE,
      data: { content: 'Usage: /askoncall query:<describe the alert>', flags: 64 }
    });
  }

  after(async () => {
    try {
      const candidates = await searchIncidents(workspace.id, query, 30);
      if (candidates.length === 0) {
        await editDiscordInteractionResponse(
          env.DISCORD_APPLICATION_ID ?? interaction.application_id,
          interaction.token,
          'No matching incidents found in memory yet.'
        );
        return;
      }
      const ranked = await rerankCandidates({
        workspaceId: workspace.id,
        query,
        candidates: candidates.map((c) => ({ id: c.id, title: c.title, body: c.body }))
      });
      const topIds = ranked.slice(0, 5).map((r) => r.incidentId);
      const topIncidents = await getIncidentsByIds(topIds);
      const ordered = topIds
        .map((id) => topIncidents.find((i) => i.id === id))
        .filter((i): i is (typeof topIncidents)[number] => Boolean(i));
      if (ordered.length === 0) {
        await editDiscordInteractionResponse(
          env.DISCORD_APPLICATION_ID ?? interaction.application_id,
          interaction.token,
          'Found candidates but rerank returned nothing usable.'
        );
        return;
      }
      const synth = await synthesizeAnswer({
        workspaceId: workspace.id,
        query,
        incidents: ordered.map((i) => ({ id: i.id, title: i.title, body: i.body }))
      });
      const card = formatDiscordCard(query, synth);
      await editDiscordInteractionResponse(
        env.DISCORD_APPLICATION_ID ?? interaction.application_id,
        interaction.token,
        card
      );
    } catch (e) {
      console.error('askoncall pipeline failed:', e);
      await editDiscordInteractionResponse(
        env.DISCORD_APPLICATION_ID ?? interaction.application_id,
        interaction.token,
        `Pipeline error: ${e instanceof Error ? e.message : 'unknown'}`
      );
    }
  });

  return NextResponse.json({
    type: RESPONSE_TYPE_DEFERRED_MESSAGE,
    data: { content: `Searching for "${query}"...` }
  });
}

function formatDiscordCard(query: string, synth: {
  title: string;
  summary: string;
  pastResolutions: string[];
  suggestedCommands: string[];
  confidence: string;
}): string {
  const lines: string[] = [];
  lines.push(`**${synth.title}** _(confidence: ${synth.confidence})_`);
  lines.push(`> query: ${query}`);
  lines.push('');
  lines.push(slackToDiscordMarkdown(synth.summary));
  if (synth.pastResolutions.length > 0) {
    lines.push('');
    lines.push('**Past resolutions:**');
    for (const r of synth.pastResolutions) lines.push(`• ${slackToDiscordMarkdown(r)}`);
  }
  if (synth.suggestedCommands.length > 0) {
    lines.push('');
    lines.push('**Try:**');
    for (const c of synth.suggestedCommands) lines.push('```\n' + c + '\n```');
  }
  return lines.join('\n');
}
