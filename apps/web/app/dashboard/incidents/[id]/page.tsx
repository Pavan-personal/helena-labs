import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Hash, Tag, AtSign, MessageCircle } from 'lucide-react';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { getServerClient } from '@helena/db';
import type { IncidentRow } from '@helena/shared';

export const dynamic = 'force-dynamic';

const SOURCE_COLOR: Record<string, string> = {
  slack: 'bg-blue-950/60 text-blue-300 border-blue-900/60',
  discord: 'bg-indigo-950/60 text-indigo-300 border-indigo-900/60',
  grafana: 'bg-orange-950/60 text-orange-300 border-orange-900/60',
  sentry: 'bg-purple-950/60 text-purple-300 border-purple-900/60',
  github: 'bg-neutral-800 text-neutral-200 border-neutral-700',
  generic: 'bg-neutral-900 text-neutral-400 border-neutral-800',
  manual: 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
};

const SEV_COLOR: Record<string, string> = {
  low: 'bg-neutral-900 text-neutral-400 border-neutral-800',
  medium: 'bg-yellow-950/50 text-yellow-300 border-yellow-900/60',
  high: 'bg-orange-950/60 text-orange-300 border-orange-900/60',
  critical: 'bg-red-950/60 text-red-300 border-red-900/60'
};

export default async function IncidentDetailPage({
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
  let query = db
    .from('incidents')
    .select('*')
    .eq('workspace_id', workspace.id)
    .limit(1);

  // Support both full UUID and 8-char prefix
  const isFullUuid = /^[0-9a-f-]{36}$/i.test(id);
  if (isFullUuid) {
    query = query.eq('id', id);
  } else {
    query = query.like('id', `${id.toLowerCase()}%`);
  }

  const { data } = await query.maybeSingle();
  const incident = data as IncidentRow | null;
  if (!incident) notFound();

  const extracted = incident.extracted_json as Record<string, unknown> | null;

  return (
    <div>
      <Link
        href={linkTo('/dashboard/incidents')}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All incidents
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-widest border ${
              SOURCE_COLOR[incident.source] ?? SOURCE_COLOR.generic
            }`}
          >
            {incident.source}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-widest border ${
              SEV_COLOR[incident.severity] ?? SEV_COLOR.medium
            }`}
          >
            {incident.severity}
          </span>
          <span className="text-[11px] text-neutral-500 font-mono">
            INC-{incident.id.slice(0, 6)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">
          {incident.title}
        </h1>
        <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" strokeWidth={1.75} />
            {new Date(incident.created_at).toLocaleString()}
          </span>
          {incident.channel && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" strokeWidth={1.75} />
              {incident.channel}
            </span>
          )}
          {incident.external_id && (
            <span className="inline-flex items-center gap-1 font-mono">
              <Hash className="h-3 w-3" strokeWidth={1.75} />
              {incident.external_id.slice(0, 24)}
            </span>
          )}
        </div>
      </div>

      {incident.body && (
        <section className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Body</div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
            <pre className="text-sm text-neutral-300 whitespace-pre-wrap break-words leading-relaxed font-sans">
              {incident.body}
            </pre>
          </div>
        </section>
      )}

      {incident.screenshot_captions && incident.screenshot_captions.length > 0 && (
        <section className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
            Vision captions
          </div>
          <div className="space-y-2">
            {incident.screenshot_captions.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs text-neutral-400 italic"
              >
                {c}
              </div>
            ))}
          </div>
        </section>
      )}

      {extracted && Object.keys(extracted).length > 0 && (
        <section className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
            Extracted metadata
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 overflow-x-auto scrollbar-thin">
            <pre className="text-xs text-neutral-400 whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(extracted, null, 2)}
            </pre>
          </div>
        </section>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-xs text-neutral-500">
        <div className="flex items-center gap-2 mb-1.5 text-neutral-400">
          <AtSign className="h-3.5 w-3.5" strokeWidth={1.75} />
          Ask the Copilot about this
        </div>
        <Link
          href={linkTo('/dashboard/copilot')}
          className="text-sky-400 hover:text-sky-300"
        >
          Open Copilot → &quot;What did we do about INC-{incident.id.slice(0, 6)}?&quot;
        </Link>
      </div>
    </div>
  );
}
