import { getServerClient } from '@helena/db';

export interface CopilotThread {
  id: string;
  workspace_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CopilotMessage {
  id: number;
  thread_id: string;
  workspace_id: string;
  turn_id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'status' | 'model_switch' | 'citation';
  content: string | null;
  model: string | null;
  tool_name: string | null;
  tool_call_id: string | null;
  citations: unknown;
  pinned_ref_ids: unknown;
  citations_valid: boolean | null;
  validator_notes: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  created_at: string;
}

export async function createThread(input: {
  workspaceId: string;
  createdBy: string;
  title?: string;
}): Promise<CopilotThread> {
  const db = getServerClient();
  const { data, error } = await db
    .from('copilot_threads')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      title: input.title ?? 'New chat'
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`create thread failed: ${error?.message}`);
  return data as CopilotThread;
}

export async function listThreads(workspaceId: string, limit = 25): Promise<CopilotThread[]> {
  const db = getServerClient();
  const { data } = await db
    .from('copilot_threads')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data as CopilotThread[]) ?? [];
}

export async function getThread(workspaceId: string, id: string): Promise<CopilotThread | null> {
  const db = getServerClient();
  const { data } = await db
    .from('copilot_threads')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle();
  return (data as CopilotThread) ?? null;
}

export async function archiveThread(workspaceId: string, id: string): Promise<void> {
  const db = getServerClient();
  await db
    .from('copilot_threads')
    .update({ archived_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', id);
}

export async function renameThreadFromFirstMessage(
  threadId: string,
  userText: string
): Promise<void> {
  const db = getServerClient();
  const title = userText.split(/\s+/).slice(0, 8).join(' ').slice(0, 80);
  await db.from('copilot_threads').update({ title, updated_at: new Date().toISOString() }).eq('id', threadId);
}

export async function touchThread(threadId: string): Promise<void> {
  const db = getServerClient();
  await db.from('copilot_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
}

export async function listMessages(threadId: string, sinceId = 0): Promise<CopilotMessage[]> {
  const db = getServerClient();
  const { data } = await db
    .from('copilot_messages')
    .select('*')
    .eq('thread_id', threadId)
    .gt('id', sinceId)
    .order('id', { ascending: true });
  return (data as CopilotMessage[]) ?? [];
}

export async function insertMessage(input: {
  threadId: string;
  workspaceId: string;
  turnId: string;
  role: CopilotMessage['role'];
  content?: string | null;
  model?: string | null;
  toolName?: string | null;
  toolCallId?: string | null;
  citations?: unknown;
  pinnedRefIds?: unknown;
  citationsValid?: boolean | null;
  validatorNotes?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
}): Promise<CopilotMessage> {
  const db = getServerClient();
  const { data, error } = await db
    .from('copilot_messages')
    .insert({
      thread_id: input.threadId,
      workspace_id: input.workspaceId,
      turn_id: input.turnId,
      role: input.role,
      content: input.content ?? null,
      model: input.model ?? null,
      tool_name: input.toolName ?? null,
      tool_call_id: input.toolCallId ?? null,
      citations: input.citations ?? [],
      pinned_ref_ids: input.pinnedRefIds ?? [],
      citations_valid: input.citationsValid ?? null,
      validator_notes: input.validatorNotes ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      latency_ms: input.latencyMs ?? null
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`insert message failed: ${error?.message}`);
  return data as CopilotMessage;
}

export async function upsertTurn(input: {
  turnId: string;
  threadId: string;
  workspaceId: string;
  routeLabel?: string;
  status: 'running' | 'done' | 'error' | 'timed_out';
}): Promise<{ created: boolean }> {
  const db = getServerClient();
  const { data: existing } = await db
    .from('copilot_turns')
    .select('turn_id, status')
    .eq('turn_id', input.turnId)
    .maybeSingle();
  if (existing) return { created: false };
  const { error } = await db.from('copilot_turns').insert({
    turn_id: input.turnId,
    thread_id: input.threadId,
    workspace_id: input.workspaceId,
    status: input.status,
    route_label: input.routeLabel ?? null
  });
  if (error) throw new Error(`upsert turn failed: ${error.message}`);
  return { created: true };
}

export async function finalizeTurn(input: {
  turnId: string;
  status: 'done' | 'error' | 'timed_out';
  routeLabel?: string;
}): Promise<void> {
  const db = getServerClient();
  await db
    .from('copilot_turns')
    .update({
      status: input.status,
      route_label: input.routeLabel ?? null,
      finished_at: new Date().toISOString()
    })
    .eq('turn_id', input.turnId);
}
