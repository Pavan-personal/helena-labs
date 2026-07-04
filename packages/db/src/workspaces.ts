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
 * Fallback for local dev: seeds a default workspace so ingest endpoints work
 * without requiring the full Slack OAuth install flow.
 */
export async function getDefaultWorkspace(): Promise<WorkspaceRow> {
  return getOrCreateWorkspace({
    slackTeamId: 'default',
    slackTeamName: 'Default',
    botToken: process.env.SLACK_BOT_TOKEN ?? 'xoxb_placeholder'
  });
}
