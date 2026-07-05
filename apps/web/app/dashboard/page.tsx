import Link from 'next/link';
import { listIncidents, listDrafts, listRunbooks, usageSummary } from '@helena/db';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  slack: 'Slack',
  grafana: 'Grafana',
  sentry: 'Sentry',
  generic: 'Generic',
  manual: 'Manual'
};

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-neutral-900 text-neutral-400 border-neutral-800',
  medium: 'bg-yellow-950 text-yellow-300 border-yellow-900',
  high: 'bg-orange-950 text-orange-300 border-orange-900',
  critical: 'bg-red-950 text-red-300 border-red-900'
};

export default async function DashboardHome() {
  const workspace = await requireWorkspace();
  const token = encodeSessionToken(workspace.id);
  const linkTo = (href: string) => `${href}?hs=${encodeURIComponent(token)}`;
  const [incidents, drafts, runbooks, usage] = await Promise.all([
    listIncidents(workspace.id, { limit: 8 }),
    listDrafts(workspace.id, 'draft'),
    listRunbooks(workspace.id),
    usageSummary(workspace.id)
  ]);

  const workspaceName =
    workspace.chat_platform === 'discord'
      ? workspace.discord_guild_name
      : workspace.slack_team_name;

  const recentSources = new Set(incidents.map((i) => i.source));

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          {workspace.chat_platform === 'discord' ? 'Discord server' : 'Slack workspace'}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
          {workspaceName ?? 'helena workspace'}
        </h1>
        <div className="text-sm text-neutral-500">
          {workspace.incident_channel_name ? (
            <>
              Ingesting from <span className="text-neutral-300">#{workspace.incident_channel_name}</span>
              {' · '}
              <span className="text-neutral-500">{recentSources.size} active source{recentSources.size === 1 ? '' : 's'}</span>
            </>
          ) : (
            <span className="text-yellow-500">No incident channel selected yet.</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-10">
        <Stat label="Incidents" value={String(incidents.length)} hint="last 8 shown below" />
        <Stat label="Drafts pending" value={String(drafts.length)} hint={drafts.length > 0 ? 'review to approve' : 'nothing to review'} />
        <Stat label="Approved runbooks" value={String(runbooks.length)} hint="permanent memory" />
        <Stat label="BTL spend" value={`$${(usage.totalCostCents / 100).toFixed(4)}`} hint={`${usage.totalTokensIn.toLocaleString()} in · ${usage.totalTokensOut.toLocaleString()} out`} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-widest text-neutral-500">Recent incidents</h2>
            <Link
              href={linkTo('/dashboard/incidents')}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-neutral-800 divide-y divide-neutral-800 bg-neutral-950/40">
            {incidents.length === 0 ? (
              <div className="p-6 text-sm text-neutral-500 text-center">
                No incidents indexed yet. Post a message in{' '}
                <code>#{workspace.incident_channel_name ?? 'incidents'}</code>, or wire up Grafana / Sentry to start feeding memory.
              </div>
            ) : (
              incidents.map((i) => (
                <div key={i.id} className="p-4 flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 w-16 text-center">
                      {SOURCE_LABEL[i.source] ?? i.source}
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[i.severity] ?? SEVERITY_STYLES.medium}`}
                    >
                      {i.severity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-200 truncate" title={i.title}>
                      {i.title}
                    </div>
                    <div className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                      {i.body || 'No body content'}
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-600 shrink-0 tabular-nums">
                    {formatRelative(i.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-3">Runtime cost</h2>
            <div className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/40 space-y-2">
              {usage.byRole.length === 0 ? (
                <div className="text-xs text-neutral-500">
                  No BTL calls yet. Trigger a <code>/askoncall</code> to see live cost per role.
                </div>
              ) : (
                usage.byRole
                  .sort((a, b) => b.costCents - a.costCents)
                  .map((r) => (
                    <div key={r.role} className="flex items-center justify-between text-xs">
                      <div className="text-neutral-400">{r.role}</div>
                      <div className="text-neutral-500 tabular-nums">
                        {r.count} × ${(r.costCents / 100).toFixed(4)}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-3">Quick actions</h2>
            <div className="space-y-2">
              <QuickAction
                label="Configure integrations"
                subtitle="Wire up Grafana / Sentry"
                href={linkTo('/dashboard/integrations')}
              />
              <QuickAction
                label="Review runbook drafts"
                subtitle={drafts.length > 0 ? `${drafts.length} pending` : 'None pending'}
                href={linkTo('/dashboard/drafts')}
              />
              <QuickAction
                label="Approved runbooks"
                subtitle={`${runbooks.length} in library`}
                href={linkTo('/dashboard/runbooks')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-4 bg-neutral-950/40">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-white tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-neutral-600 mt-1 truncate">{hint}</div>}
    </div>
  );
}

function QuickAction({ label, subtitle, href }: { label: string; subtitle: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-800 hover:border-neutral-700 p-3 bg-neutral-950/40 transition-colors group"
    >
      <div className="text-sm text-neutral-200 group-hover:text-white">{label}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
