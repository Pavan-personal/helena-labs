import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';
import { listRunbooks } from '@helena/db';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function RunbooksPage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
  const linkTo = (href: string) => href;
  const runbooks = await listRunbooks(workspace.id);

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Memory</div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Runbooks</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Permanent, approved knowledge. Drafts get here after review.
        </p>
      </div>

      {runbooks.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-12 text-center">
          <BookOpen
            className="h-8 w-8 text-neutral-700 mx-auto mb-3"
            strokeWidth={1.5}
          />
          <div className="text-sm text-neutral-400 mb-1">No runbooks yet.</div>
          <div className="text-xs text-neutral-500">
            Approve a draft in the{' '}
            <Link
              href={linkTo('/dashboard/drafts')}
              className="text-sky-400 hover:text-sky-300"
            >
              Runbook drafts
            </Link>{' '}
            page.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {runbooks.map((r) => (
            <Link
              key={r.id}
              href={linkTo(`/dashboard/runbooks/${r.id.slice(0, 8)}`)}
              className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 hover:border-neutral-700 transition-colors group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg border border-neutral-800 bg-neutral-900 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-100 group-hover:text-white line-clamp-2">
                    {r.title}
                  </div>
                  <div className="text-[10px] text-neutral-600 mt-1 font-mono">
                    RB-{r.id.slice(0, 6)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400 shrink-0" />
              </div>
              <div className="text-xs text-neutral-500 line-clamp-3">
                {r.content_md.slice(0, 240)}
              </div>
              <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-between text-[10px] text-neutral-600">
                <span>{r.approved_by}</span>
                <span>{new Date(r.approved_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
