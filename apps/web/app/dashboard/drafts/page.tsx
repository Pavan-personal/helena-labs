import { listDrafts } from '@helena/db';
import { requireWorkspace } from '@/lib/session';
import { approveDraftAction, rejectDraftAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const workspace = await requireWorkspace();
  const drafts = await listDrafts(workspace.id, 'draft');

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Runbook drafts</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Drafts are auto generated overnight from resolved incident threads. Approve to move into the
        runbooks library.
      </p>

      {drafts.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm">
          No drafts pending. Run the cron job or wait for resolved threads.
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => (
            <div key={d.id} className="border border-neutral-800 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-lg font-medium">{d.title}</h3>
                <span className="text-xs text-neutral-600">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-neutral-300 bg-neutral-950 border border-neutral-900 rounded p-3 max-h-64 overflow-auto">
                {d.content_md}
              </pre>
              <div className="flex gap-3 mt-4">
                <form action={approveDraftAction}>
                  <input type="hidden" name="draftId" value={d.id} />
                  <button className="px-3 py-1.5 rounded bg-green-600 text-app text-sm hover:bg-green-500">
                    Approve
                  </button>
                </form>
                <form action={rejectDraftAction}>
                  <input type="hidden" name="draftId" value={d.id} />
                  <button className="px-3 py-1.5 rounded border border-neutral-700 text-sm hover:border-neutral-500">
                    Reject
                  </button>
                </form>
                <span className="text-xs text-neutral-600 self-center">
                  Source incidents: {d.source_incident_ids.length}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
