import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/session';
import { joinChannelAction } from './actions';

export const dynamic = 'force-dynamic';

interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  num_members?: number;
}

async function listChannels(botToken: string): Promise<SlackChannel[]> {
  const url = new URL('https://slack.com/api/conversations.list');
  url.searchParams.set('exclude_archived', 'true');
  url.searchParams.set('types', 'public_channel');
  url.searchParams.set('limit', '200');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${botToken}` },
    cache: 'no-store'
  });
  const json = (await res.json()) as { ok: boolean; channels?: SlackChannel[]; error?: string };
  if (!json.ok) return [];
  return (json.channels ?? []).sort((a, b) => (b.num_members ?? 0) - (a.num_members ?? 0));
}

export default async function OnboardPage() {
  const workspace = await requireWorkspace();

  if (workspace.onboarded) {
    redirect('/dashboard');
  }

  const channels = await listChannels(workspace.bot_token);

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
          Helena will auto join this channel and start indexing messages, screenshots, and
          alerts posted here. You can change it later.
        </p>

        {channels.length === 0 ? (
          <div className="border border-red-900 bg-red-950 text-red-300 rounded-lg p-4 text-sm">
            Could not list channels. The bot might be missing the <code>channels:read</code>{' '}
            scope. Reinstall the Slack app if you added that scope after install.
          </div>
        ) : (
          <form action={joinChannelAction} className="space-y-4">
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
                    <div className="text-sm">#{c.name}</div>
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
              className="w-full px-5 py-2.5 rounded bg-white text-black font-medium hover:bg-neutral-200"
            >
              Join channel and continue
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
