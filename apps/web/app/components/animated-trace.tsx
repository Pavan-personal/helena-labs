'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Cpu, FileText, CircleCheck, Loader2 } from 'lucide-react';

/**
 * Animated hero: user query types character by character, then the trace
 * stream fills in pill by pill, then the final answer reveals. Plays once
 * on mount, no loop. On reload it plays again.
 */

const QUERY = 'any redis issues in the last month?';

type Step =
  | { kind: 'typing'; text: string }
  | { kind: 'status'; label: string }
  | { kind: 'model'; model: string; reason: string }
  | { kind: 'tool_call'; name: string; args: string }
  | { kind: 'tool_result'; text: string }
  | { kind: 'answer' };

const SCRIPT: Array<{ delay: number; step: Step }> = [
  { delay: 0, step: { kind: 'typing', text: '' } },
  { delay: 500, step: { kind: 'status', label: 'Classified' } },
  { delay: 250, step: { kind: 'model', model: 'gpt-4o-mini', reason: 'classifier' } },
  { delay: 300, step: { kind: 'model', model: 'btl-2', reason: 'main loop (DEEP_REASON)' } },
  { delay: 350, step: { kind: 'status', label: 'Reasoned across memory' } },
  { delay: 450, step: { kind: 'tool_call', name: 'search_incidents', args: '{"query":"redis"}' } },
  { delay: 700, step: { kind: 'tool_result', text: '3 incidents matched (47ms)' } },
  { delay: 350, step: { kind: 'status', label: 'Citations validated' } },
  { delay: 500, step: { kind: 'answer' } }
];

export function AnimatedTrace() {
  const [visibleCount, setVisibleCount] = useState(1);
  const [typed, setTyped] = useState('');

  // Type the query character by character.
  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i > QUERY.length) return;
      setTyped(QUERY.slice(0, i));
      i += 1;
      setTimeout(tick, 28);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reveal the trace steps in sequence.
  useEffect(() => {
    if (visibleCount >= SCRIPT.length) return;
    const t = setTimeout(() => setVisibleCount((c) => c + 1), SCRIPT[visibleCount]!.delay);
    return () => clearTimeout(t);
  }, [visibleCount]);

  const shownSteps = SCRIPT.slice(0, visibleCount);
  const answerRevealed = shownSteps.some((s) => s.step.kind === 'answer');

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 backdrop-blur p-4 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 pb-3 border-b border-neutral-900 mb-3">
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="h-2 w-2 rounded-full bg-neutral-800" />
        <div className="text-[10px] text-neutral-600 ml-2 font-mono">/dashboard/copilot</div>
      </div>

      {/* User query — types itself */}
      <div className="text-right mb-3">
        <div className="inline-block rounded-2xl bg-neutral-800 text-[13px] text-neutral-100 px-3.5 py-2 max-w-[80%] text-left min-w-[80px]">
          {typed}
          {typed.length < QUERY.length && (
            <span className="inline-block w-1 h-3.5 bg-neutral-300 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
      </div>

      {/* Trace stream */}
      <div className="space-y-2 mb-3 min-h-[140px]">
        {shownSteps.slice(1).map((entry, i) => {
          const s = entry.step;
          if (s.kind === 'status') {
            return (
              <div
                key={i}
                className="text-[11px] text-neutral-500 flex items-center gap-2 animate-fade-in-up"
              >
                <CircleCheck className="h-3 w-3 text-neutral-600" />
                {s.label}
              </div>
            );
          }
          if (s.kind === 'model') {
            return (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 text-[10px] text-neutral-400 border border-neutral-800 bg-neutral-950/60 rounded px-2 py-0.5 font-mono mr-1.5 animate-fade-in-up"
              >
                <Cpu className="h-3 w-3" strokeWidth={1.5} />
                {s.model}
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-500">{s.reason}</span>
              </div>
            );
          }
          if (s.kind === 'tool_call') {
            return (
              <div
                key={i}
                className="text-[11px] text-neutral-400 flex items-center gap-2 animate-fade-in-up"
              >
                <FileText className="h-3 w-3 text-amber-500" />
                <span className="font-mono">{s.name}</span>
                <span className="text-neutral-600 truncate font-mono">{s.args}</span>
              </div>
            );
          }
          if (s.kind === 'tool_result') {
            return (
              <div
                key={i}
                className="text-[11px] text-neutral-400 flex items-center gap-2 pl-5 animate-fade-in-up"
              >
                <CircleCheck className="h-3 w-3 text-emerald-500" />
                <span className="text-neutral-500">{s.text}</span>
              </div>
            );
          }
          if (s.kind === 'answer') {
            return null;
          }
          return null;
        })}
        {!answerRevealed && shownSteps.length > 3 && (
          <div className="text-[11px] text-neutral-600 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            drafting response...
          </div>
        )}
      </div>

      {/* Final answer */}
      {answerRevealed && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3.5 animate-fade-in-up">
          <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-2">
            <Sparkles className="h-3 w-3 text-neutral-500" strokeWidth={1.75} />
            helena
            <span className="text-neutral-700">·</span>
            <span className="font-mono">btl-2</span>
            <span className="text-neutral-700">·</span>
            <span>2.4s</span>
          </div>
          <div className="text-[12px] text-neutral-200 leading-relaxed">
            Three redis events last month. The pattern is{' '}
            <span className="text-neutral-100">connection-pool exhaustion under promo spikes</span>{' '}
            <CitePill id="INC-b72094" />
            , <span className="text-neutral-100">CPU pegged from a scan</span>{' '}
            <CitePill id="INC-e40956" />, and one{' '}
            <span className="text-neutral-100">replica lag &gt;30s</span>{' '}
            <CitePill id="INC-09f597" />. Runbook <CitePill id="RB-a12034" kind="rb" /> covers the
            failover.
          </div>
        </div>
      )}
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
