'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { SiDiscord, SiSentry, SiGrafana, SiGithub } from '@icons-pack/react-simple-icons';

/**
 * See it in the flow.
 *
 * Two-column layout: geometric constellation on the left, one-signal-at-
 * a-time story panel on the right. Every beat is user-triggered via the
 * pill picker at top or the Replay button. No visual noise.
 */

type SourceKey = 'chat' | 'grafana' | 'sentry' | 'github';

interface Signal {
  source: SourceKey;
  headline: string;
  detail: string;
}

interface Preset {
  question: string;
  chip: string;
  sources: SourceKey[];
  signals: Signal[];
  answer: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    question: 'any redis issues in the last month?',
    chip: 'redis history',
    sources: ['grafana', 'chat', 'sentry'],
    signals: [
      {
        source: 'grafana',
        headline: 'Redis primary CPU 94%',
        detail: 'alert fired 3 days ago on redis-primary-01. replica lag climbed to 40s.'
      },
      {
        source: 'chat',
        headline: 'Tom promoted the replica',
        detail: '#incidents thread, 3 days ago. session cache misses briefly spiked then recovered.'
      },
      {
        source: 'sentry',
        headline: 'redis.exceptions.ConnectionError',
        detail: '3,200 events over 12m from notification-worker after the DB migration deploy.'
      }
    ],
    answer: (
      <>
        Three redis events last month, one root pattern: connection-pool exhaustion under promo
        spikes. See <CitePill id="INC-b72094" /> and <CitePill id="INC-e40956" />. Tom already
        wrote the failover playbook: <CitePill id="RB-a12034" kind="rb" />.
      </>
    )
  },
  {
    question: 'is this checkout error new or have we seen it?',
    chip: 'checkout regression',
    sources: ['sentry', 'chat', 'github'],
    signals: [
      {
        source: 'sentry',
        headline: 'TypeError · finalize.ts:42',
        detail: 'Cannot read total of undefined. 47 events in the last 8 minutes.'
      },
      {
        source: 'chat',
        headline: 'Same trace, two months ago',
        detail: '#engineering. Sam flagged Stripe webhook nulling customer on guest checkout.'
      },
      {
        source: 'github',
        headline: 'PR #4218 fixed it',
        detail: 'merged 74 days ago. optional chaining on payload.customer.'
      }
    ],
    answer: (
      <>
        Not new. Same stack trace as <CitePill id="INC-e40956" /> two months ago. Fix landed in
        PR #4218 <CitePill id="RB-b3d201" kind="rb" />. Check whether the fix was reverted or a
        new caller bypassed the guard.
      </>
    )
  },
  {
    question: 'what shipped just before this alert fired?',
    chip: 'deploy correlation',
    sources: ['grafana', 'github'],
    signals: [
      {
        source: 'grafana',
        headline: 'API gateway 5xx spike',
        detail: 'started 14:32 UTC. upstream service: checkout-svc.'
      },
      {
        source: 'github',
        headline: 'checkout-svc v2.4.1 deploy',
        detail: 'shipped 14:29 UTC. exactly 3 minutes before the spike.'
      }
    ],
    answer: (
      <>
        checkout-svc v2.4.1 deployed 3 minutes before the alert{' '}
        <CitePill id="INC-8ab203" />. Roll it back with{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">
          kubectl rollout undo deploy/checkout-svc
        </code>
        . Full runbook: <CitePill id="RB-a12034" kind="rb" />.
      </>
    )
  }
];

type Phase = 'idle' | 'typing' | 'querying' | 'signals' | 'synth' | 'answer';

