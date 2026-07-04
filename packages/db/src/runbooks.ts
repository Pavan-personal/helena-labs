import { getServerClient } from './client';
import type { RunbookDraft, RunbookStatus } from '@helena/shared';

export interface RunbookDraftRow {
  id: string;
  workspace_id: string;
  title: string;
  content_md: string;
  source_incident_ids: string[];
  status: RunbookStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface RunbookRow {
  id: string;
  workspace_id: string;
  title: string;
  content_md: string;
  source_incident_ids: string[];
  approved_by: string;
  approved_at: string;
}

export async function insertRunbookDraft(
  workspaceId: string,
  draft: RunbookDraft
): Promise<RunbookDraftRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from('runbook_drafts')
    .insert({
      workspace_id: workspaceId,
      title: draft.title,
      content_md: draft.contentMd,
      source_incident_ids: draft.sourceIncidentIds
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert runbook draft failed: ${error?.message}`);
  return data as RunbookDraftRow;
}

export async function listDrafts(
  workspaceId: string,
  status: RunbookStatus = 'draft'
): Promise<RunbookDraftRow[]> {
  const db = getServerClient();
  const { data } = await db
    .from('runbook_drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', status)
    .order('created_at', { ascending: false });
  return (data as RunbookDraftRow[]) ?? [];
}

export async function approveDraft(draftId: string, approver: string): Promise<RunbookRow> {
  const db = getServerClient();
  const { data: draft, error: e1 } = await db
    .from('runbook_drafts')
    .select('*')
    .eq('id', draftId)
    .single();
  if (e1 || !draft) throw new Error(`Draft not found: ${draftId}`);
  const d = draft as RunbookDraftRow;

  const { data, error } = await db
    .from('runbooks')
    .insert({
      workspace_id: d.workspace_id,
      title: d.title,
      content_md: d.content_md,
      source_incident_ids: d.source_incident_ids,
      approved_by: approver
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Approve runbook failed: ${error?.message}`);

  await db
    .from('runbook_drafts')
    .update({ status: 'approved', reviewed_by: approver, reviewed_at: new Date().toISOString() })
    .eq('id', draftId);

  return data as RunbookRow;
}

export async function rejectDraft(draftId: string, reviewer: string): Promise<void> {
  const db = getServerClient();
  await db
    .from('runbook_drafts')
    .update({ status: 'rejected', reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
    .eq('id', draftId);
}

export async function listRunbooks(workspaceId: string): Promise<RunbookRow[]> {
  const db = getServerClient();
  const { data } = await db
    .from('runbooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('approved_at', { ascending: false });
  return (data as RunbookRow[]) ?? [];
}
