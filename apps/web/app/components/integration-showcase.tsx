'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  GitPullRequest,
  Send,
  Hash,
  CircleDot,
  ChevronRight
} from 'lucide-react';
import { SiDiscord, SiSentry, SiGrafana, SiGithub } from '@icons-pack/react-simple-icons';

/**
 * "See it in the flow": five tabs, each a small mocked-up screen showing
 * what happens the moment helena receives from that integration. Auto-
 * cycles every 6s; user clicks pause the cycle. Not gifs — CSS + a few
 * fade-in animations so it stays under a kilobyte.
 */

type TabKey = 'slack' | 'discord' | 'grafana' | 'sentry' | 'github';

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  brand: string;
  headline: string;
  sub: string;
}> = [
  {
    key: 'slack',
    label: 'Slack',
    icon: <SlackMark />,
    brand: '#611f69',
    headline: 'Ask in-channel with /askoncall',
    sub: 'helena replies in-thread with cited past incidents.'
  },
  {
    key: 'discord',
    label: 'Discord',
    icon: <SiDiscord size={16} color="#c6ccff" />,
    brand: '#5865F2',
    headline: 'Same command, Discord flavor',
    sub: '/askoncall works in any Discord channel where helena is invited.'
  },
  {
    key: 'grafana',
    label: 'Grafana',
    icon: <SiGrafana size={16} color="#f5a623" />,
    brand: '#f5a623',
    headline: 'Alerts land as incidents',
    sub: 'auto-created Contact Point routes any alert into helena memory.'
  },
  {
    key: 'sentry',
    label: 'Sentry',
    icon: <SiSentry size={16} color="#c9a6ff" />,
    brand: '#c9a6ff',
    headline: 'Every exception, remembered',
    sub: 'auto-created alert rules push each new issue to helena.'
  },
  {
    key: 'github',
    label: 'GitHub',
    icon: <SiGithub size={16} color="#e6e6e6" />,
    brand: '#e6e6e6',
    headline: 'PRs and deploys correlate with alerts',
    sub: 'helena knows which deploy shipped just before an incident opened.'
  }
];

export function IntegrationShowcase() {
  const [active, setActive] = useState<TabKey>('slack');
  const [manual, setManual] = useState(false);

  // Auto-cycle unless the user picked a tab.
  useEffect(() => {
    if (manual) return;
    const i = TABS.findIndex((t) => t.key === active);
    const next = TABS[(i + 1) % TABS.length]!.key;
    const t = setTimeout(() => setActive(next), 6000);
    return () => clearTimeout(t);
  }, [active, manual]);

  const activeMeta = useMemo(() => TABS.find((t) => t.key === active)!, [active]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-2">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-neutral-950/60">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActive(t.key);
                setManual(true);
              }}
              className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                isActive
                  ? 'bg-neutral-900 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Caption above the mock */}
      <div className="px-3 pt-6 pb-3">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">
          {activeMeta.label}
        </div>
        <div className="text-lg font-semibold text-white leading-tight">{activeMeta.headline}</div>
        <div className="text-sm text-neutral-500 mt-1">{activeMeta.sub}</div>
      </div>

      {/* The stage — same slot, different mock per tab. Key on active so it
          remounts and the fade-in-up animations replay every switch. */}
      <div className="px-3 pb-3">
        <div key={active} className="animate-fade-in-up">
          {active === 'slack' && <SlackMock />}
          {active === 'discord' && <DiscordMock />}
          {active === 'grafana' && <GrafanaMock />}
          {active === 'sentry' && <SentryMock />}
          {active === 'github' && <GithubMock />}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- MOCKS --------------------------------- */

function ChatFrame({
  header,
  children,
  accent
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
      <div
        className="px-3 py-2 border-b border-neutral-900 flex items-center gap-2 text-xs text-neutral-300"
        style={{ background: `linear-gradient(90deg, ${accent}12 0%, transparent 100%)` }}
      >
        {header}
      </div>
      <div className="p-4 space-y-3 min-h-[220px]">{children}</div>
    </div>
  );
}

