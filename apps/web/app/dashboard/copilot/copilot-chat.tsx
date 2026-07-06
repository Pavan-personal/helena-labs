'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Search,
  FileText,
  BookOpen,
  Cpu,
  CircleCheck,
  Loader2,
  ImageIcon,
  X,
  Paperclip,
  ScrollText,
  FileSpreadsheet
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
  attachmentPreviews?: string[];
  live: LiveEvent[];
  assistant: AssistantRow | null;
  error: string | null;
  running: boolean;
}

interface PendingAttachment {
  id: string;
  previewUrl: string;
  name: string;
  bytes: number;
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
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Force auto-scroll to bottom on every turn/live-event change.
  // Using a "shouldAutoScroll" ref would let the user opt out by scrolling up,
  // but for the demo we keep it always-follow so judges see the trace stream.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  // Revoke blob: URLs when the component unmounts to avoid a memory leak
  // from lots of dropped screenshots during a long session.
  useEffect(() => {
    return () => {
      for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    };
  }, [attachments]);

  const uploadFile = useCallback(
    async (file: File): Promise<PendingAttachment | null> => {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch(`/api/copilot/upload?hs=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) return null;
      const { attachmentId } = (await res.json()) as { attachmentId: string };
      return {
        id: attachmentId,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        bytes: file.size
      };
    },
    [token]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (uploading) return;
      const list = Array.from(files).filter((f) =>
        ['image/png', 'image/jpeg', 'image/webp'].includes(f.type)
      );
      if (list.length === 0) return;
      setUploading(true);
      try {
        for (const f of list) {
          const up = await uploadFile(f);
          if (up) setAttachments((prev) => [...prev, up]);
        }
      } finally {
        setUploading(false);
      }
    },
    [uploading, uploadFile]
  );

  const sendMessage = useCallback(
    async (text: string, extraAttachmentIds?: string[]) => {
      const currentAttachmentIds = extraAttachmentIds ?? attachments.map((a) => a.id);
      if ((!text.trim() && currentAttachmentIds.length === 0) || sending) return;
      setSending(true);
      const turnId = crypto.randomUUID();
      const previews = attachments.map((a) => a.previewUrl);
      const newTurn: TurnRecord = {
        turnId,
        userText: text,
        attachmentPreviews: previews.length > 0 ? previews : undefined,
        live: [],
        assistant: null,
        error: null,
        running: true
      };
      setTurns((prev) => [...prev, newTurn]);
      setAttachments([]);

      try {
        const res = await fetch('/api/copilot/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: threadId ?? undefined,
            userText: text,
            turnId,
            attachmentIds: currentAttachmentIds,
            hs: token
          })
        });
        if (!res.ok || !res.body) {
          let humanError: string;
          const raw = await res.text().catch(() => '');
          if (res.status === 429) {
            humanError = 'Too many chats running at once. Wait for one to finish and try again.';
          } else if (res.status === 401) {
            humanError = 'Session expired. Reload the page to sign in again.';
          } else if (res.status === 409) {
            humanError = 'This message was already sent. Refresh to see the reply.';
          } else if (res.status >= 500) {
            humanError = `Server error (${res.status}). Retry in a moment.`;
          } else {
            humanError = `HTTP ${res.status}: ${raw.slice(0, 160)}`;
          }
          setTurns((prev) =>
            prev.map((t) =>
              t.turnId === turnId
                ? { ...t, running: false, error: humanError }
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
    [sending, threadId, token, attachments]
  );

  return (
    <div
      className={`border rounded-xl bg-neutral-950/40 flex flex-col overflow-hidden transition-colors ${
        dragOver ? 'border-sky-500 bg-sky-950/20' : 'border-neutral-800'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {turns.length === 0 && <EmptyState onSuggest={(t) => sendMessage(t)} />}
        {turns.map((t) => (
          <TurnBlock
            key={t.turnId}
            turn={t}
            token={token}
            onFollowUp={(prompt) => sendMessage(prompt)}
          />
        ))}
      </div>

      <div className="border-t border-neutral-900 p-3 bg-neutral-950/60">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="relative group h-14 w-14 rounded-md overflow-hidden border border-neutral-800"
              >
                <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/70 hover:bg-black text-neutral-200 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="h-14 w-14 rounded-md border border-dashed border-neutral-800 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text && attachments.length === 0) return;
            setInput('');
            sendMessage(text);
          }}
          className="flex gap-2 items-end"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 flex items-center justify-center"
            title="Attach screenshot"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.trim();
                if (!text && attachments.length === 0) return;
                setInput('');
                sendMessage(text);
              }
            }}
            onPaste={(e) => {
              const files: File[] = [];
              for (const item of Array.from(e.clipboardData.items)) {
                if (item.kind === 'file') {
                  const file = item.getAsFile();
                  if (file) files.push(file);
                }
              }
              if (files.length > 0) {
                e.preventDefault();
                handleFiles(files);
              }
            }}
            placeholder={
              dragOver
                ? 'Drop images anywhere to attach'
                : 'Ask about incidents, or drop / paste a screenshot...'
            }
            rows={2}
            className="flex-1 resize-none rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || (!input.trim() && attachments.length === 0)}
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

