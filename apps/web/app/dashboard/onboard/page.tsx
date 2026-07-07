import { redirect } from 'next/navigation';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { fetchDiscordChannels } from '@/lib/discord';

export const dynamic = 'force-dynamic';

interface Channel {
  id: string;
  name: string;
  is_private?: boolean;
  num_members?: number;
}

async function listSlackChannels(botToken: string): Promise<Channel[]> {
  const url = new URL('https://slack.com/api/conversations.list');
  url.searchParams.set('exclude_archived', 'true');
  url.searchParams.set('types', 'public_channel');
  url.searchParams.set('limit', '200');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${botToken}` },
    cache: 'no-store'
  });
  const json = (await res.json()) as { ok: boolean; channels?: Channel[]; error?: string };
  if (!json.ok) return [];
  return (json.channels ?? []).sort((a, b) => (b.num_members ?? 0) - (a.num_members ?? 0));
}

export default async function OnboardPage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);

  if (workspace.onboarded) {
    redirect('/dashboard');
  }

  let channels: Channel[] = [];
  if (workspace.chat_platform === 'discord' && workspace.discord_guild_id && workspace.bot_token) {
    const discordChannels = await fetchDiscordChannels(workspace.bot_token, workspace.discord_guild_id);
    channels = discordChannels.map((c) => ({ id: c.id, name: c.name }));
  } else if (workspace.bot_token) {
    channels = await listSlackChannels(workspace.bot_token);
  }

  const platformName = workspace.chat_platform === 'discord' ? 'Discord' : 'Slack';
  const channelPrefix = workspace.chat_platform === 'discord' ? '#' : '#';

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full">
        <div className="mb-3 text-xs uppercase tracking-widest text-neutral-500">
          Setup · Step 1 of 1
        </div>
        <h1 className="text-3xl font-bold mb-4 tracking-tight">
          Which channel is your incident channel?
        </h1>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          Helena will start indexing messages, screenshots, and alerts posted here.
          {workspace.chat_platform === 'slack' && ' We auto join the channel for you.'}
        </p>

        {channels.length === 0 ? (
          <div className="helena-alert-error rounded-lg p-4 text-sm">
            Could not list {platformName} channels. Check that the bot has permission to see channels.
            {workspace.chat_platform === 'slack' && ' Reinstall the app if scopes changed.'}
          </div>
        ) : (
          <form action="/api/onboard/select-channel" method="POST" className="space-y-4">
            <input type="hidden" name="hs" value={token} />
            <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800 max-h-96 overflow-auto">
              {channels.map((c, i) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-neutral-900"
                >
                  <input
                    type="radio"
                    name="channel"
                    value={`${c.id}|${c.name}`}
                    defaultChecked={i === 0}
                    className="accent-white"
                    required
                  />
                  <div className="flex-1">
                    <div className="text-sm">
                      {channelPrefix}
                      {c.name}
                    </div>
                    {c.num_members !== undefined && (
                      <div className="text-xs text-neutral-500">
                        {c.num_members.toLocaleString()} members
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="w-full px-5 py-2.5 rounded bg-ink text-ink-fg font-medium hover:bg-neutral-200"
            >
              Select channel and continue
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