export function IntegrationShowcase() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [signalIdx, setSignalIdx] = useState(-1);

  const preset = PRESETS[presetIdx]!;

  useEffect(() => {
    const t = setTimeout(() => setPhase('typing'), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'typing') return;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (i > preset.question.length) {
        setTimeout(() => setPhase('querying'), 500);
        return;
      }
      setTyped(preset.question.slice(0, i));
      i += 1;
      setTimeout(tick, 28);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [phase, preset.question]);

  useEffect(() => {
    if (phase !== 'querying') return;
    const t = setTimeout(() => {
      setSignalIdx(0);
      setPhase('signals');
    }, 900);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'signals') return;
    if (signalIdx >= preset.signals.length - 1) {
      const t = setTimeout(() => setPhase('synth'), 1500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSignalIdx((n) => n + 1), 1600);
    return () => clearTimeout(t);
  }, [phase, signalIdx, preset.signals.length]);

  useEffect(() => {
    if (phase !== 'synth') return;
    const t = setTimeout(() => setPhase('answer'), 1000);
    return () => clearTimeout(t);
  }, [phase]);

  const replay = useCallback(() => {
    setTyped('');
    setSignalIdx(-1);
    setPhase('typing');
  }, []);

  const jumpTo = useCallback((i: number) => {
    setPresetIdx(i);
    setTyped('');
    setSignalIdx(-1);
    setPhase('typing');
  }, []);

  const beat = phase === 'querying' || phase === 'signals' || phase === 'synth' || phase === 'answer';
  const isLit = useCallback(
    (s: SourceKey) => beat && preset.sources.includes(s),
    [beat, preset.sources]
  );
  const isReturned = useCallback(
    (s: SourceKey) => {
      if (phase !== 'signals' && phase !== 'synth' && phase !== 'answer') return false;
      const returnedSoFar = preset.signals.slice(0, signalIdx + 1);
      return returnedSoFar.some((sig) => sig.source === s);
    },
    [phase, signalIdx, preset.signals]
  );

  const currentSignal = phase === 'signals' ? preset.signals[signalIdx] ?? null : null;

  return (
    <div>
      {/* Question pill picker */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {PRESETS.map((p, i) => {
          const active = i === presetIdx;
          return (
            <button
              key={p.chip}
              type="button"
              onClick={() => jumpTo(i)}
              className={`text-[13px] px-3.5 py-1.5 rounded-full border ${
                active
                  ? 'bg-white text-neutral-900 border-white'
                  : 'border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
              }`}
            >
              {p.chip}
            </button>
          );
        })}
        <button
          type="button"
          onClick={replay}
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-200"
          title="Replay"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replay
        </button>
      </div>

      {/* Two-column stage. Left: constellation. Right: story panel.
          On narrow screens they stack, constellation first. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] gap-10 lg:gap-14 items-center">
        <div className="flex justify-center">
          <Constellation phase={phase} isLit={isLit} isReturned={isReturned} />
        </div>

        <StoryPanel
          phase={phase}
          typed={typed}
          currentSignal={currentSignal}
          preset={preset}
        />
      </div>
    </div>
  );
}

/* CONSTELLATION */

function Constellation({
  phase,
  isLit,
  isReturned
}: {
  phase: Phase;
  isLit: (s: SourceKey) => boolean;
  isReturned: (s: SourceKey) => boolean;
}) {
  // 4 source positions on a circle, evenly spaced.
  // Positions on a circle inset by ~14% so the node discs and their label
  // captions have room without clipping the container edges.
  const NODES: Array<{
    key: SourceKey;
    label: string;
    icon: React.ReactNode;
    top: string;
    left: string;
    labelBelow: boolean;
  }> = [
    { key: 'chat', label: 'Slack', icon: <ChatIcon />, top: '14%', left: '50%', labelBelow: false },
    { key: 'sentry', label: 'Sentry', icon: <SiSentry size={18} color="#c9a6ff" />, top: '50%', left: '86%', labelBelow: true },
    { key: 'github', label: 'GitHub', icon: <SiGithub size={18} color="#e6e6e6" />, top: '86%', left: '50%', labelBelow: true },
    { key: 'grafana', label: 'Grafana', icon: <SiGrafana size={18} color="#f5a623" />, top: '50%', left: '14%', labelBelow: true }
  ];

  const showGlow = phase === 'synth' || phase === 'answer';

  return (
    <div
      className="relative mx-auto"
      style={{
        width: 'min(440px, 90vw)',
        height: 'min(440px, 90vw)'
      }}
    >
      {/* Radial glow at center */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`h-32 w-32 rounded-full bg-sky-500/10 blur-3xl transition-opacity duration-1000 ${
            showGlow ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Concentric ring for visual anchor. Sized so the source nodes sit
          just outside the ring instead of clipping through it. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[240px] w-[240px] rounded-full border border-dashed border-neutral-900" />
      </div>

      {/* Connection lines drawn as SVG so we can animate stroke */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {(
          [
            ['chat', 50, 14, 50, 50],
            ['sentry', 86, 50, 50, 50],
            ['github', 50, 86, 50, 50],
            ['grafana', 14, 50, 50, 50]
          ] as Array<[SourceKey, number, number, number, number]>
        ).map(([key, x1, y1, x2, y2]) => {
          const lit = isLit(key);
          const returned = isReturned(key);
          const stroke = returned ? '#38bdf8' : lit ? '#525252' : '#262626';
          const opacity = returned ? 0.9 : lit ? 0.7 : 0.4;
          return (
            <line
              key={key}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={0.35}
              strokeDasharray={lit && !returned ? '1.5 1.5' : '0'}
              opacity={opacity}
              style={{ transition: 'stroke 400ms ease, opacity 400ms ease' }}
            />
          );
        })}
      </svg>

      {/* Source nodes */}
      {NODES.map((n) => {
        const lit = isLit(n.key);
        const returned = isReturned(n.key);
        return (
          <div
            key={n.key}
            className="absolute"
            style={{
              top: n.top,
              left: n.left,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <SourceNode
              label={n.label}
              icon={n.icon}
              lit={lit}
              returned={returned}
              labelAbove={n.key === 'chat'}
            />
          </div>
        );
      })}

      {/* Center: helena */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className={`h-[68px] w-[68px] rounded-full border flex items-center justify-center bg-neutral-950 transition-all duration-500 ${
            showGlow
              ? 'border-sky-800 shadow-[0_0_40px_-4px_rgba(56,189,248,0.5)]'
              : 'border-neutral-800'
          }`}
        >
          <Image src="/logo.png" alt="helena" width={30} height={30} priority className="opacity-95" />
        </div>
      </div>
    </div>
  );
}

function SourceNode({
  label,
  icon,
  lit,
  returned,
  labelAbove
}: {
  label: string;
  icon: React.ReactNode;
  lit: boolean;
  returned: boolean;
  labelAbove?: boolean;
}) {
  const labelEl = (
    <div
      className={`text-[10px] font-medium uppercase tracking-widest whitespace-nowrap transition-colors ${
        returned ? 'text-sky-300' : lit ? 'text-neutral-200' : 'text-neutral-500'
      }`}
    >
      {label}
    </div>
  );
  return (
    <div className="flex flex-col items-center">
      {labelAbove && <div className="mb-2">{labelEl}</div>}
      <div
        className={`h-[52px] w-[52px] rounded-full border flex items-center justify-center bg-neutral-950 transition-all duration-500 ${
          returned
            ? 'border-sky-800 shadow-[0_0_24px_-6px_rgba(56,189,248,0.55)]'
            : lit
              ? 'border-neutral-700'
              : 'border-neutral-800'
        }`}
      >
        {icon}
      </div>
      {!labelAbove && <div className="mt-2">{labelEl}</div>}
    </div>
  );
}

function ChatIcon() {
  return <SlackMark size={18} />;
}

/* STORY PANEL */

function StoryPanel({
  phase,
  typed,
  currentSignal,
  preset
}: {
  phase: Phase;
  typed: string;
  currentSignal: Signal | null;
  preset: Preset;
}) {
  return (
    <div className="w-full">
      {/* You ask */}
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
        You ask
      </div>
      <div className="text-[15px] leading-6 text-neutral-100 mb-8 min-h-[3rem]">
        {typed}
        {phase === 'typing' && (
          <span className="inline-block w-[1px] h-4 bg-neutral-300 ml-0.5 align-middle animate-pulse" />
        )}
      </div>

      {/* State-driven right panel */}
      <div className="min-h-[220px]">
        {phase === 'querying' && (
          <div className="text-[13px] text-neutral-500 flex items-center gap-2 animate-fade-in-up">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Fanning out to {preset.sources.length} sources
          </div>
        )}

        {phase === 'signals' && currentSignal && (
          <SignalCard key={currentSignal.headline} signal={currentSignal} />
        )}

        {phase === 'synth' && (
          <div className="text-[13px] text-neutral-500 flex items-center gap-2 animate-fade-in-up">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Combining signals into one answer
          </div>
        )}

        {phase === 'answer' && (
          <div className="animate-fade-in-up">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
              helena answers
            </div>
            <div className="text-[14px] leading-relaxed text-neutral-100">{preset.answer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const meta = SOURCE_META[signal.source];
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest mb-1.5" style={{ color: meta.color }}>
        {meta.icon}
        {meta.label}
      </div>
      <div className="text-[15px] text-neutral-100 leading-snug mb-1">{signal.headline}</div>
      <div className="text-[12px] text-neutral-500 leading-relaxed">{signal.detail}</div>
    </div>
  );
}

const SOURCE_META: Record<SourceKey, { label: string; icon: React.ReactNode; color: string }> = {
  chat: { label: 'Chat', icon: <SlackMark size={11} />, color: '#93c5fd' },
  grafana: { label: 'Grafana', icon: <SiGrafana size={11} color="#f5a623" />, color: '#f5a623' },
  sentry: { label: 'Sentry', icon: <SiSentry size={11} color="#c9a6ff" />, color: '#c9a6ff' },
  github: { label: 'GitHub', icon: <SiGithub size={11} color="#e6e6e6" />, color: '#e6e6e6' }
};

/* ATOMS */

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

function SlackMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 122.8 122.8" width={size} height={size} aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}
