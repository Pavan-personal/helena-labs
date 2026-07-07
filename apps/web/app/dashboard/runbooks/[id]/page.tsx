import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
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
  const linkTo = (href: string) => href;

  const db = getServerClient();
  const isFullUuid = /^[0-9a-f-]{36}$/i.test(id);
  let runbook: Runbook | null = null;
  if (isFullUuid) {
    const { data } = await db
      .from('runbooks')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('id', id)
      .maybeSingle();
    runbook = (data as Runbook | null) ?? null;
  } else {
    // Supabase `.like` on a UUID column requires ::text cast, which the
    // client can't emit. Fetch workspace-scoped rows and prefix-filter
    // in JS. Cheap because runbook counts are small.
    const { data } = await db
      .from('runbooks')
      .select('*')
      .eq('workspace_id', workspace.id)
      .limit(200);
    const rows = (data as Runbook[]) ?? [];
    const prefix = id.toLowerCase();
    runbook = rows.find((r) => r.id.toLowerCase().startsWith(prefix)) ?? null;
  }
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
          <span className="px-2 py-0.5 rounded helena-alert-success">
            Approved
          </span>
          <span className="font-mono text-neutral-500">RB-{runbook.id.slice(0, 6)}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-app mb-2">
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

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-6 mb-6 text-sm text-neutral-200 leading-relaxed">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 className="text-app text-lg font-semibold mt-4 first:mt-0 mb-2">{children}</h2>,
            h2: ({ children }) => <h3 className="text-app text-base font-semibold mt-4 first:mt-0 mb-2">{children}</h3>,
            h3: ({ children }) => <h4 className="text-neutral-100 text-sm font-semibold mt-3 first:mt-0 mb-1.5">{children}</h4>,
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-app">{children}</strong>,
            em: ({ children }) => <em className="italic text-neutral-200">{children}</em>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-neutral-600">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-neutral-600">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            code: ({ children }) => (
              <code className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[12px] text-neutral-200 font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="my-3 rounded-lg bg-black/40 border border-neutral-900 p-3 overflow-x-auto text-[12px] font-mono">
                {children}
              </pre>
            ),
            hr: () => <hr className="my-4 border-neutral-900" />,
            a: ({ href, children }) => (
              <a href={href} className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                {children}
              </a>
            )
          }}
        >
          {runbook.content_md}
        </ReactMarkdown>
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
