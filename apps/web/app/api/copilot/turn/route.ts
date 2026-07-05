import { NextResponse } from 'next/server';
import type OpenAI from 'openai';
import { getWorkspaceFromSession } from '@/lib/session';
import { logUsage } from '@helena/db';
import { classifyRoute } from '@/lib/copilot/router';
import { runToolLoop } from '@/lib/copilot/loop';
import { createSseStream, SSE_HEADERS } from '@/lib/copilot/sse';
import { MAIN_SYSTEM_PROMPT } from '@/lib/copilot/prompts';
import {
  createThread,
  getThread,
  insertMessage,
  renameThreadFromFirstMessage,
  touchThread,
  upsertTurn,
  finalizeTurn,
  listMessages
} from '@/lib/copilot/db';
import { ROUTE_CONFIG, MODELS } from '@/lib/copilot/btl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    threadId?: string;
    userText?: string;
    turnId?: string;
    pinnedRefIds?: string[];
    hs?: string;
  };

  const workspace = await getWorkspaceFromSession(body.hs);
  if (!workspace) {
    return NextResponse.json({ error: 'no session' }, { status: 401 });
  }
  const userText = (body.userText ?? '').trim();
  const turnId = (body.turnId ?? '').trim();
  if (!userText || !turnId) {
    return NextResponse.json({ error: 'missing userText or turnId' }, { status: 400 });
  }

  let threadId = body.threadId;
  let isFirstMessageInThread = false;
  if (!threadId) {
    const thread = await createThread({
      workspaceId: workspace.id,
      createdBy: workspace.installer_email ?? 'unknown',
      title: 'New chat'
    });
    threadId = thread.id;
    isFirstMessageInThread = true;
  } else {
    const t = await getThread(workspace.id, threadId);
    if (!t) return NextResponse.json({ error: 'thread not found' }, { status: 404 });
    // First-user-message check: no prior user rows.
    const priorMsgs = await listMessages(threadId, 0);
    isFirstMessageInThread = priorMsgs.every((m) => m.role !== 'user');
  }

  const upsert = await upsertTurn({
    turnId,
    threadId,
    workspaceId: workspace.id,
    status: 'running'
  });

  if (!upsert.created) {
    return NextResponse.json(
      { error: 'duplicate turnId — poll thread messages instead' },
      { status: 409 }
    );
  }

  // Rename thread on first message
  if (isFirstMessageInThread) {
    await renameThreadFromFirstMessage(threadId, userText);
  }

  // Load prior conversation for context (excluding status/tool_* rows)
  const priorAll = await listMessages(threadId, 0);
  const priorConvo: ChatMessage[] = [];
  for (const m of priorAll) {
    if (m.role === 'user' && m.content) {
      priorConvo.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant' && m.content) {
      priorConvo.push({ role: 'assistant', content: m.content });
    }
  }

  // Persist user message
  await insertMessage({
    threadId,
    workspaceId: workspace.id,
    turnId,
    role: 'user',
    content: userText,
    pinnedRefIds: body.pinnedRefIds ?? []
  });

  const sse = createSseStream();
  const abortSignal = req.signal;

  // Start the actual work in a background task so we can return the stream immediately.
  (async () => {
    const keepaliveHandle = setInterval(() => sse.keepalive(), 5000);
    try {
      // Route classification
      sse.write({ type: 'status', kind: 'classifying' });
      sse.write({ type: 'model_switch', model: MODELS.FAST, reason: 'classifier' });
      const routing = await classifyRoute(userText);
      const cfg = ROUTE_CONFIG[routing.label];

      sse.write({ type: 'model_switch', model: cfg.model, reason: `main loop (${routing.label})` });
      sse.write({ type: 'status', kind: 'reasoning' });

      // Save the classifier usage
      try {
        await logUsage({
          workspaceId: workspace.id,
          role: 'rerank',
          model: MODELS.FAST,
          tokensIn: routing.tokensIn,
          tokensOut: routing.tokensOut,
          costCents: 0
        });
      } catch (e) {
        console.error('log classifier usage failed:', e);
      }

      const initialMessages: ChatMessage[] = [
        { role: 'system', content: MAIN_SYSTEM_PROMPT },
        ...priorConvo,
        { role: 'user', content: userText }
      ];

      const result = await runToolLoop({
        label: routing.label,
        workspaceId: workspace.id,
        initialMessages,
        sse,
        writeToolCallRow: async ({ toolCallId, name, args }) => {
          await insertMessage({
            threadId,
            workspaceId: workspace.id,
            turnId,
            role: 'tool_call',
            toolName: name,
            toolCallId,
            content: args
          });
        },
        writeToolResultRow: async ({ toolCallId, name, result }) => {
          await insertMessage({
            threadId,
            workspaceId: workspace.id,
            turnId,
            role: 'tool_result',
            toolName: name,
            toolCallId,
            content: JSON.stringify(result).slice(0, 10000)
          });
        }
      });

      await insertMessage({
        threadId,
        workspaceId: workspace.id,
        turnId,
        role: 'assistant',
        content: result.finalText,
        model: result.model,
        citations: result.citations,
        citationsValid: result.citationsValid,
        validatorNotes: result.validatorNotes,
        inputTokens: result.tokensIn,
        outputTokens: result.tokensOut,
        latencyMs: result.latencyMs
      });

      try {
        await logUsage({
          workspaceId: workspace.id,
          role: 'synth',
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costCents: 0
        });
      } catch (e) {
        console.error('log main usage failed:', e);
      }

      sse.write({
        type: 'message',
        role: 'assistant',
        markdown: result.finalText,
        citations: result.citations,
        model: result.model,
        citations_valid: result.citationsValid,
        latency_ms: result.latencyMs
      });
      sse.write({ type: 'done', turnId });
      await finalizeTurn({
        turnId,
        status: result.timedOut ? 'timed_out' : 'done',
        routeLabel: routing.label
      });
      await touchThread(threadId);
    } catch (err) {
      console.error('[copilot turn] error:', err);
      sse.write({
        type: 'error',
        code: 'internal',
        message: err instanceof Error ? err.message : 'unknown',
        recoverable: false
      });
      await finalizeTurn({ turnId, status: 'error' });
    } finally {
      clearInterval(keepaliveHandle);
      sse.close();
    }
  })();

  return new Response(sse.stream, { headers: SSE_HEADERS });
}
