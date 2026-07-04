import Link from 'next/link';
import { getWorkspaceFromSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ install_error?: string; signed_out?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspaceFromSession();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="mb-3 text-xs uppercase tracking-widest text-neutral-500">helena</div>
        <h1 className="text-5xl font-bold mb-4 tracking-tight leading-tight">
          Incident memory for on call teams.
        </h1>
        <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
          Every past fix, quietly indexed. When a new alert fires, we surface the resolution
          your team already worked out. Ingests from Slack, Grafana, and Sentry.
        </p>

        {params.install_error && (
          <div className="border border-red-900 bg-red-950 text-red-300 rounded-lg p-3 mb-6 text-sm">
            Install failed: {params.install_error}. Try again.
          </div>
        )}

        {params.signed_out && (
          <div className="border border-neutral-800 rounded-lg p-3 mb-6 text-sm text-neutral-400">
            Signed out.
          </div>
        )}

        {workspace ? (
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded bg-white text-black font-medium hover:bg-neutral-200"
            >
              Open {workspace.slack_team_name} dashboard
            </Link>
            <Link
              href="/api/auth/signout"
              className="px-5 py-2.5 rounded border border-neutral-700 hover:border-neutral-500"
            >
              Sign out
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 items-center">
            <a
              href="/api/auth/slack/install"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-white text-black font-medium hover:bg-neutral-200"
            >
              <SlackIcon />
              Add to Slack
            </a>
            <span className="text-sm text-neutral-500">Free to try. One click install.</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-16">
          <Feature title="Multi source ingest">
            Slack messages, Grafana alerts, Sentry issues, or any webhook post
          </Feature>
          <Feature title="Vision aware">
            Screenshots of dashboards get parsed by GPT 4o mini and indexed
          </Feature>
          <Feature title="Retrieval + synthesis">
            /askoncall in Slack returns a runbook card citing past resolutions
          </Feature>
          <Feature title="Nightly runbook drafts">
            Resolved incident threads turn into reviewable drafts by morning
          </Feature>
          <Feature title="Cost transparent">
            Every LLM call logged, per role and per model, cents visible
          </Feature>
          <Feature title="Slack native">
            Meets your team where they already work, no new tab to open
          </Feature>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4">
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-xs text-neutral-500 leading-relaxed">{children}</div>
    </div>
  );
}

function SlackIcon() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="18" height="18" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"/>
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"/>
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"/>
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"/>
    </svg>
  );
}
