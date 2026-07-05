'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Sparkles,
  Search,
  FileText,
  BookOpen,
  Cpu,
  CircleCheck,
  Loader2
} from 'lucide-react';

interface StatusRow {
  kind: string;
}
interface ModelSwitchRow {
  model: string;
  reason: string;
}
interface ToolCallRow {
  id: string;
  name: string;
  args: string;
}
interface ToolResultRow {
  id: string;
  name: string;
  summary: string;
  count?: number;
}
interface AssistantRow {
  markdown: string;
  citations: Array<{ kind: string; id: string; raw: string }>;
  model: string;
  citations_valid: boolean;
  latency_ms: number;
}

type LiveEvent =
  | { kind: 'status'; row: StatusRow }
  | { kind: 'model_switch'; row: ModelSwitchRow }
  | { kind: 'tool_call'; row: ToolCallRow }
  | { kind: 'tool_result'; row: ToolResultRow };

interface TurnRecord {
  turnId: string;
  userText: string;
  live: LiveEvent[];
  assistant: AssistantRow | null;
  error: string | null;
  running: boolean;
}

export function CopilotChat({
  token,
  initialThreadId
}: {
  token: string;
  initialThreadId: string | null;
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate messages if we opened an existing thread
  useEffect(() => {
    if (!initialThreadId) {
      setTurns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/copilot/threads/${initialThreadId}/messages?hs=${encodeURIComponent(token)}`
      );
      if (!res.ok) return;
      const { messages } = (await res.json()) as { messages: HydratedMessage[] };
      if (cancelled) return;
      setTurns(rebuildTurns(messages));
    })();
    return () => {
      cancelled = true;
    };
  }, [initialThreadId, token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [turns]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setSending(true);
      const turnId = crypto.randomUUID();
      const newTurn: TurnRecord = {
        turnId,
        userText: text,
        live: [],
        assistant: null,
        error: null,
        running: true
      };
      setTurns((prev) => [...prev, newTurn]);

      try {
        const res = await fetch('/api/copilot/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: threadId ?? undefined,
            userText: text,
            turnId,
            hs: token
          })
        });
        if (!res.ok || !res.body) {
          const err = await res.text().catch(() => '');
          setTurns((prev) =>
            prev.map((t) =>
              t.turnId === turnId
                ? { ...t, running: false, error: `HTTP ${res.status}: ${err.slice(0, 200)}` }
                : t
            )
          );
          return;
        }

        // If we didn't have a threadId, fish it out of thread list
        if (!threadId) {
          try {
            const list = await fetch(
              `/api/copilot/threads?hs=${encodeURIComponent(token)}`
            ).then((r) => r.json());
            if (list.threads?.[0]?.id) setThreadId(list.threads[0].id);
          } catch {}
        }

        // Parse SSE
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const parsed = parseSseFrame(frame);
            if (!parsed) continue;
            applyFrame(turnId, parsed, setTurns);
          }
        }
        setTurns((prev) =>
          prev.map((t) => (t.turnId === turnId ? { ...t, running: false } : t))
        );
      } catch (e) {
        setTurns((prev) =>
          prev.map((t) =>
            t.turnId === turnId
              ? { ...t, running: false, error: e instanceof Error ? e.message : 'unknown' }
              : t
          )
        );
      } finally {
        setSending(false);
      }
    },
    [sending, threadId, token]
  );

  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-950/40 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {turns.length === 0 && <EmptyState onSuggest={sendMessage} />}
        {turns.map((t) => (
          <TurnBlock key={t.turnId} turn={t} />
        ))}
      </div>

      <div className="border-t border-neutral-900 p-3 bg-neutral-950/60">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text) return;
            setInput('');
            sendMessage(text);
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.trim();
                if (!text) return;
                setInput('');
                sendMessage(text);
              }
            }}
            placeholder="Ask about incidents, runbooks, or paste an alert..."
            rows={2}
            className="flex-1 resize-none rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 h-10 w-10 rounded-lg bg-white text-neutral-900 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }) {
  const suggestions = [
    'What are the recent incidents?',
    'Any grafana alerts today?',
    'Show me runbooks that exist',
    'Has this happened before?'
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <Sparkles className="h-8 w-8 text-neutral-500 mb-3" strokeWidth={1.5} />
      <div className="text-neutral-300 mb-1">Start a conversation</div>
      <div className="text-xs text-neutral-500 mb-6 max-w-md">
        Ask about your incident memory. Every response cites specific incidents so you can
        verify.
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-xl">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="text-left px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950/40 text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnBlock({ turn }: { turn: TurnRecord }) {
  return (
    <div className="space-y-4">
      <UserBubble text={turn.userText} />
      <div className="space-y-1.5">
        {turn.live.map((e, i) => (
          <TraceRow key={i} event={e} />
        ))}
      </div>
      {turn.assistant && <AssistantBubble msg={turn.assistant} />}
      {turn.running && !turn.assistant && (
        <div className="text-xs text-neutral-500 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> working...
        </div>
      )}
      {turn.error && (
        <div className="text-xs text-red-400 rounded border border-red-950 bg-red-950/20 p-2">
          {turn.error}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-neutral-800 text-sm text-neutral-100 px-4 py-2.5">
        {text}
      </div>
    </div>
  );
}

function TraceRow({ event }: { event: LiveEvent }) {
  if (event.kind === 'status') {
    return (
      <div className="text-[11px] text-neutral-500 flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin text-neutral-600" />
        {humanizeStatus(event.row.kind)}
      </div>
    );
  }
  if (event.kind === 'model_switch') {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400 border border-neutral-800 bg-neutral-950/60 rounded px-2 py-0.5 font-mono">
        <Cpu className="h-3 w-3" strokeWidth={1.5} />
        {event.row.model}
        <span className="text-neutral-600">·</span>
        <span className="text-neutral-500">{event.row.reason}</span>
      </div>
    );
  }
  if (event.kind === 'tool_call') {
    return (
      <div className="text-[11px] text-neutral-400 flex items-center gap-2">
        <ToolIcon name={event.row.name} />
        <span className="font-mono">{event.row.name}</span>
        <span className="text-neutral-600 truncate">{event.row.args}</span>
      </div>
    );
  }
  if (event.kind === 'tool_result') {
    return (
      <div className="text-[11px] text-neutral-400 flex items-center gap-2 pl-5">
        <CircleCheck className="h-3 w-3 text-emerald-500" />
        <span className="text-neutral-500">{event.row.summary}</span>
      </div>
    );
  }
  return null;
}

function ToolIcon({ name }: { name: string }) {
  if (name.startsWith('search') || name.startsWith('find'))
    return <Search className="h-3 w-3 text-sky-500" />;
  if (name.startsWith('get_incident') || name.startsWith('list_recent'))
    return <FileText className="h-3 w-3 text-amber-500" />;
  if (name.includes('runbook')) return <BookOpen className="h-3 w-3 text-emerald-500" />;
  return <FileText className="h-3 w-3 text-neutral-500" />;
}

function AssistantBubble({ msg }: { msg: AssistantRow }) {
  return (
    <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 p-4">
      <div className="text-[11px] text-neutral-500 flex items-center gap-2 mb-2">
        <Sparkles className="h-3 w-3 text-neutral-500" strokeWidth={1.75} />
        helena
        <span className="text-neutral-700">·</span>
        <span className="font-mono">{msg.model}</span>
        <span className="text-neutral-700">·</span>
        <span>{(msg.latency_ms / 1000).toFixed(1)}s</span>
        {!msg.citations_valid && msg.citations.length > 0 && (
          <span className="text-amber-400 ml-auto">unverified citations</span>
        )}
      </div>
      <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
        {renderMarkdownWithCitations(msg.markdown)}
      </div>
    </div>
  );
}

function renderMarkdownWithCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[(INC|RB)-([a-f0-9]{6,})\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const kind = match[1] ?? '';
    const id = match[2] ?? '';
    parts.push(
      <span
        key={`c-${key++}`}
        className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-mono bg-sky-950/60 text-sky-300 border border-sky-900/60"
      >
        {kind.toUpperCase()}-{id.slice(0, 6)}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function humanizeStatus(kind: string): string {
  switch (kind) {
    case 'classifying':
      return 'Classifying the question...';
    case 'reasoning':
      return 'Reasoning across your memory...';
    case 'validating_citations':
      return 'Validating citations...';
    case 'regenerating_for_citations':
      return 'One citation looked off, regenerating...';
    case 'drafting':
      return 'Drafting response...';
    default:
      return kind;
  }
}

interface SseParsed {
  type: string;
  data: Record<string, unknown>;
}

function parseSseFrame(frame: string): SseParsed | null {
  const lines = frame.split('\n').filter(Boolean);
  let type = '';
  let dataStr = '';
  for (const l of lines) {
    if (l.startsWith('event:')) type = l.slice(6).trim();
    else if (l.startsWith('data:')) dataStr += l.slice(5).trim();
  }
  if (!type || !dataStr) return null;
  try {
    return { type, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

function applyFrame(
  turnId: string,
  parsed: SseParsed,
  setTurns: React.Dispatch<React.SetStateAction<TurnRecord[]>>
): void {
  setTurns((prev) =>
    prev.map((t) => {
      if (t.turnId !== turnId) return t;
      switch (parsed.type) {
        case 'status':
          return { ...t, live: [...t.live, { kind: 'status', row: parsed.data as unknown as StatusRow }] };
        case 'model_switch':
          return {
            ...t,
            live: [...t.live, { kind: 'model_switch', row: parsed.data as unknown as ModelSwitchRow }]
          };
        case 'tool_call':
          return { ...t, live: [...t.live, { kind: 'tool_call', row: parsed.data as unknown as ToolCallRow }] };
        case 'tool_result':
          return {
            ...t,
            live: [...t.live, { kind: 'tool_result', row: parsed.data as unknown as ToolResultRow }]
          };
        case 'message':
          return { ...t, assistant: parsed.data as unknown as AssistantRow };
        case 'error':
          return {
            ...t,
            error: String((parsed.data as { message?: string }).message ?? 'unknown error')
          };
        default:
          return t;
      }
    })
  );
}

interface HydratedMessage {
  id: number;
  turn_id: string;
  role: string;
  content: string | null;
  model: string | null;
  tool_name: string | null;
  citations: unknown;
  citations_valid: boolean | null;
  latency_ms: number | null;
}

function rebuildTurns(messages: HydratedMessage[]): TurnRecord[] {
  const byTurn = new Map<string, TurnRecord>();
  for (const m of messages) {
    let rec = byTurn.get(m.turn_id);
    if (!rec) {
      rec = {
        turnId: m.turn_id,
        userText: '',
        live: [],
        assistant: null,
        error: null,
        running: false
      };
      byTurn.set(m.turn_id, rec);
    }
    if (m.role === 'user') rec.userText = m.content ?? '';
    else if (m.role === 'assistant') {
      rec.assistant = {
        markdown: m.content ?? '',
        citations: Array.isArray(m.citations) ? (m.citations as AssistantRow['citations']) : [],
        model: m.model ?? '',
        citations_valid: m.citations_valid ?? true,
        latency_ms: m.latency_ms ?? 0
      };
    } else if (m.role === 'tool_call') {
      rec.live.push({
        kind: 'tool_call',
        row: { id: m.tool_name ?? '', name: m.tool_name ?? '', args: m.content ?? '' }
      });
    } else if (m.role === 'tool_result') {
      rec.live.push({
        kind: 'tool_result',
        row: { id: m.tool_name ?? '', name: m.tool_name ?? '', summary: truncateResult(m.content) }
      });
    }
  }
  return Array.from(byTurn.values());
}

function truncateResult(content: string | null): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.count === 'number') return `${parsed.count} results`;
    if (typeof parsed.title === 'string') return parsed.title.slice(0, 60);
  } catch {}
  return content.slice(0, 60);
}
