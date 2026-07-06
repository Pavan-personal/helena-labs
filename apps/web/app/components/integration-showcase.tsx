'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, Hash, RotateCcw } from 'lucide-react';
import { SiDiscord, SiSentry, SiGrafana, SiGithub } from '@icons-pack/react-simple-icons';

/**
 * "See it in the flow": an interactive constellation. Center node is
 * helena. Four source nodes ring around it: Slack/Discord chat, Grafana,
 * Sentry, GitHub. Pick a preset question or type your own; the flow
 * animates outward to whichever sources are relevant, each returns a
 * concrete signal, then helena synthesizes an answer in the middle.
 *
 * No auto-slideshow. The visitor drives every beat.
 */

type SourceKey = 'chat' | 'grafana' | 'sentry' | 'github';

interface Signal {
  source: SourceKey;
  short: string;
  detail: string;
}

interface Preset {
  question: string;
  sources: SourceKey[];
  signals: Signal[];
  answer: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    question: 'any redis issues in the last month?',
    sources: ['grafana', 'chat', 'sentry'],
    signals: [
      {
        source: 'grafana',
        short: 'Redis primary CPU 94%',
        detail: 'alert fired 3d ago on redis-primary-01, replica lag climbed'
      },
      {
        source: 'chat',
        short: 'Slack: Tom promoted replica',
        detail: '#incidents thread, 3d ago, session cache misses spiked briefly'
      },
      {
        source: 'sentry',
        short: 'redis.exceptions.ConnectionError',
        detail: '3,200 events over 12m from notification-worker'
      }
    ],
    answer: (
      <>
        Three redis events last month, same root pattern: connection-pool exhaustion under
        promo spikes. See <CitePill id="INC-b72094" /> and <CitePill id="INC-e40956" />. Tom
        already wrote the failover playbook: <CitePill id="RB-a12034" kind="rb" />.
      </>
    )
  },
  {
    question: 'is this checkout error new or have we seen it?',
    sources: ['sentry', 'chat', 'github'],
    signals: [
      {
        source: 'sentry',
        short: 'TypeError · finalize.ts:42',
        detail: 'Cannot read total of undefined, 47 events in 8m'
      },
      {
        source: 'chat',
        short: 'Slack: Stripe webhook null customer',
        detail: '#engineering, 2 months ago, exact same stack trace'
      },
      {
        source: 'github',
        short: 'PR #4218 already fixed this',
        detail: 'merged 74 days ago, optional chaining on payload.customer'
      }
    ],
    answer: (
      <>
        Not new. Same stack trace as <CitePill id="INC-e40956" /> two months ago. Fix landed
        in PR #4218 <CitePill id="RB-b3d201" kind="rb" />. Check whether the fix was reverted
        or a new caller bypassed the guard.
      </>
    )
  },
  {
    question: 'what shipped just before this alert fired?',
    sources: ['grafana', 'github'],
    signals: [
      {
        source: 'grafana',
        short: 'API gateway 5xx spike',
        detail: 'started 14:32 UTC, upstream: checkout-svc'
      },
      {
        source: 'github',
        short: 'checkout-svc v2.4.1 deploy',
        detail: 'shipped 14:29 UTC, 3 minutes before the spike'
      }
    ],
    answer: (
      <>
        checkout-svc v2.4.1 deployed 3 minutes before the alert <CitePill id="INC-8ab203" />.
        Roll it back with <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">kubectl rollout undo deploy/checkout-svc</code>.
        Full runbook: <CitePill id="RB-a12034" kind="rb" />.
      </>
    )
  }
];

type Phase = 'idle' | 'typing' | 'fan_out' | 'signals_in' | 'synth' | 'answer';

