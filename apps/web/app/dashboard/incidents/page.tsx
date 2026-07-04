import { listIncidents } from '@helena/db';
import { requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SOURCE_STYLES: Record<string, string> = {
  slack: 'bg-blue-950 text-blue-300 border-blue-900',
  grafana: 'bg-orange-950 text-orange-300 border-orange-900',
  sentry: 'bg-purple-950 text-purple-300 border-purple-900',
  generic: 'bg-neutral-900 text-neutral-300 border-neutral-800',
  manual: 'bg-emerald-950 text-emerald-300 border-emerald-900'
};

export default async function IncidentsPage() {
  const workspace = await requireWorkspace();
  const incidents = await listIncidents(workspace.id, { limit: 200 });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Incidents</h1>

      {incidents.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm">
          No incidents ingested yet.
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg divide-y divide-neutral-800">
          {incidents.map((i) => {
            const style = SOURCE_STYLES[i.source] ?? SOURCE_STYLES.generic;
            return (
              <div key={i.id} className="p-4">
                <div className="flex items-start gap-3 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${style}`}>
                    {i.source}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded border border-neutral-800 text-neutral-400">
                    {i.severity}
                  </span>
                  <div className="text-sm font-medium flex-1">{i.title}</div>
                  <span className="text-xs text-neutral-600">
                    {new Date(i.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 line-clamp-3 pl-1">{i.body}</div>
                {i.screenshot_captions && i.screenshot_captions.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-600 italic">
                    Vision caption: {i.screenshot_captions[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
