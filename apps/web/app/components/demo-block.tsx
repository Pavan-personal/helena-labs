import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';

/**
 * Sidebar-sized "you can look but not connect" notice for the demo tenant.
 * Sits where the connect form would sit so demo visitors still see the
 * walkthrough above but can't submit tokens against the shared workspace.
 */
export function DemoConnectPanel({ brand }: { brand: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand }} />
        Demo workspace
      </div>

      <div className="flex items-start gap-3 mb-5">
        <div className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900/60 flex items-center justify-center shrink-0">
          <Lock className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
        </div>
        <div className="text-[12px] text-neutral-400 leading-relaxed">
          The form is disabled here so visitors don&rsquo;t share tokens across the same tenant.
          The steps on the left are exactly what you&rsquo;ll see on your own workspace.
        </div>
      </div>

      <div className="space-y-2">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-ink text-ink-fg text-sm font-medium hover:bg-neutral-200"
        >
          Install on Slack or Discord
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <Link
          href="/dashboard/copilot"
          className="flex items-center justify-center w-full px-3 py-2 rounded-lg border border-neutral-800 hover:border-neutral-600 text-sm text-neutral-200"
        >
          Try the Copilot
        </Link>
      </div>
    </div>
  );
}

/**
 * Full-page block for actions that are unsafe in the shared demo workspace
 * — connecting Grafana, Sentry, GitHub, or Slack/Discord installs. The
 * demo is a shared read-only sandbox and we never want a random visitor
 * writing their real tokens or triggering OAuth flows against it.
 */
export function DemoBlockNotice({
  title,
  detail
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Demo workspace</div>
        <h1 className="text-3xl font-semibold tracking-tight text-app mb-2">{title}</h1>
        <p className="text-sm text-neutral-400 leading-relaxed">{detail}</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900/60 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="text-sm text-neutral-400 leading-relaxed">
            You&rsquo;re in the shared read-only demo tenant. It has 71 seeded incidents and 13
            runbooks so you can explore the Copilot end-to-end, but connecting real integrations
            here would share tokens across every visitor. Install helena on your own team to
            wire up Grafana, Sentry, and GitHub against your own data.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-ink-fg text-sm font-medium hover:bg-neutral-200"
        >
          Install on Slack or Discord
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          href="/dashboard/copilot"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 hover:border-neutral-600 text-sm text-neutral-200"
        >
          Try the Copilot instead
        </Link>
      </div>
    </div>
  );
}