export function IntegrationShowcase() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [activeSignal, setActiveSignal] = useState(0);

  const preset = PRESETS[presetIdx]!;

  // Kick off automatically on first render so a visitor sees motion.
  useEffect(() => {
    const t = setTimeout(() => setPhase('typing'), 500);
    return () => clearTimeout(t);
  }, []);

  // Typing effect (1 phase).
  useEffect(() => {
    if (phase !== 'typing') return;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (i > preset.question.length) {
        setTimeout(() => setPhase('fan_out'), 400);
        return;
      }
      setTyped(preset.question.slice(0, i));
      i += 1;
      setTimeout(tick, 30);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [phase, preset.question]);

  // Fan-out beat: light up source nodes one by one.
  useEffect(() => {
    if (phase !== 'fan_out') return;
    const t = setTimeout(() => setPhase('signals_in'), 900);
    return () => clearTimeout(t);
  }, [phase]);

  // Signals stream back one by one.
  useEffect(() => {
    if (phase !== 'signals_in') return;
    if (activeSignal >= preset.signals.length) {
      const t = setTimeout(() => setPhase('synth'), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActiveSignal((n) => n + 1), 800);
    return () => clearTimeout(t);
  }, [phase, activeSignal, preset.signals.length]);

  // Synth pause, then reveal answer.
  useEffect(() => {
    if (phase !== 'synth') return;
    const t = setTimeout(() => setPhase('answer'), 900);
    return () => clearTimeout(t);
  }, [phase]);

  const replay = useCallback(() => {
    setTyped('');
    setActiveSignal(0);
    setPhase('typing');
  }, []);

  const jumpTo = useCallback((i: number) => {
    setPresetIdx(i);
    setTyped('');
    setActiveSignal(0);
    setPhase('typing');
  }, []);

  const fanOutActive = phase === 'fan_out' || phase === 'signals_in' || phase === 'synth' || phase === 'answer';
  const isSourceLit = useCallback(
    (s: SourceKey) => {
      if (!fanOutActive) return false;
      return preset.sources.includes(s);
    },
    [fanOutActive, preset.sources]
  );

  const signalsShown = useMemo(
    () => preset.signals.slice(0, activeSignal),
    [preset.signals, activeSignal]
  );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 md:p-6">
      {/* Preset chooser */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-neutral-500 mr-1">
          Try a question:
        </span>
        {PRESETS.map((p, i) => {
          const active = i === presetIdx;
          return (
            <button
              key={p.question}
              type="button"
              onClick={() => jumpTo(i)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                active
                  ? 'bg-white text-neutral-900 border-white'
                  : 'border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
              }`}
            >
              {shortLabel(p.question)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={replay}
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-200"
          title="Replay"
        >
          <RotateCcw className="h-3 w-3" />
          Replay
        </button>
      </div>

      {/* The stage: user query on top, constellation in the middle, answer at the bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Left: query + constellation */}
        <div>
          {/* Query bar */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 mb-6">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
              You ask
            </div>
            <div className="text-[15px] text-neutral-100 font-medium">
              {typed}
              {phase === 'typing' && (
                <span className="inline-block w-1 h-3.5 bg-neutral-300 ml-0.5 align-middle animate-pulse" />
              )}
            </div>
          </div>

          {/* Constellation */}
          <Constellation
            phase={phase}
            isSourceLit={isSourceLit}
            signalsShown={signalsShown}
            preset={preset}
          />
        </div>

        {/* Right: signals + final answer */}
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">
            What helena gathered
          </div>
          <div className="space-y-2 min-h-[180px]">
            {signalsShown.length === 0 && (
              <div className="text-xs text-neutral-600 border border-dashed border-neutral-800 rounded-lg p-3">
                Waiting for the query to fan out.
              </div>
            )}
            {signalsShown.map((sig, i) => (
              <SignalCard key={`${presetIdx}-${i}`} signal={sig} />
            ))}
          </div>

          {phase === 'synth' && (
            <div className="text-[11px] text-neutral-500 flex items-center gap-2 animate-fade-in-up">
              <Sparkles className="h-3 w-3 animate-pulse" />
              helena is combining these into one answer...
            </div>
          )}

          {phase === 'answer' && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 animate-fade-in-up">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-neutral-500" />
                helena answers
              </div>
              <div className="text-[13px] text-neutral-200 leading-relaxed">{preset.answer}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* CONSTELLATION */

function Constellation({
  phase,
  isSourceLit,
  signalsShown,
  preset
}: {
  phase: Phase;
  isSourceLit: (s: SourceKey) => boolean;
  signalsShown: Signal[];
  preset: Preset;
}) {
  const NODES: Array<{
    key: SourceKey;
    label: string;
    icon: React.ReactNode;
    style: React.CSSProperties;
    hint: string;
  }> = [
    {
      key: 'chat',
      label: 'Slack + Discord',
      icon: <SlackDot />,
      style: { top: '0%', left: '50%', transform: 'translate(-50%, -50%)' },
      hint: '#incidents chatter, /askoncall history'
    },
    {
      key: 'grafana',
      label: 'Grafana',
      icon: <SiGrafana size={16} color="#f5a623" />,
      style: { top: '50%', left: '0%', transform: 'translate(-50%, -50%)' },
      hint: 'firing + resolved alerts'
    },
    {
      key: 'sentry',
      label: 'Sentry',
      icon: <SiSentry size={16} color="#c9a6ff" />,
      style: { top: '50%', right: '0%', transform: 'translate(50%, -50%)' },
      hint: 'issues, breadcrumbs, stack traces'
    },
    {
      key: 'github',
      label: 'GitHub',
      icon: <SiGithub size={16} color="#e6e6e6" />,
      style: { bottom: '0%', left: '50%', transform: 'translate(-50%, 50%)' },
      hint: 'PRs and deploy events'
    }
  ];

  const sourceHasSignal = (s: SourceKey) => signalsShown.some((sig) => sig.source === s);

  return (
    <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 h-[360px] px-14 py-10">
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-40 w-40 rounded-full bg-sky-500/10 blur-2xl transition-opacity duration-700 ${
            phase === 'answer' || phase === 'synth' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Lines from center to each source */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {(
          [
            ['chat', 50, 8, 50, 50],
            ['grafana', 8, 50, 50, 50],
            ['sentry', 92, 50, 50, 50],
            ['github', 50, 92, 50, 50]
          ] as Array<[SourceKey, number, number, number, number]>
        ).map(([key, x1, y1, x2, y2]) => {
          const lit = isSourceLit(key);
          const returned = sourceHasSignal(key);
          const stroke = returned
            ? '#38bdf8'
            : lit
              ? '#a1a1aa'
              : '#262626';
          return (
            <line
              key={key}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={0.4}
              strokeDasharray={lit && !returned ? '2 2' : '0'}
              opacity={returned ? 0.9 : lit ? 0.6 : 0.35}
              style={{ transition: 'stroke 300ms, opacity 300ms' }}
            />
          );
        })}
      </svg>

      {/* Source nodes */}
      {NODES.map((n) => {
        const lit = isSourceLit(n.key);
        const returned = sourceHasSignal(n.key);
        return (
          <div key={n.key} className="absolute" style={n.style}>
            <div
              className={`h-14 w-14 rounded-full border flex items-center justify-center transition-all duration-300 ${
                returned
                  ? 'bg-sky-950/60 border-sky-800 shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)]'
                  : lit
                    ? 'bg-neutral-900 border-neutral-700'
                    : 'bg-neutral-950 border-neutral-800'
              }`}
              title={preset.sources.includes(n.key) ? 'queried' : 'skipped for this question'}
            >
              {n.icon}
            </div>
            <div className="text-center mt-1.5">
              <div
                className={`text-[10px] font-medium transition-colors ${
                  returned ? 'text-sky-200' : lit ? 'text-neutral-200' : 'text-neutral-500'
                }`}
              >
                {n.label}
              </div>
              <div className="text-[9px] text-neutral-600 max-w-[110px] mx-auto leading-tight">
                {n.hint}
              </div>
            </div>
          </div>
        );
      })}

      {/* Center: helena */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center shadow-2xl shadow-black/60"
      >
        <div className="text-center">
          <Sparkles className="h-4 w-4 text-neutral-200 mx-auto mb-0.5" strokeWidth={1.75} />
          <div className="text-[10px] font-semibold tracking-tight text-neutral-100">helena</div>
        </div>
      </div>
    </div>
  );
}

/* SIGNALS + PILLS */

function SignalCard({ signal }: { signal: Signal }) {
  const meta = SOURCE_META[signal.source];
  return (
    <div
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 animate-fade-in-up"
      style={{ borderLeft: `2px solid ${meta.color}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-4 w-4 rounded flex items-center justify-center" style={{ background: `${meta.color}22` }}>
          {meta.icon}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
          {meta.label}
        </span>
      </div>
      <div className="text-[12px] text-neutral-200 leading-snug">{signal.short}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{signal.detail}</div>
    </div>
  );
}

const SOURCE_META: Record<
  SourceKey,
  { label: string; icon: React.ReactNode; color: string }
> = {
  chat: { label: 'Chat', icon: <Hash className="h-2.5 w-2.5 text-blue-300" />, color: '#3b82f6' },
  grafana: { label: 'Grafana', icon: <SiGrafana size={10} color="#f5a623" />, color: '#f5a623' },
  sentry: { label: 'Sentry', icon: <SiSentry size={10} color="#c9a6ff" />, color: '#c9a6ff' },
  github: { label: 'GitHub', icon: <SiGithub size={10} color="#e6e6e6" />, color: '#e6e6e6' }
};

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

function SlackDot() {
  return (
    <div className="flex items-center gap-0.5">
      <SlackMark />
      <ArrowRight className="h-2.5 w-2.5 text-neutral-600" />
      <SiDiscord size={12} color="#c6ccff" />
    </div>
  );
}

function SlackMark() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="14" height="14" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}

function shortLabel(q: string): string {
  return q.length > 40 ? q.slice(0, 40) + '.' : q;
}
