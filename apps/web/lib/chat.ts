import type { WorkspaceRow } from '@helena/db';
import { postToSlack } from './slack';
import { postToDiscord } from './discord';

/**
 * Cross-platform chat abstraction. Dispatches by workspace.chat_platform.
 */
export async function postToChat(
  workspace: WorkspaceRow,
  channelId: string,
  text: string,
  slackThreadTs?: string
): Promise<void> {
  if (!workspace.bot_token) return;
  if (workspace.chat_platform === 'discord') {
    await postToDiscord(channelId, text, workspace.bot_token);
    return;
  }
  await postToSlack(channelId, text, workspace.bot_token, slackThreadTs);
}

export function slackToDiscordMarkdown(text: string): string {
  // Slack uses *bold* and _italic_; Discord uses **bold** and *italic*.
  // Also Slack code fences match Discord, so leave those alone.
  return text
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '**$1**')
    .replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, '*$1*');
}
