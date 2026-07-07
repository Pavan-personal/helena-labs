import type OpenAI from 'openai';
import { getBtlClient, ROUTE_CONFIG, type RouteLabel } from './btl';
import { TOOL_DEFS, dispatchTool } from './tools';
import { MAIN_SYSTEM_PROMPT, CITATION_RETRY_PROMPT } from './prompts';
import { extractCitations, validateCitations } from './citations';
import type { createSseStream } from './sse';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type SseStream = ReturnType<typeof createSseStream>;

export interface RunLoopInput {
  label: RouteLabel;
  workspaceId: string;
  initialMessages: ChatMessage[];
  wallClockMs?: number;
  sse: SseStream;
  writeToolCallRow: (input: {
    toolCallId: string;
    name: string;
    args: string;
  }) => Promise<void>;
  writeToolResultRow: (input: {
    toolCallId: string;
    name: string;
    result: unknown;
  }) => Promise<void>;
}

export interface RunLoopResult {
  finalText: string;
  citationsValid: boolean;
  validatorNotes: string;
  citations: Array<{ kind: string; id: string; raw: string }>;
  model: string;
  latencyMs: number;
  toolCallsMade: number;
  timedOut: boolean;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Bounded ReAct-style loop. Caps at `toolCallCap` iterations and `wallClockMs`
 * wall clock. On timeout, emits a deterministic fallback answer that names
 * what we found so we still cite something.
 */
export async function runToolLoop(input: RunLoopInput): Promise<RunLoopResult> {
  const btl = getBtlClient();
  const cfg = ROUTE_CONFIG[input.label];
  const start = Date.now();
  const deadline = start + (input.wallClockMs ?? 45_000);

  const messages: ChatMessage[] = [...input.initialMessages];
  const seenIncidentIds = new Set<string>();
  const seenRunbookIds = new Set<string>();
  let toolCallsMade = 0;
  let finalText = '';
  let timedOut = false;
  let tokensIn = 0;
  let tokensOut = 0;
  let consecutiveBadArgs = 0;

  while (toolCallsMade < cfg.toolCallCap && Date.now() < deadline) {
    let resp: OpenAI.Chat.Completions.ChatCompletion;
    try {
      resp = await btl.chat.completions.create({
        model: cfg.model,
        temperature: cfg.temperature,
        tools: TOOL_DEFS,
        tool_choice: 'auto',
        messages,
        // DeepSeek v4-pro emits reasoning_content in thinking mode; if we
        // don't echo it back on the next turn the API 400s. Simpler to
        // disable thinking for the tool-use loop entirely.
        ...({ enable_thinking: false } as Record<string, unknown>)
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
    } catch (e) {
      console.error('btl chat call failed:', e);
      finalText = `Sorry, the model call failed: ${e instanceof Error ? e.message : 'unknown'}. Try again.`;
      break;
    }

    tokensIn += resp.usage?.prompt_tokens ?? 0;
    tokensOut += resp.usage?.completion_tokens ?? 0;

    const msg = resp.choices[0]?.message;
    if (!msg) {
      finalText = 'Model returned no message.';
      break;
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: msg.content ?? '',
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments }
        }))
      };
      messages.push(assistantMsg);

