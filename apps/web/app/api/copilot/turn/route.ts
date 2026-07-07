import { NextResponse } from 'next/server';
import type OpenAI from 'openai';
import { getWorkspaceFromSession } from '@/lib/session';
import { logUsage } from '@helena/db';
import { classifyRoute } from '@/lib/copilot/router';
import { runToolLoop } from '@/lib/copilot/loop';
import { createSseStream, SSE_HEADERS } from '@/lib/copilot/sse';
import { MAIN_SYSTEM_PROMPT } from '@/lib/copilot/prompts';
import { runVisionConsensus, fetchAttachmentsAsDataUrls } from '@/lib/copilot/vision';
import {
  createThread,
  getThread,
  insertMessage,
  renameThreadFromFirstMessage,
  touchThread,
  upsertTurn,
  finalizeTurn,
  listMessages,
  countInflightTurns,
  linkAttachmentsToMessage
} from '@/lib/copilot/db';

const MAX_INFLIGHT_TURNS_PER_WORKSPACE = 5;
import { ROUTE_CONFIG, MODELS, estimateCostCents } from '@/lib/copilot/btl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: Request) {
  let body: {
    threadId?: string;
    userText?: string;
    turnId?: string;
    pinnedRefIds?: string[];
    attachmentIds?: string[];
    hs?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json body' }, { status: 400 });
  }

  const workspace = await getWorkspaceFromSession(body.hs);
  if (!workspace) {
    return NextResponse.json({ error: 'no session' }, { status: 401 });
  }
  const userText = (body.userText ?? '').trim();
  const turnId = (body.turnId ?? '').trim();
  const attachmentIds = body.attachmentIds ?? [];
  if (!turnId) {
    return NextResponse.json({ error: 'missing turnId' }, { status: 400 });
  }
  // Allow empty text only when the user attached one or more screenshots —
  // vision consensus alone is enough to trigger a turn.
  if (!userText && attachmentIds.length === 0) {
    return NextResponse.json({ error: 'need text or an attachment' }, { status: 400 });
  }

  // Cost DoS guard: reject if this workspace already has too many turns in flight.
  const inflight = await countInflightTurns(workspace.id);
  if (inflight >= MAX_INFLIGHT_TURNS_PER_WORKSPACE) {
    return NextResponse.json(
      {
        error: 'too many concurrent turns for this workspace, retry once one finishes',
        code: 'rate_limited',
        inflight
      },
      { status: 429, headers: { 'Retry-After': '10' } }
    );
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

  // If ANY of the pre-stream setup throws we must still finalize the turn
  // so it doesn't sit in 'running' forever. Wrap every step here in a
  // try/catch that flips the row to 'error' before returning to the client.
  let effectiveUserText: string;
  let priorConvo: ChatMessage[];
  let userMsg: Awaited<ReturnType<typeof insertMessage>>;
  try {
    if (isFirstMessageInThread) {
      await renameThreadFromFirstMessage(threadId, userText || 'Screenshot analysis');
    }

    const priorAll = await listMessages(threadId, 0);
    // Cap the conversation context so long threads don't blow the model's
    // prompt budget and push tool-loop latency past the 45s wall clock.
    // Keep the last MAX_HISTORY_PAIRS user+assistant turns plus per-message
    // content truncation. Prior state deeper than that is out of context
    // for a follow-up question anyway.
    const MAX_HISTORY_PAIRS = 6;
    const MAX_CONTENT_CHARS = 1500;
    const filteredHistory: ChatMessage[] = [];
    for (const m of priorAll) {
      const raw = m.content?.slice(0, MAX_CONTENT_CHARS) ?? null;
      if (m.role === 'user' && raw) {
        filteredHistory.push({ role: 'user', content: raw });
      } else if (m.role === 'assistant' && raw) {
        filteredHistory.push({ role: 'assistant', content: raw });
      }
    }
    priorConvo = filteredHistory.slice(-MAX_HISTORY_PAIRS * 2);

    effectiveUserText =
      userText ||
      (attachmentIds.length > 0
        ? 'Look at this screenshot. Identify what it shows and correlate it with any past incidents that match.'
        : '');

    userMsg = await insertMessage({
      threadId,
      workspaceId: workspace.id,
      turnId,
      role: 'user',
      content: effectiveUserText,
      pinnedRefIds: body.pinnedRefIds ?? []
    });
  } catch (setupErr) {
    console.error('[copilot turn] pre-stream setup failed:', setupErr);
    await finalizeTurn({ turnId, status: 'error' }).catch(() => {});
    return NextResponse.json(
      {
        error: 'setup failed, try again',
        detail: setupErr instanceof Error ? setupErr.message.slice(0, 160) : 'unknown'
      },
      { status: 500 }
    );
  }
  if (attachmentIds.length > 0) {
    await linkAttachmentsToMessage(userMsg.id, attachmentIds);
  }

  const sse = createSseStream();
  const abortSignal = req.signal;

  // Start the actual work in a background task so we can return the stream immediately.
  (async () => {
    const keepaliveHandle = setInterval(() => sse.keepalive(), 5000);
    try {
      // Vision preprocessing runs before the classifier so we can force a VISION route label.
      let visionResult: import('@/lib/copilot/vision').VisionConsensus | null = null;
      if (attachmentIds.length > 0) {
        sse.write({ type: 'status', kind: 'vision_start' });
        sse.write({
          type: 'model_switch',
          model: MODELS.VISION_GPT,
          reason: 'vision consensus A'
        });
        sse.write({
          type: 'model_switch',
          model: MODELS.VISION_GEMINI,
          reason: 'vision consensus B'
        });
        const dataUrls = await fetchAttachmentsAsDataUrls(workspace.id, attachmentIds);
        if (dataUrls.length === 0) {
          // Attachment ids were sent but none downloaded from Storage —
          // surface it instead of silently answering as if no image existed.
          sse.write({
            type: 'error',
            code: 'attachment_missing',
            message: 'The screenshot could not be loaded. Try uploading it again.',
            recoverable: true
          });
          await finalizeTurn({ turnId, status: 'error' });
          clearInterval(keepaliveHandle);
          sse.close();
          return;
        }
        {
          const visionId = crypto.randomUUID();
          sse.write({
            type: 'tool_call',
            id: visionId,
            name: 'identify_screenshot',
            args: JSON.stringify({ attachment_ids: attachmentIds })
          });
          try {
            visionResult = await runVisionConsensus(dataUrls);
            sse.write({
              type: 'tool_result',
              id: visionId,
              name: 'identify_screenshot',
              summary: `${visionResult.source}: ${visionResult.summary} (${visionResult.model_agreement} agreement)`,
              count: visionResult.models_used.length
            });
            for (const u of visionResult.usage) {
              try {
                await logUsage({
                  workspaceId: workspace.id,
                  role: 'vision',
                  model: u.model,
                  tokensIn: u.tokensIn,
                  tokensOut: u.tokensOut,
                  costCents: estimateCostCents(u.model, u.tokensIn, u.tokensOut)
                });
              } catch (e) {
                console.error('log vision usage failed:', e);
              }
            }
            await insertMessage({
              threadId,
              workspaceId: workspace.id,
              turnId,
              role: 'tool_call',
              toolName: 'identify_screenshot',
              toolCallId: visionId,
              content: JSON.stringify({ attachment_ids: attachmentIds })
            });
            await insertMessage({
              threadId,
              workspaceId: workspace.id,
              turnId,
              role: 'tool_result',
              toolName: 'identify_screenshot',
              toolCallId: visionId,
              content: JSON.stringify(visionResult).slice(0, 10000)
            });
          } catch (e) {
            sse.write({
              type: 'tool_result',
              id: visionId,
              name: 'identify_screenshot',
              summary: 'vision consensus failed',
              error: e instanceof Error ? e.message : 'unknown'
            });
          }
        }
      }

      // Route classification
      sse.write({ type: 'status', kind: 'classifying' });
      sse.write({ type: 'model_switch', model: MODELS.FAST, reason: 'classifier' });
      const routing = attachmentIds.length > 0
        ? { label: 'VISION' as const, raw: 'AUTO_VISION', tokensIn: 0, tokensOut: 0, latencyMs: 0 }
        : await classifyRoute(effectiveUserText);
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
          costCents: estimateCostCents(MODELS.FAST, routing.tokensIn, routing.tokensOut)
        });
      } catch (e) {
        console.error('log classifier usage failed:', e);
      }

      const initialMessages: ChatMessage[] = [
        { role: 'system', content: MAIN_SYSTEM_PROMPT },
        ...priorConvo,
        { role: 'user', content: effectiveUserText }
      ];

      // If we ran vision consensus, inject its result as an assistant/tool pair
      // so the loop sees it as a pre-executed tool_result. Text inside is
      // untrusted (user-provided image content) — system prompt flags that.
      if (visionResult) {
        const visionId = 'vision_' + turnId.slice(0, 8);
        initialMessages.push({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: visionId,
              type: 'function',
              function: {
                name: 'identify_screenshot',
                arguments: JSON.stringify({ attachment_ids: attachmentIds })
              }
            }
          ]
        });
        initialMessages.push({
          role: 'tool',
          tool_call_id: visionId,
          content: JSON.stringify({
            source: visionResult.source,
            summary: visionResult.summary,
            extracted_text: visionResult.extracted_text,
            suggested_query: visionResult.suggested_query,
            severity_hint: visionResult.severity_hint,
            model_agreement: visionResult.model_agreement,
            models_used: visionResult.models_used
          })
        });
      }

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
          costCents: estimateCostCents(result.model, result.tokensIn, result.tokensOut)
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

  return new Response(sse.stream, {
    headers: {
      ...SSE_HEADERS,
      'X-Thread-Id': threadId,
      'Access-Control-Expose-Headers': 'X-Thread-Id'
    }
  });
}
