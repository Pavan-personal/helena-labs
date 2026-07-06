import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import {
  ArrowRight,
  Sparkles,
  Cpu,
  Eye,
  Search,
  FileText,
  ShieldCheck,
  Cable,
  CircleCheck,
  Loader2
} from 'lucide-react';
import { SiDiscord, SiGithub, SiGrafana, SiSentry } from '@icons-pack/react-simple-icons';
import { getWorkspaceFromSession, encodeSessionToken } from '@/lib/session';
import { LandingSessionCheck } from '@/app/components/session-sync';

export const dynamic = 'force-dynamic';

const DEMO_WORKSPACE_ID = '77aa1d7d-a3ae-4dc5-bb92-e07abe81a5f5';

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{
    install_error?: string;
    signed_out?: string;
  }>;
}) {
  const params = await searchParams;
  const workspace = await getWorkspaceFromSession();
  const demoToken = encodeSessionToken(DEMO_WORKSPACE_ID);
  const demoHref = `/dashboard?hs=${encodeURIComponent(demoToken)}`;

  return (
    <main className="relative min-h-screen bg-neutral-950 overflow-hidden">
      <Suspense fallback={null}>
        <LandingSessionCheck />
      </Suspense>

      {/* Subtle ambient */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-blue-500/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* NAV */}
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="helena" width={26} height={26} priority />
            <span className="text-[15px] font-semibold tracking-tight text-white">helena</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-400">
            <a href="#how" className="hover:text-neutral-100">How it works</a>
            <a href="#integrations" className="hover:text-neutral-100">Integrations</a>
            <a href="#tech" className="hover:text-neutral-100">Under the hood</a>
            <Link
              href={demoHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-800 hover:border-neutral-600 text-neutral-200"
            >
              Try live demo
              <ArrowRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-14 items-start">
            {/* Left: pitch */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-950/60 text-xs text-neutral-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Incident memory for on-call teams
              </div>

              <h1 className="text-[56px] leading-[1.02] font-semibold tracking-tight text-white mb-6">
                No team should re-solve
                <br />
                <span className="text-neutral-500">the same fire twice.</span>
              </h1>

              <p className="text-[17px] text-neutral-400 leading-relaxed max-w-xl mb-8">
                helena indexes every past fix from your team&rsquo;s incident channels, dashboards
                and error trackers. When a new alert fires, it surfaces the resolution your team
                already worked out. Powered by BTL Runtime with per-role model routing.
              </p>

              {params.install_error && (
                <div className="border border-red-950 bg-red-950/30 text-red-300 rounded-lg p-3 mb-6 text-sm max-w-md">
                  Install failed: {params.install_error}. Try again.
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
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-100"
                  >
                    Open dashboard
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                  <Link href="/api/auth/signout" className="px-5 py-2.5 text-sm text-neutral-400 hover:text-neutral-200">
                    Sign out
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={demoHref}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-100 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]"
                    >
                      <Sparkles className="h-4 w-4" strokeWidth={2} />
                      Try the live demo
                    </Link>
                    <a
                      href="/api/auth/slack/install"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 hover:border-neutral-600 text-neutral-200"
                    >
                      <SlackMark />
                      Add to Slack
                    </a>
                    <a
                      href="/api/auth/discord/install"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 hover:border-neutral-600 text-neutral-200"
                    >
                      <SiDiscord size={18} color="#c6ccff" />
                      Add to Discord
                    </a>
                  </div>
                  <div className="mt-4 text-xs text-neutral-500">
                    Demo needs no install. Slack &amp; Discord install is one click.
                  </div>
                </div>
              )}

              {/* Trust bar */}
              <div className="mt-10 pt-6 border-t border-neutral-900 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-neutral-600 uppercase tracking-widest">
                <span>Multi-tenant</span>
                <span className="text-neutral-800">·</span>
                <span>Slack + Discord OAuth</span>
                <span className="text-neutral-800">·</span>
                <span>4 models routed</span>
                <span className="text-neutral-800">·</span>
                <span>Vision consensus</span>
              </div>
            </div>

            {/* Right: live-looking trace stream */}
            <div className="lg:mt-2">
              <TraceMockup />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="max-w-6xl mx-auto px-6 pt-24 pb-8">
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHead>Three steps. Under two minutes.</SectionHead>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <StepCard
              n="01"
              title="Install"
              body="One-click Slack or Discord OAuth. helena creates your workspace and shows a channel picker."
            />
            <StepCard
              n="02"
              title="Connect"
              body="Wire Grafana, Sentry and GitHub in the integrations tab. helena auto-creates alert routes and webhooks."
            />
            <StepCard
              n="03"
              title="Ask"
              body="Type /askoncall in your channel, or open the Copilot. Every answer cites the specific past incidents it drew from."
            />
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section id="integrations" className="max-w-6xl mx-auto px-6 pt-24 pb-8">
          <SectionEyebrow>Integrations</SectionEyebrow>
          <SectionHead>Reads from where your team already works.</SectionHead>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8">
            <IntegrationCard name="Slack" desc="Slash command + channel indexing" icon={<SlackMark />} />
            <IntegrationCard name="Discord" desc="Slash command + channel indexing" icon={<SiDiscord size={22} color="#c6ccff" />} />
            <IntegrationCard name="Grafana" desc="Auto-created Contact Point" icon={<SiGrafana size={22} color="#f5a623" />} />
            <IntegrationCard name="Sentry" desc="Auto-created alert rules" icon={<SiSentry size={22} color="#c9a6ff" />} />
            <IntegrationCard name="GitHub" desc="PR + deployment correlation" icon={<SiGithub size={22} color="#e6e6e6" />} />
          </div>
        </section>

        {/* UNDER THE HOOD */}
        <section id="tech" className="max-w-6xl mx-auto px-6 pt-24 pb-8">
          <SectionEyebrow>Under the hood</SectionEyebrow>
          <SectionHead>Multi-model routing on one gateway.</SectionHead>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <TechCard
              icon={<Cpu className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="Per-role model choice"
              body="Classifier on btl-2 for cheap routing. Deep reasoning on btl-2 with tool-use loop. Vision on gpt-4o-mini and gemini-2.5-flash-image in parallel for consensus."
            />
            <TechCard
              icon={<Eye className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="Dual-VLM screenshot consensus"
              body="Drop any dashboard screenshot. Two vision models describe it independently. We only trust what both agree on. Falls back gracefully if one errors."
            />
            <TechCard
              icon={<ShieldCheck className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="Citations, verified"
              body="Every answer must cite [INC-xxx] or [RB-xxx] from your workspace. Answers with invalid citations get one automatic regeneration pass before shipping."
            />
            <TechCard
              icon={<Search className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="Hybrid retrieval"
              body="RetainDB memory layer as primary retriever. Postgres full-text search as instant fallback. Same incident indexed both places, best result wins."
            />
            <TechCard
              icon={<FileText className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="Nightly runbook drafts"
              body="Resolved incident threads roll up into reviewable runbook drafts overnight. Approve to add to permanent memory, or reject and forget."
            />
            <TechCard
              icon={<Cable className="h-5 w-5 text-neutral-300" strokeWidth={1.5} />}
              title="One line to add a source"
              body="POST any JSON with title, severity, and body to the generic webhook. Datadog, cron, custom scripts, whatever. Same memory."
            />
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-8">
          <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Try it now</div>
              <div className="text-2xl font-semibold text-white mb-1">See helena on real incidents.</div>
              <div className="text-sm text-neutral-400 max-w-lg">
                Explore the seeded demo workspace. Send a Copilot query. Watch the trace stream cite specific incidents.
              </div>
            </div>
            <Link
              href={demoHref}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-100 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              Open live demo
            </Link>
          </div>
        </section>

        <footer className="max-w-6xl mx-auto px-6 pt-16 pb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-neutral-600 border-t border-neutral-900 mt-16">
          <div>helena · incident memory for on-call teams</div>
          <div>Built with BTL Runtime for the Runtime Hackathon</div>
        </footer>
      </div>
    </main>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">{children}</div>;
}
function SectionHead({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[28px] md:text-[32px] leading-tight font-semibold tracking-tight text-white max-w-2xl">{children}</h2>;
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-6 hover:border-neutral-700 transition-colors">
      <div className="text-[11px] uppercase tracking-widest text-neutral-600 mb-3 font-mono">{n}</div>
      <div className="text-base font-semibold text-white mb-2">{title}</div>
      <div className="text-sm text-neutral-400 leading-relaxed">{body}</div>
    </div>
  );
}

function IntegrationCard({ name, desc, icon }: { name: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 hover:border-neutral-700 transition-colors flex flex-col items-start">
      <div className="h-10 w-10 rounded-lg border border-neutral-800 bg-neutral-900/60 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-neutral-100 mb-1">{name}</div>
      <div className="text-[11px] text-neutral-500 leading-snug">{desc}</div>
    </div>
  );
}

function TechCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-6 hover:border-neutral-700 transition-colors">
      <div className="mb-3">{icon}</div>
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <div className="text-[13px] text-neutral-400 leading-relaxed">{body}</div>
    </div>
  );
}

function TraceMockup() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 backdrop-blur p-4 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 pb-3 border-b border-neutral-900 mb-3">
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="text-[10px] text-neutral-600 ml-2 font-mono">/dashboard/copilot</div>
      </div>

      <div className="text-right mb-3">
        <div className="inline-block rounded-2xl bg-neutral-800 text-[13px] text-neutral-100 px-3.5 py-2 max-w-[80%] text-left">
          any redis issues in the last month?
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <TraceLine kind="done" text="Classified" />
        <TracePill model="btl-2" reason="classifier" />
        <TracePill model="btl-2" reason="main loop (DEEP_REASON)" />
        <TraceLine kind="done" text="Reasoned across memory" />
        <TraceTool name="search_incidents" args={`{"query":"redis"}`} />
        <TraceResult text="3 incidents via RetainDB (89ms)" />
        <TraceLine kind="done" text="Citations validated" />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3.5">
        <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-2">
          <Sparkles className="h-3 w-3 text-neutral-500" strokeWidth={1.75} />
          helena
          <span className="text-neutral-700">·</span>
          <span className="font-mono">btl-2</span>
          <span className="text-neutral-700">·</span>
          <span>2.4s</span>
        </div>
        <div className="text-[12px] text-neutral-200 leading-relaxed">
          Three redis events last month. The pattern is <span className="text-neutral-100">connection-pool exhaustion under promo spikes</span>{' '}
          <CitePill id="INC-b72094" />, <span className="text-neutral-100">CPU pegged from a scan</span>{' '}
          <CitePill id="INC-e40956" />, and one <span className="text-neutral-100">replica lag &gt;30s</span>{' '}
          <CitePill id="INC-09f597" />. Runbook <CitePill id="RB-a12034" kind="rb" /> covers the failover.
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-900 flex gap-2">
          <FollowUp text="Generate post-mortem" />
          <FollowUp text="Exec brief" />
        </div>
      </div>
    </div>
  );
}

function TraceLine({ kind, text }: { kind: 'done' | 'running'; text: string }) {
  return (
    <div className="text-[10px] text-neutral-500 flex items-center gap-2">
      {kind === 'done' ? (
        <CircleCheck className="h-3 w-3 text-neutral-600" />
      ) : (
        <Loader2 className="h-3 w-3 animate-spin text-neutral-600" />
      )}
      {text}
    </div>
  );
}
function TracePill({ model, reason }: { model: string; reason: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] text-neutral-400 border border-neutral-800 bg-neutral-950/60 rounded px-1.5 py-0.5 font-mono mr-1.5">
      <Cpu className="h-3 w-3" strokeWidth={1.5} />
      {model}
      <span className="text-neutral-600">·</span>
      <span className="text-neutral-500">{reason}</span>
    </div>
  );
}
function TraceTool({ name, args }: { name: string; args: string }) {
  return (
    <div className="text-[10px] text-neutral-400 flex items-center gap-2">
      <FileText className="h-3 w-3 text-amber-500" />
      <span className="font-mono">{name}</span>
      <span className="text-neutral-600 truncate font-mono">{args}</span>
    </div>
  );
}
function TraceResult({ text }: { text: string }) {
  return (
    <div className="text-[10px] text-neutral-400 flex items-center gap-2 pl-5">
      <CircleCheck className="h-3 w-3 text-emerald-500" />
      <span className="text-neutral-500">{text}</span>
    </div>
  );
}
function CitePill({ id, kind = 'inc' }: { id: string; kind?: 'inc' | 'rb' }) {
  return (
    <span
      className={`inline-block font-mono text-[10px] px-1.5 py-0.5 rounded ${
        kind === 'inc'
          ? 'bg-sky-950/40 text-sky-300 border border-sky-900/40'
          : 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40'
      }`}
    >
      {id}
    </span>
  );
}
function FollowUp({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-800 text-[10px] text-neutral-400"
    >
      {text}
    </button>
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