      for (const tc of msg.tool_calls) {
        toolCallsMade += 1;
        const argsRaw = tc.function.arguments ?? '{}';

        input.sse.write({
          type: 'tool_call',
          id: tc.id,
          name: tc.function.name,
          args: argsRaw
        });

        await input.writeToolCallRow({
          toolCallId: tc.id,
          name: tc.function.name,
          args: argsRaw
        });

        const result = await dispatchTool(tc.function.name, argsRaw, {
          workspaceId: input.workspaceId
        });

        // Track a run of invalid-args returns. If the model produces two in
        // a row it's spiraling — stop before we blow the tool cap.
        if (
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof (result as { error?: unknown }).error === 'string' &&
          ((result as { error: string }).error).startsWith('invalid arguments')
        ) {
          consecutiveBadArgs += 1;
        } else {
          consecutiveBadArgs = 0;
        }

        // Track ids for citation validation
        harvestIds(result, seenIncidentIds, seenRunbookIds);

        const summary = summarizeResult(tc.function.name, result);
        input.sse.write({
          type: 'tool_result',
          id: tc.id,
          name: tc.function.name,
          summary: summary.text,
          count: summary.count
        });

        await input.writeToolResultRow({
          toolCallId: tc.id,
          name: tc.function.name,
          result
        });

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000)
        });
      }
      if (consecutiveBadArgs >= 2) {
        finalText =
          'I had trouble calling the search tools consistently. Try rephrasing your question with more specific keywords.';
        break;
      }
      continue;
    }

    // No tool calls: model produced final text
    finalText = msg.content ?? '';
    break;
  }

  if (!finalText) {
    timedOut = true;
    finalText = deterministicFallback(seenIncidentIds, seenRunbookIds);
  }

  // Citation validation + one retry
  input.sse.write({ type: 'status', kind: 'validating_citations' });
  let { valid, notes, citations } = validateCitations(
    finalText,
    seenIncidentIds,
    seenRunbookIds
  );

  if (!valid && Date.now() + 6000 < deadline) {
    input.sse.write({ type: 'status', kind: 'regenerating_for_citations' });
    try {
      const retryResp = await btl.chat.completions.create({
        model: cfg.model,
        temperature: Math.max(0.1, cfg.temperature - 0.1),
        messages: [
          ...messages,
          { role: 'system', content: CITATION_RETRY_PROMPT + notes }
        ],
        ...({ enable_thinking: false } as Record<string, unknown>)
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
      tokensIn += retryResp.usage?.prompt_tokens ?? 0;
      tokensOut += retryResp.usage?.completion_tokens ?? 0;
      const retryText = retryResp.choices[0]?.message?.content ?? '';
      if (retryText) {
        const revalidate = validateCitations(retryText, seenIncidentIds, seenRunbookIds);
        finalText = retryText;
        valid = revalidate.valid;
        notes = revalidate.notes;
        citations = revalidate.citations;
      }
    } catch (e) {
      console.error('citation retry failed:', e);
    }
  }

  // Emit citation frames for the client
  for (const c of citations) {
    input.sse.write({
      type: 'citation',
      kind: c.kind,
      id: c.id,
      valid
    });
  }

  return {
    finalText,
    citationsValid: valid,
    validatorNotes: notes,
    citations,
    model: cfg.model,
    latencyMs: Date.now() - start,
    toolCallsMade,
    timedOut,
    tokensIn,
    tokensOut
  };
}

function harvestIds(
  result: unknown,
  incidents: Set<string>,
  runbooks: Set<string>
): void {
  if (!result || typeof result !== 'object') return;
  const walk = (v: unknown): void => {
    if (!v) return;
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    const obj = v as Record<string, unknown>;
    if (typeof obj.full_id === 'string') {
      // eight-char short id also added
      const shortId = obj.full_id.slice(0, 8);
      // decide bag by presence of nearby fields
      if (obj.source || obj.title || obj.severity) {
        incidents.add(obj.full_id);
        incidents.add(shortId);
      } else if (obj.content !== undefined || obj.approved_by !== undefined) {
        runbooks.add(obj.full_id);
        runbooks.add(shortId);
      } else {
        incidents.add(obj.full_id);
        incidents.add(shortId);
      }
    }
    for (const val of Object.values(obj)) walk(val);
  };
  walk(result);
}

function summarizeResult(name: string, result: unknown): { text: string; count?: number } {
  if (!result || typeof result !== 'object') return { text: 'no data' };
  const obj = result as Record<string, unknown>;
  if ('error' in obj) return { text: `error: ${String(obj.error).slice(0, 120)}` };
  if (name === 'search_incidents' || name === 'list_recent_incidents') {
    const count = Number(obj.count ?? 0);
    return { text: `${count} incident${count === 1 ? '' : 's'}`, count };
  }
  if (name === 'get_incident') {
    return { text: `${obj.title ?? 'incident'} · ${obj.severity ?? '?'}` };
  }
  if (name === 'get_runbook') {
    return { text: String(obj.title ?? 'runbook') };
  }
  if (name === 'list_runbooks') {
    const count = Number(obj.count ?? 0);
    return { text: `${count} runbook${count === 1 ? '' : 's'}`, count };
  }
  return { text: 'ok' };
}

function deterministicFallback(
  incidentIds: Set<string>,
  runbookIds: Set<string>
): string {
  const parts: string[] = [
    'I ran out of time before I could put together a full answer, but here is what I found in memory:'
  ];
  const inc = Array.from(incidentIds).filter((s) => s.length === 8).slice(0, 3);
  if (inc.length > 0) {
    parts.push(`Related incidents: ${inc.map((i) => `[INC-${i}]`).join(' ')}.`);
  }
  const rb = Array.from(runbookIds).filter((s) => s.length === 8).slice(0, 2);
  if (rb.length > 0) {
    parts.push(`Related runbooks: ${rb.map((i) => `[RB-${i}]`).join(' ')}.`);
  }
  if (inc.length === 0 && rb.length === 0) {
    parts.push('Nothing matched the query yet. Try more specific keywords.');
  }
  return parts.join(' ');
}
