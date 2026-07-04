import { getServerClient } from './client';

export interface WorkspaceRow {
  id: string;
  slack_team_id: string;
  slack_team_name: string;
  bot_token: string;
  webhook_secret: string;
  installer_email: string | null;
  installer_user_id: string | null;
  incident_channel_id: string | null;
  incident_channel_name: string | null;
  onboarded: boolean;
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

export async function getWorkspaceById(id: string): Promise<WorkspaceRow | null> {
  const db = getServerClient();
  const { data } = await db
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as WorkspaceRow) ?? null;
}

export async function getWorkspaceBySecret(secret: string): Promise<WorkspaceRow | null> {
  const db = getServerClient();
  const { data } = await db
    .from('workspaces')
    .select('*')
    .eq('webhook_secret', secret)
    .maybeSingle();
  return (data as WorkspaceRow) ?? null;
}

export interface UpsertWorkspaceFromSlackInput {
  slackTeamId: string;
  slackTeamName: string;
  botToken: string;
  installerUserId?: string;
  installerEmail?: string;
}

/**
 * Called after a successful Slack OAuth exchange. Creates the workspace row
 * if new, updates the bot_token if the team reinstalls. Never overwrites the
 * webhook_secret so existing Grafana/Sentry contact points keep working.
 */
export async function upsertWorkspaceFromSlack(
  input: UpsertWorkspaceFromSlackInput
): Promise<WorkspaceRow> {
  const db = getServerClient();

  const { data: existing } = await db
    .from('workspaces')
    .select('*')
    .eq('slack_team_id', input.slackTeamId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await db
      .from('workspaces')
      .update({
        slack_team_name: input.slackTeamName,
        bot_token: input.botToken,
        installer_user_id: input.installerUserId ?? (existing as WorkspaceRow).installer_user_id,
        installer_email: input.installerEmail ?? (existing as WorkspaceRow).installer_email
      })
      .eq('id', (existing as WorkspaceRow).id)
      .select('*')
      .single();
    if (error || !data) throw new Error(`Update workspace failed: ${error?.message}`);
    return data as WorkspaceRow;
  }

  const { data, error } = await db
    .from('workspaces')
    .insert({
      slack_team_id: input.slackTeamId,
      slack_team_name: input.slackTeamName,
      bot_token: input.botToken,
      installer_user_id: input.installerUserId ?? null,
      installer_email: input.installerEmail ?? null
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert workspace failed: ${error?.message}`);
  return data as WorkspaceRow;
}

export async function setIncidentChannel(
  workspaceId: string,
  channelId: string,
  channelName: string
): Promise<void> {
  const db = getServerClient();
  await db
    .from('workspaces')
    .update({
      incident_channel_id: channelId,
      incident_channel_name: channelName,
      onboarded: true
    })
    .eq('id', workspaceId);
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