function SlackMock() {
  return (
    <ChatFrame
      accent="#611f69"
      header={
        <>
          <Hash className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-neutral-200">incidents</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500">acme-eng</span>
        </>
      }
    >
      <div className="flex gap-3">
        <Avatar initials="RM" color="#8b5cf6" />
        <div className="flex-1">
          <div className="text-[11px] text-neutral-500 mb-0.5">
            Ravi <span className="text-neutral-700">· 2:14 PM</span>
          </div>
          <div className="text-sm text-neutral-200">
            <span className="font-mono text-sky-300">/askoncall</span> is this like the redis
            issue from last month?
          </div>
        </div>
      </div>
      <div className="flex gap-3 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <div className="h-7 w-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-neutral-500 mb-0.5">
            helena <span className="text-neutral-700">· APP</span>
          </div>
          <div className="text-sm text-neutral-200 leading-relaxed">
            Yes — same pattern. Connection-pool exhaustion during promo spike, matches{' '}
            <CitePill id="INC-b72094" />. Tom&rsquo;s failover playbook lives at{' '}
            <CitePill id="RB-a12034" kind="rb" />.
          </div>
          <div className="mt-2 flex gap-1.5">
            <MiniBtn>Generate post-mortem</MiniBtn>
            <MiniBtn>Notify oncall</MiniBtn>
          </div>
        </div>
      </div>
    </ChatFrame>
  );
}

function DiscordMock() {
  return (
    <ChatFrame
      accent="#5865F2"
      header={
        <>
          <Hash className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-neutral-200">oncall</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500">acme dev</span>
        </>
      }
    >
      <div className="flex gap-3">
        <Avatar initials="AL" color="#5865F2" />
        <div className="flex-1">
          <div className="text-[11px] text-neutral-500 mb-0.5">
            Alicia <span className="text-neutral-700">· Today at 09:04</span>
          </div>
          <div className="text-sm text-neutral-200">
            <span className="font-mono text-sky-300">/askoncall</span> any recent notification
            worker crashes?
          </div>
        </div>
      </div>
      <div className="flex gap-3 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <div className="h-7 w-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-neutral-500 mb-0.5">
            helena <span className="text-neutral-700">· BOT</span>
          </div>
          <div className="text-sm text-neutral-200 leading-relaxed">
            Yes — OOM every ~3h, same root cause as <CitePill id="INC-b72094" />: unbounded
            in-memory map. Fix from that incident already merged; staging just needs a
            redeploy.
          </div>
        </div>
      </div>
    </ChatFrame>
  );
}

