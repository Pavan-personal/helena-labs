import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, User, Calendar, Link2 } from 'lucide-react';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { getServerClient } from '@helena/db';

export const dynamic = 'force-dynamic';

interface Runbook {
  id: string;
  title: string;
  content_md: string;
  source_incident_ids: string[];
  approved_by: string;
  approved_at: string;
}

export default async function RunbookDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hs?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const workspace = await requireWorkspace(sp.hs);
  const token = encodeSessionToken(workspace.id);
  const linkTo = (href: string) => `${href}?hs=${encodeURIComponent(token)}`;

  const db = getServerClient();
  const isFullUuid = /^[0-9a-f-]{36}$/i.test(id);
  let query = db
    .from('runbooks')
    .select('*')
    .eq('workspace_id', workspace.id)
    .limit(1);
  if (isFullUuid) {
    query = query.eq('id', id);
  } else {
    query = query.like('id', `${id.toLowerCase()}%`);
  }
  const { data } = await query.maybeSingle();
  const runbook = data as Runbook | null;
  if (!runbook) notFound();

  return (
    <div>
      <Link
        href={linkTo('/dashboard/runbooks')}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All runbooks
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
          <span className="px-2 py-0.5 rounded border border-emerald-900/60 bg-emerald-950/40 text-emerald-300">
            Approved
          </span>
          <span className="font-mono text-neutral-500">RB-{runbook.id.slice(0, 6)}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
          {runbook.title}
        </h1>
        <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" strokeWidth={1.75} />
            {runbook.approved_by}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" strokeWidth={1.75} />
            {new Date(runbook.approved_at).toLocaleString()}
          </span>
          {runbook.source_incident_ids?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" strokeWidth={1.75} />
              {runbook.source_incident_ids.length} source incident
              {runbook.source_incident_ids.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-6 mb-6">
        <article className="prose-runbook">
          <pre className="text-sm text-neutral-200 whitespace-pre-wrap break-words leading-relaxed font-sans">
            {runbook.content_md}
          </pre>
        </article>
      </div>

      {runbook.source_incident_ids && runbook.source_incident_ids.length > 0 && (
        <section>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
            Source incidents
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 divide-y divide-neutral-900">
            {runbook.source_incident_ids.map((incId) => (
              <Link
                key={incId}
                href={linkTo(`/dashboard/incidents/${incId.slice(0, 8)}`)}
                className="block px-4 py-2.5 text-xs text-neutral-400 hover:bg-neutral-900/40 hover:text-neutral-200 font-mono"
              >
                INC-{incId.slice(0, 8)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
