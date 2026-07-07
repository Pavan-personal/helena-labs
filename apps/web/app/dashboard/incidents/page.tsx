import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { listIncidents } from '@helena/db';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SOURCE_STYLES: Record<string, string> = {
  slack: 'bg-blue-950/60 text-blue-300 border-blue-900/60',
  discord: 'bg-indigo-950/60 text-indigo-300 border-indigo-900/60',
  grafana: 'bg-orange-950/60 text-orange-300 border-orange-900/60',
  sentry: 'bg-purple-950/60 text-purple-300 border-purple-900/60',
  github: 'bg-neutral-800 text-neutral-200 border-neutral-700',
  generic: 'bg-neutral-900 text-neutral-400 border-neutral-800',
  manual: 'helena-alert-success'
};

const SEV_STYLES: Record<string, string> = {
  low: 'bg-neutral-900 text-neutral-400 border-neutral-800',
  medium: 'bg-yellow-950/50 text-yellow-300 border-yellow-900/60',
  high: 'bg-orange-950/60 text-orange-300 border-orange-900/60',
  critical: 'helena-alert-error'
};

export default async function IncidentsPage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
  const linkTo = (href: string) => href;
  const incidents = await listIncidents(workspace.id, { limit: 200 });

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Memory</div>
        <h1 className="text-3xl font-semibold tracking-tight text-app">Incidents</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Every message, alert, and event indexed for retrieval. Click any row for the full context.
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-12 text-center">
          <div className="text-sm text-neutral-400 mb-1">No incidents ingested yet.</div>
          <div className="text-xs text-neutral-500">
            Wire up an integration or post a message in your incident channel.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 divide-y divide-neutral-900">
          {incidents.map((i) => {
            const source = SOURCE_STYLES[i.source] ?? SOURCE_STYLES.generic;
            const sev = SEV_STYLES[i.severity] ?? SEV_STYLES.medium;
            return (
              <Link
                key={i.id}
                href={linkTo(`/dashboard/incidents/${i.id.slice(0, 8)}`)}
                className="block p-4 hover:bg-neutral-900/40 transition-colors group"
              >
                <div className="flex items-start gap-3 mb-1.5">
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${source}`}
                  >
                    {i.source}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${sev}`}
                  >
                    {i.severity}
                  </span>
                  <span className="text-[10px] text-neutral-600 font-mono">
                    INC-{i.id.slice(0, 6)}
                  </span>
                  <div className="text-sm font-medium text-neutral-100 flex-1 truncate group-hover:text-app">
                    {i.title}
                  </div>
                  <span className="text-[10px] text-neutral-600 shrink-0 tabular-nums">
                    {formatRelative(i.created_at)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-neutral-400" />
                </div>
                <div className="text-xs text-neutral-500 line-clamp-2 pl-1">
                  {i.body || 'No body content'}
                </div>
                {i.screenshot_captions && i.screenshot_captions.length > 0 && (
                  <div className="mt-1.5 text-[11px] text-neutral-600 italic pl-1">
                    Vision: {i.screenshot_captions[0]}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