function TurnBlock({
  turn,
  onFollowUp,
  token
}: {
  turn: TurnRecord;
  onFollowUp: (prompt: string) => void;
  token: string;
}) {
  return (
    <div className="space-y-4">
      <UserBubble text={turn.userText} previews={turn.attachmentPreviews} />
      <div className="space-y-1.5">
        {turn.live.map((e, i) => (
          <TraceRow key={i} event={e} settled={!turn.running} />
        ))}
      </div>
      {turn.assistant && <AssistantBubble msg={turn.assistant} onFollowUp={onFollowUp} token={token} />}
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

function UserBubble({ text, previews }: { text: string; previews?: string[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] flex flex-col items-end gap-2">
        {previews && previews.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {previews.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="attachment"
                className="h-24 w-24 rounded-md border border-neutral-800 object-cover"
              />
            ))}
          </div>
        )}
        {text && (
          <div className="rounded-2xl bg-neutral-800 text-sm text-neutral-100 px-4 py-2.5">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceRow({ event, settled }: { event: LiveEvent; settled: boolean }) {
  if (event.kind === 'status') {
    return (
      <div className="text-[11px] text-neutral-500 flex items-center gap-2">
        {settled ? (
          <CircleCheck className="h-3 w-3 text-neutral-600" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-600" />
        )}
        {humanizeStatus(event.row.kind, settled)}
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

function AssistantBubble({
  msg,
  onFollowUp,
  token
}: {
  msg: AssistantRow;
  onFollowUp: (prompt: string) => void;
  token: string;
}) {
  const hasCitations = msg.citations && msg.citations.length > 0;
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
      <div className="text-sm text-neutral-200 leading-relaxed">
        <ChatMarkdown text={msg.markdown} token={token} />
      </div>
      {hasCitations && (
        <div className="mt-4 pt-3 border-t border-neutral-900 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const ids = msg.citations
                .filter((c) => c.kind === 'incident')
                .map((c) => `INC-${c.id.slice(0, 6)}`)
                .join(', ');
              onFollowUp(
                `Draft a blameless post-mortem based on ${ids || 'the incidents you just cited'}. Include symptom, detection, diagnosis steps, resolution, and prevention.`
              );
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-neutral-800 text-[11px] text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            <ScrollText className="h-3 w-3" strokeWidth={1.75} />
            Generate post-mortem
          </button>
          <button
            type="button"
            onClick={() => {
              const ids = msg.citations
                .filter((c) => c.kind === 'incident')
                .map((c) => `INC-${c.id.slice(0, 6)}`)
                .join(', ');
              onFollowUp(
                `Write a 4-line exec brief for the CEO/CTO covering ${ids || 'these incidents'}. No jargon. Business impact first, then technical summary, then what we did, then risk of recurrence.`
              );
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-neutral-800 text-[11px] text-neutral-300 hover:border-neutral-600 hover:text-white"
          >
            <FileSpreadsheet className="h-3 w-3" strokeWidth={1.75} />
            Exec brief
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Turn "[INC-abcdef]" and "[RB-abcdef]" into real markdown links first so
 * react-markdown renders them as clickable <a>, then style the <a> as pills.
 */
function preprocessCitationsToLinks(text: string, token: string): string {
  return text.replace(/\[(INC|RB)-([a-f0-9]{6,})\]/gi, (_, kind, id) => {
    const route = String(kind).toUpperCase() === 'INC' ? 'incidents' : 'runbooks';
    const url = `/dashboard/${route}/${id}?hs=${encodeURIComponent(token)}`;
    return `[${String(kind).toUpperCase()}-${id.slice(0, 6)}](${url})`;
  });
}

function ChatMarkdown({ text, token }: { text: string; token: string }) {
  const withLinks = preprocessCitationsToLinks(text, token);
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-neutral-200">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-2 space-y-1 marker:text-neutral-600">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-2 space-y-1 marker:text-neutral-600">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[12px] text-neutral-200 font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 rounded-lg bg-black/40 border border-neutral-800 p-3 overflow-x-auto text-[12px] font-mono">
            {children}
          </pre>
        ),
        a: ({ href, children }) => {
          const isCitation = typeof href === 'string' && /\/dashboard\/(incidents|runbooks)\//.test(href);
          if (isCitation) {
            return (
              <Link
                href={href!}
                className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-mono bg-sky-950/60 text-sky-300 border border-sky-900/60 hover:bg-sky-900/50 no-underline"
              >
                {children}
              </Link>
            );
          }
          return (
            <a href={href} className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
              {children}
            </a>
          );
        },
        h1: ({ children }) => <h3 className="text-white font-semibold text-base mt-2 mb-1">{children}</h3>,
        h2: ({ children }) => <h3 className="text-white font-semibold text-sm mt-2 mb-1">{children}</h3>,
        h3: ({ children }) => <h4 className="text-neutral-100 font-semibold text-sm mt-2 mb-1">{children}</h4>
      }}
    >
      {withLinks}
    </ReactMarkdown>
  );
}

function humanizeStatus(kind: string, settled: boolean): string {
  const live: Record<string, string> = {
    classifying: 'Classifying the question...',
    reasoning: 'Reasoning across your memory...',
    validating_citations: 'Validating citations...',
    regenerating_for_citations: 'One citation looked off, regenerating...',
    drafting: 'Drafting response...',
    vision_start: 'Running dual-model vision consensus...'
  };
  const done: Record<string, string> = {
    classifying: 'Classified',
    reasoning: 'Reasoned across memory',
    validating_citations: 'Citations validated',
    regenerating_for_citations: 'Regenerated for citations',
    drafting: 'Drafted',
    vision_start: 'Vision consensus complete'
  };
  const table = settled ? done : live;
  return table[kind] ?? kind;
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
