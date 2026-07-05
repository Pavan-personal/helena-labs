import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Cable, Eye, Search, FileText, Coins, MessageSquare, ArrowRight } from 'lucide-react';
import { SiDiscord } from '@icons-pack/react-simple-icons';
import { getWorkspaceFromSession, encodeSessionToken } from '@/lib/session';
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
    <main className="relative min-h-screen overflow-hidden">
      <Suspense fallback={null}>
        <LandingSessionCheck />
      </Suspense>

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-500/[0.06] blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-indigo-500/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10">
        <nav className="max-w-6xl mx-auto flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="helena" width={28} height={28} className="object-contain" priority />
            <span className="text-sm font-semibold tracking-tight text-white">helena</span>
          </div>
          <div className="text-xs text-neutral-500">
            Built on BTL Runtime
          </div>
        </nav>

        <section className="max-w-3xl mx-auto px-6 pt-12 pb-16">
          <div className="mb-6 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950/60 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Incident memory for on-call teams
          </div>

          <h1 className="text-[64px] leading-[1.02] font-semibold tracking-tight text-white mb-6">
            No team should re-solve
            <br />
            <span className="text-neutral-400">the same fire twice.</span>
          </h1>

          <p className="text-lg text-neutral-400 leading-relaxed max-w-xl mb-10">
            helena quietly indexes every past fix from your team&rsquo;s incident channels, dashboards
            and error trackers. When a new alert fires, it surfaces the resolution your team already
            worked out.
          </p>

          {params.install_error && (
            <div className="border border-red-950 bg-red-950/30 text-red-300 rounded-lg p-3 mb-6 text-sm max-w-md">
              Install failed: {params.install_error}. Try again.
              {params.cookie_len !== undefined && (
                <div className="mt-1.5 text-[11px] opacity-70">
                  cookie length {params.cookie_len}
                  {params.cookie_preview && (
                    <>
                      {' '}·{' '}<code>{params.cookie_preview}</code>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {params.signed_out && (
            <div className="border border-neutral-800 rounded-lg p-3 mb-6 text-sm text-neutral-400 max-w-md">
              Signed out.
            </div>
          )}

          {workspace ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard?hs=${encodeURIComponent(encodeSessionToken(workspace.id))}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-100 transition-colors"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/api/auth/signout"
                className="px-5 py-2.5 rounded-lg text-sm text-neutral-400 hover:text-neutral-200"
              >
                Sign out
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api/auth/slack/install"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-100 transition-colors"
                >
                  <SlackMark />
                  Add to Slack
                </a>
                <a
                  href="/api/auth/discord/install"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-[#5865F2] text-white font-medium hover:bg-[#4752c4] transition-colors"
                >
                  <SiDiscord size={18} color="#ffffff" />
                  Add to Discord
                </a>
              </div>
              <div className="mt-4 text-xs text-neutral-500">
                Free tier. One click install. No credit card.
              </div>
            </div>
          )}
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-4">
            What helena does
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Feature Icon={Cable} title="Multi-source ingest">
              Slack, Discord, Grafana, Sentry, or any webhook POST
            </Feature>
            <Feature Icon={Eye} title="Vision aware">
              Dashboard screenshots parsed by gpt-4o-mini and indexed
            </Feature>
            <Feature Icon={Search} title="Retrieval + synthesis">
              /askoncall returns a runbook card citing past resolutions
            </Feature>
            <Feature Icon={FileText} title="Nightly runbook drafts">
              Resolved threads become reviewable drafts by morning
            </Feature>
            <Feature Icon={Coins} title="Cost transparent">
              Every LLM call logged, per role, per model, per cent
            </Feature>
            <Feature Icon={MessageSquare} title="Chat native">
              Meets your team where they already work
            </Feature>
          </div>
        </section>

        <footer className="max-w-5xl mx-auto px-6 pb-10 flex items-center justify-between text-xs text-neutral-600">
          <div>helena · incident memory</div>
          <div>Built with BTL Runtime for the Runtime Hackathon</div>
        </footer>
      </div>
    </main>
  );
}

function Feature({
  Icon,
  title,
  children
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 hover:border-neutral-700 transition-colors">
      <Icon className="h-5 w-5 text-neutral-400 mb-3" strokeWidth={1.5} />
      <div className="text-sm font-medium text-neutral-100 mb-1.5">{title}</div>
      <div className="text-xs text-neutral-500 leading-relaxed">{children}</div>
    </div>
  );
}

function SlackMark() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="18" height="18" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}
