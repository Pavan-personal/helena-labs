import { getServerClient } from './client';
import type { IncidentRow, IncidentSeverity, IncidentSource, NormalizedIncident } from '@helena/shared';

export async function insertIncident(
  workspaceId: string,
  incident: NormalizedIncident
): Promise<IncidentRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from('incidents')
    .insert({
      workspace_id: workspaceId,
      source: incident.source,
      severity: incident.severity,
      external_id: incident.externalId ?? null,
      channel: incident.channel ?? null,
      title: incident.title,
      body: incident.body,
      extracted_json: incident.extractedJson ?? null,
      dedup_key: incident.dedupKey ?? null,
      screenshot_captions: incident.screenshotCaptions ?? null
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(`Insert incident failed: ${error?.message}`);
  const row = data as IncidentRow;

  // Mirror to RetainDB so the Copilot's hybrid retrieval sees new incidents
  // immediately. Fire-and-forget: never block ingest on the memory layer.
  rememberIncidentInRetain(workspaceId, row).catch((e) => {
    console.error('retaindb remember failed:', e);
  });

  return row;
}

async function rememberIncidentInRetain(workspaceId: string, row: IncidentRow): Promise<void> {
  const key = process.env.RETAINDB_API_KEY;
  if (!key) return;
  const content = `[INC:${row.id}] ${row.title}\nSeverity: ${row.severity}. Source: ${row.source}.${row.channel ? ` Channel: #${row.channel}.` : ''}\n${(row.body ?? '').slice(0, 2000)}`;
  // Use the official SDK so the RetainDB Cloudflare WAF sees the
  // x-sdk-version / x-sdk-runtime headers and lets the request through.
  // Raw fetch from Vercel egress gets a "Just a moment..." challenge.
  try {
    const { RetainDB } = await import('@retaindb/sdk');
    const client = new RetainDB({ apiKey: key });
    await (client as unknown as {
      request: (path: string, opts: { method: string; body: string }) => Promise<unknown>;
    }).request('/v1/memory', {
      method: 'POST',
      body: JSON.stringify({ project: workspaceId, content, memory_type: 'fact' })
    });
  } catch (e) {
    console.error('retaindb ingest remember failed:', e instanceof Error ? e.message : e);
  }
}

export async function findSimilarByDedup(
  workspaceId: string,
  dedupKey: string,
  limit = 5
): Promise<IncidentRow[]> {
  const db = getServerClient();
  const { data } = await db
    .from('incidents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('dedup_key', dedupKey)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as IncidentRow[]) ?? [];
}

/**
 * Full text search over the maintained tsvector column.
 * Falls back to ilike if websearch tsquery fails on unusual input.
 */
export async function searchIncidents(
  workspaceId: string,
  query: string,
  limit = 30
): Promise<IncidentRow[]> {
  const db = getServerClient();

  try {
    const { data, error } = await db
      .from('incidents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && data && data.length > 0) return data as IncidentRow[];
  } catch {
    // fall through
  }

  const { data: fallback } = await db
    .from('incidents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (fallback as IncidentRow[]) ?? [];
}

export async function getIncidentsByIds(ids: string[]): Promise<IncidentRow[]> {
  if (ids.length === 0) return [];
  const db = getServerClient();
  const { data } = await db.from('incidents').select('*').in('id', ids);
  return (data as IncidentRow[]) ?? [];
}

export async function listIncidents(
  workspaceId: string,
  opts: { source?: IncidentSource; severity?: IncidentSeverity; limit?: number } = {}
): Promise<IncidentRow[]> {
  const db = getServerClient();
  let q = db.from('incidents').select('*').eq('workspace_id', workspaceId);
  if (opts.source) q = q.eq('source', opts.source);
  if (opts.severity) q = q.eq('severity', opts.severity);
  const { data } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  return (data as IncidentRow[]) ?? [];
}

/**
 * Threads with activity that then went silent for at least 24 hours are treated as resolved.
 */
export async function listRecentlyResolvedThreads(
  workspaceId: string,
  hoursSilent = 24
): Promise<Array<{ external_id: string; incidents: IncidentRow[] }>> {
  const db = getServerClient();
  const cutoffIso = new Date(Date.now() - hoursSilent * 3600_000).toISOString();

  const { data } = await db
    .from('incidents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('source', 'slack')
    .not('external_id', 'is', null)
    .order('external_id', { ascending: true })
    .order('created_at', { ascending: true });

  const grouped = new Map<string, IncidentRow[]>();
  for (const row of (data as IncidentRow[]) ?? []) {
    if (!row.external_id) continue;
    const bucket = grouped.get(row.external_id) ?? [];
    bucket.push(row);
    grouped.set(row.external_id, bucket);
  }

  const results: Array<{ external_id: string; incidents: IncidentRow[] }> = [];
  for (const [threadId, incidents] of grouped) {
    const last = incidents[incidents.length - 1];
    if (last && last.created_at < cutoffIso) {
      results.push({ external_id: threadId, incidents });
    }
  }
  return results;
}
