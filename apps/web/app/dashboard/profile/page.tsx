import { requireWorkspace } from '@/lib/session';
import { SignOutButton } from '@/app/components/session-sync';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const workspace = await requireWorkspace();

  const workspaceName =
    workspace.chat_platform === 'discord'
      ? workspace.discord_guild_name ?? 'Discord server'
      : workspace.slack_team_name ?? 'Slack workspace';
  const externalId = workspace.chat_platform === 'discord'
    ? workspace.discord_guild_id
    : workspace.slack_team_id;

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Account</div>
        <h1 className="text-3xl font-semibold tracking-tight text-app mb-1">Profile</h1>
        <p className="text-sm text-neutral-500">
          Who is installed, where the workspace lives, and how to sign out.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Installer</div>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 text-lg">
            {workspace.installer_email ? workspace.installer_email[0]?.toUpperCase() : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-neutral-200 truncate">
              {workspace.installer_email ?? 'Email not shared during install'}
            </div>
            {workspace.installer_user_id && (
              <div className="text-xs text-neutral-500 font-mono truncate">
                {workspace.chat_platform === 'discord' ? 'Discord user' : 'Slack user'}
                {' '}·{' '}{workspace.installer_user_id}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Workspace</div>
        <Row label="Name" value={workspaceName} />
        <Row label="Platform" value={workspace.chat_platform === 'discord' ? 'Discord' : 'Slack'} />
        <Row label={workspace.chat_platform === 'discord' ? 'Guild ID' : 'Team ID'} value={externalId ?? '—'} mono />
        <Row
          label="Incident channel"
          value={
            workspace.incident_channel_name
              ? `#${workspace.incident_channel_name}`
              : 'Not selected'
          }
        />
        <Row
          label="Installed"
          value={new Date(workspace.created_at).toLocaleString()}
        />
        <Row label="Workspace ID" value={workspace.id} mono />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Webhook secret</div>
        <p className="text-sm text-neutral-400 mb-3">
          Used to authenticate incoming Grafana / Sentry / generic webhooks. Do not share.
        </p>
        <code className="block px-3 py-2 bg-neutral-950 border border-neutral-900 rounded text-xs text-neutral-400 truncate">
          {workspace.webhook_secret}
        </code>
      </div>

      <div className="rounded-xl helena-alert-error p-5">
        <div className="text-xs uppercase tracking-widest opacity-70 mb-3">Danger zone</div>
        <p className="text-sm mb-4 opacity-90">
          Signing out only clears your browser session. Your workspace and data stay intact.
        </p>
        <SignOutButton className="inline-flex items-center px-4 py-2 rounded helena-alert-error text-sm hover:brightness-95 transition-all">
          Sign out of helena
        </SignOutButton>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-4 py-1.5">
      <div className="text-xs text-neutral-500 w-32 shrink-0">{label}</div>
      <div className={`text-sm text-neutral-200 truncate ${mono ? 'font-mono text-xs text-neutral-400' : ''}`} title={value}>
        {value}
      </div>
    </div>
  );
}
