import { listRunbooks } from '@helena/db';
import { requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function RunbooksPage() {
  const workspace = await requireWorkspace();
  const runbooks = await listRunbooks(workspace.id);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Approved runbooks</h1>

      {runbooks.length === 0 ? (
        <div className="border border-neutral-800 rounded-lg p-8 text-center text-neutral-500 text-sm">
          No runbooks approved yet. Approve drafts from the drafts page.
        </div>
      ) : (
        <div className="space-y-4">
          {runbooks.map((r) => (
            <details key={r.id} className="border border-neutral-800 rounded-lg">
              <summary className="p-4 cursor-pointer flex items-center justify-between">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-neutral-500">
                  approved by {r.approved_by} · {new Date(r.approved_at).toLocaleDateString()}
                </span>
              </summary>
              <div className="border-t border-neutral-800 p-4">
                <pre className="whitespace-pre-wrap text-sm text-neutral-300">{r.content_md}</pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
