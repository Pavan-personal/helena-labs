import Link from 'next/link';
import { Suspense } from 'react';
import { getWorkspaceFromSession } from '@/lib/session';
import { LandingSessionCheck } from '@/app/components/session-sync';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{
    install_error?: string;
    signed_out?: string;
    cookie_len?: string;
    cookie_preview?: string;
  }>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspaceFromSession();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Suspense fallback={null}>
        <LandingSessionCheck />
      </Suspense>
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
            <div>Install failed: {params.install_error}. Try again.</div>
            {params.cookie_len !== undefined && (
              <div className="mt-2 text-xs opacity-70">
                Cookie header length: {params.cookie_len}
                {params.cookie_preview && (
                  <>
                    <br />
                    Cookie preview: <code>{params.cookie_preview}</code>
                  </>
                )}
              </div>
            )}
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
              Open {workspace.chat_platform === 'discord' ? workspace.discord_guild_name : workspace.slack_team_name} dashboard
            </Link>
            <Link
              href="/api/auth/signout"
              className="px-5 py-2.5 rounded border border-neutral-700 hover:border-neutral-500"
            >
              Sign out
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <a
                href="/api/auth/slack/install"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-white text-black font-medium hover:bg-neutral-200"
              >
                <SlackIcon />
                Add to Slack
              </a>
              <a
                href="/api/auth/discord/install"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#5865F2] text-white font-medium hover:bg-[#4752c4]"
              >
                <DiscordIcon />
                Add to Discord
              </a>
            </div>
            <span className="text-sm text-neutral-500">Free to try. Pick your chat, install in one click.</span>
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

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a13.9 13.9 0 0 0-.653 1.335 18.27 18.27 0 0 0-5.487 0A13 13 0 0 0 9.765 3a19.74 19.74 0 0 0-3.762 1.369c-2.4 3.573-3.05 7.056-2.725 10.492a19.87 19.87 0 0 0 6.06 3.06 14.3 14.3 0 0 0 1.298-2.104 12.85 12.85 0 0 1-2.041-.98c.171-.126.339-.257.5-.39a14.16 14.16 0 0 0 12.11 0c.163.134.331.265.5.39a12.9 12.9 0 0 1-2.043.98 14.31 14.31 0 0 0 1.298 2.103 19.85 19.85 0 0 0 6.061-3.059c.381-3.988-.652-7.44-2.723-10.494zM8.68 14.4c-1.183 0-2.157-1.096-2.157-2.442 0-1.347.955-2.443 2.157-2.443 1.203 0 2.176 1.096 2.157 2.443 0 1.346-.954 2.442-2.157 2.442zm6.638 0c-1.184 0-2.157-1.096-2.157-2.442 0-1.347.955-2.443 2.157-2.443 1.203 0 2.176 1.096 2.157 2.443 0 1.346-.954 2.442-2.157 2.442z"/>
    </svg>
  );
}
