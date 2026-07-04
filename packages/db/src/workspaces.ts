import { getServerClient } from './client';

export interface WorkspaceRow {
  id: string;
  slack_team_id: string;
  slack_team_name: string;
  bot_token: string;
  created_at: string;
}

export async function getOrCreateWorkspace(input: {
  slackTeamId: string;
  slackTeamName: string;
  botToken: string;
}): Promise<WorkspaceRow> {
  const db = getServerClient();

  const { data: existing } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', input.slackTeamId)
    .maybeSingle();

  if (existing) return existing as WorkspaceRow;

  const { data, error } = await db
    .from('workspaces')
    .insert({
      slack_team_id: input.slackTeamId,
      slack_team_name: input.slackTeamName,
      bot_token: input.botToken
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(`Failed to create workspace: ${error?.message}`);
  return data as WorkspaceRow;
}

export async function getWorkspaceBySlackId(slackTeamId: string): Promise<WorkspaceRow | null> {
  const db = getServerClient();
  const { data } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', slackTeamId)
    .maybeSingle();
  return (data as WorkspaceRow) ?? null;
}

/**
 * Returns the first workspace row for the dashboard and cron jobs.
 * For the hackathon single-tenant demo, this reads whichever workspace was
 * first created by an event ingest (Slack install, webhook, etc). If none
 * exists yet, it seeds one so ingest endpoints have something to write into.
 */
export async function getDefaultWorkspace(): Promise<WorkspaceRow> {
  const db = getServerClient();

  // Prefer a real Slack team over the seed fallback so the dashboard shows
  // ingested data even when a leftover 'default' seed row exists.
  const { data: real } = await db
    .from('workspaces')
    .select('*')
    .neq('slack_team_id', 'default')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (real) return real as WorkspaceRow;

  const { data: fallback } = await db
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback) return fallback as WorkspaceRow;

  return getOrCreateWorkspace({
    slackTeamId: 'default',
    slackTeamName: 'Default',
    botToken: process.env.SLACK_BOT_TOKEN ?? 'xoxb_placeholder'
  });
}
