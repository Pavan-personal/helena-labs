import Link from 'next/link';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { listThreads } from '@/lib/copilot/db';
import { CopilotChat } from './copilot-chat';

export const dynamic = 'force-dynamic';

export default async function CopilotPage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string; t?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
  const threads = await listThreads(workspace.id, 25);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
            Incident Copilot
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Ask helena anything about your incidents
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
            Chat has access to your entire incident memory. Routes across DeepSeek Flash for
            classification and DeepSeek Pro for reasoning. Every claim is verified against a
            citation before it&rsquo;s shown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-14rem)] min-h-[520px]">
        <aside className="border border-neutral-800 rounded-xl bg-neutral-950/40 overflow-y-auto scrollbar-none">
          <div className="p-3 border-b border-neutral-900 sticky top-0 bg-neutral-950/60 backdrop-blur">
            <Link
              href="/dashboard/copilot"
              className="block px-3 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium text-center hover:bg-neutral-100"
            >
              + New chat
            </Link>
          </div>
          <div className="p-2 space-y-0.5">
            {threads.length === 0 && (
              <div className="text-xs text-neutral-500 p-3">No previous threads.</div>
            )}
            {threads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/copilot?t=${t.id}`}
                className={`block px-3 py-2 rounded-md text-xs transition-colors ${
                  params.t === t.id
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                }`}
                title={t.title}
              >
                <div className="truncate">{t.title}</div>
                <div className="text-[10px] text-neutral-600 mt-0.5">
                  {new Date(t.updated_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </aside>

        <CopilotChat token={token} initialThreadId={params.t ?? null} />
      </div>
    </div>
  );
}