function GrafanaMock() {
  return (
    <ChatFrame
      accent="#f5a623"
      header={
        <>
          <SiGrafana size={12} color="#f5a623" />
          <span className="text-neutral-200">Grafana Cloud</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500">alerting → contact point helena-oncall</span>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Grafana alert card */}
        <div className="rounded-lg border border-orange-900/60 bg-orange-950/20 p-3 text-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-orange-300 font-medium">Firing</span>
            <span className="text-neutral-500 ml-auto text-[10px]">14:32 UTC</span>
          </div>
          <div className="text-neutral-200 mb-1">API gateway 5xx rate 2.1%</div>
          <div className="text-neutral-500 text-[11px]">threshold: 1% · service: checkout-svc</div>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-600 shrink-0" />
        {/* Helena incident row */}
        <div
          className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs animate-fade-in-up"
          style={{ animationDelay: '500ms' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-neutral-500">helena</span>
            <span className="text-neutral-600">·</span>
            <span className="text-[10px] text-neutral-400">new incident</span>
          </div>
          <div className="text-neutral-200 mb-1">API gateway 5xx rate 2.1%</div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <SevPill sev="medium" />
            <span className="text-neutral-500">source: grafana</span>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-neutral-500 pt-2 flex items-center gap-2">
        <CircleDot className="h-3 w-3 text-emerald-500" />
        Indexed for retrieval — future queries can cite this incident.
      </div>
    </ChatFrame>
  );
}

function SentryMock() {
  return (
    <ChatFrame
      accent="#c9a6ff"
      header={
        <>
          <SiSentry size={12} color="#c9a6ff" />
          <span className="text-neutral-200">Sentry</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500">acme-prod</span>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-lg border border-purple-900/60 bg-purple-950/20 p-3 text-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-purple-300" />
            <span className="text-purple-200 font-medium">TypeError</span>
            <span className="text-neutral-500 ml-auto text-[10px]">15:47</span>
          </div>
          <div className="text-neutral-200 mb-1">Cannot read total of undefined</div>
          <div className="text-neutral-500 text-[11px]">api/checkout/finalize.ts:42</div>
        </div>
        <ChevronRight className="h-4 w-4 text-neutral-600 shrink-0" />
        <div
          className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs animate-fade-in-up"
          style={{ animationDelay: '500ms' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-neutral-500">helena</span>
            <span className="text-neutral-600">·</span>
            <span className="text-[10px] text-neutral-400">new incident</span>
          </div>
          <div className="text-neutral-200 mb-1">TypeError in checkout finalize</div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <SevPill sev="critical" />
            <span className="text-neutral-500">source: sentry</span>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-neutral-500 pt-2 flex items-center gap-2">
        <CircleDot className="h-3 w-3 text-emerald-500" />
        Dedup key set to sentry issue id — next occurrence updates same row.
      </div>
    </ChatFrame>
  );
}

function GithubMock() {
  return (
    <ChatFrame
      accent="#e6e6e6"
      header={
        <>
          <SiGithub size={12} color="#e6e6e6" />
          <span className="text-neutral-200">acme/checkout-svc</span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-500">deployments</span>
        </>
      }
    >
      <div className="space-y-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs flex items-center gap-3">
          <GitPullRequest className="h-4 w-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-neutral-200 truncate">
              PR #4218 · fix null customer on guest checkout
            </div>
            <div className="text-neutral-500 text-[11px]">merged 15 min ago by @sam</div>
          </div>
          <span className="text-[10px] text-emerald-300 border border-emerald-900/60 bg-emerald-950/40 rounded px-1.5 py-0.5">
            merged
          </span>
        </div>
        <div
          className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-xs animate-fade-in-up"
          style={{ animationDelay: '450ms' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-neutral-500">helena</span>
            <span className="text-neutral-600">·</span>
            <span className="text-[10px] text-neutral-400">correlation</span>
          </div>
          <div className="text-neutral-200 leading-relaxed">
            PR #4218 shipped 12m before <CitePill id="INC-b72094" /> opened in Sentry. Related
            change flagged on incident detail.
          </div>
        </div>
      </div>
    </ChatFrame>
  );
}

/* --------------------------------- ATOMS --------------------------------- */

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="h-7 w-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-semibold text-white"
      style={{ background: color }}
    >
      {initials}
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

function MiniBtn({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-neutral-800 text-[10px] text-neutral-400">
      {children}
    </span>
  );
}

function SevPill({ sev }: { sev: 'low' | 'medium' | 'high' | 'critical' }) {
  const map: Record<string, string> = {
    low: 'bg-neutral-900 text-neutral-400 border-neutral-800',
    medium: 'bg-yellow-950/50 text-yellow-300 border-yellow-900/60',
    high: 'bg-orange-950/60 text-orange-300 border-orange-900/60',
    critical: 'bg-red-950/60 text-red-300 border-red-900/60'
  };
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-widest ${map[sev]}`}>
      {sev}
    </span>
  );
}

function SlackMark() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="16" height="16" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}
