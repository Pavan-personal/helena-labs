import { listIncidents, listDrafts, listRunbooks, usageSummary } from '@helena/db';
import { requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const workspace = await requireWorkspace();
  const [incidents, drafts, runbooks, usage] = await Promise.all([
    listIncidents(workspace.id, { limit: 10 }),
    listDrafts(workspace.id, 'draft'),
    listRunbooks(workspace.id),
    usageSummary(workspace.id)
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Incidents ingested" value={String(incidents.length)} hint="last 10 shown" />
        <Stat label="Drafts pending review" value={String(drafts.length)} />
        <Stat label="Approved runbooks" value={String(runbooks.length)} />
        <Stat
          label="Cost this window"
          value={`$${(usage.totalCostCents / 100).toFixed(4)}`}
          hint="approx"
        />
      </div>

      <h2 className="text-lg font-medium mb-3">Recent incidents</h2>
      <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800">
        {incidents.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">No incidents yet. Post a message in your Slack channel.</div>
        ) : (
          incidents.map((i) => (
            <div key={i.id} className="p-4 flex items-start gap-4">
              <span className="text-xs uppercase text-neutral-500 w-20 mt-1">{i.source}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{i.title}</div>
                <div className="text-xs text-neutral-500 line-clamp-2">{i.body}</div>
              </div>
              <span className="text-xs text-neutral-600">
                {new Date(i.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <div className="text-xs uppercase text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      {hint && <div className="text-xs text-neutral-600 mt-1">{hint}</div>}
    </div>
  );
}
