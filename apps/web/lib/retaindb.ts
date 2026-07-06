import { RetainDBClient } from '@retaindb/sdk';

/**
 * RetainDB high-level client with identity wired.
 *
 * Prior attempts (raw fetch, then RuntimeClient) got past the Cloudflare
 * WAF but the API itself returned 403 Forbidden from Vercel egress. Trying
 * the RetainDBClient's public memory API with identityMode='app-identity'
 * and a getIdentity() resolver — some routes on the RetainDB backend
 * appear to require user_id/session_id present in the request body when
 * the client environment is 'production'.
 *
 * We scope the identity by workspaceId so the "user" is really the tenant.
 * Fallback path (Postgres FTS) still kicks in on any error.
 */

let cached: RetainDBClient | null = null;

function getClient(workspaceId: string): RetainDBClient | null {
  const apiKey = process.env.RETAINDB_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  cached = new RetainDBClient({
    apiKey,
    environment: 'production',
    identityMode: 'app-identity',
    getIdentity: async () => ({
      userId: workspaceId,
      sessionId: 'helena-copilot'
    })
  } as ConstructorParameters<typeof RetainDBClient>[0]);
  return cached;
}

export type RetainMemoryType = 'fact' | 'decision' | 'preference' | 'event';

export interface RetainSearchHit {
  id: string;
  content: string;
  memoryType: string;
  similarity: number;
  eventDate: string | null;
  scoreParts: {
    lexical: number;
    semantic: number;
    recency: number;
    temporal: number;
    confidence: number;
  };
}

export interface RetainSearchResult {
  count: number;
  hits: RetainSearchHit[];
  latencyMs: number;
  retrievers: string[];
}

export type RetainFailure = 'no_key' | 'sdk_error';

export interface RetainSearchOutcome {
  result: RetainSearchResult | null;
  failure: RetainFailure | null;
  detail: string | null;
  elapsedMs: number;
}

export async function retainRemember(
  workspaceId: string,
  content: string,
  memoryType: RetainMemoryType = 'fact'
): Promise<string | null> {
  const client = getClient(workspaceId);
  if (!client) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const res = (await client.memory.add({
      project: workspaceId,
      user_id: workspaceId,
      content: trimmed,
      memory_type: memoryType
    } as unknown as Parameters<typeof client.memory.add>[0])) as {
      memory_id?: string;
    };
    return res?.memory_id ?? null;
  } catch (e) {
    console.error('[retaindb] remember failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function retainSearch(
  workspaceId: string,
  query: string,
  topK = 8
): Promise<RetainSearchOutcome> {
  const client = getClient(workspaceId);
  if (!client) {
    return { result: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    const raw = (await client.memory.search({
      project: workspaceId,
      user_id: workspaceId,
      query,
      top_k: topK,
      include_pending: true,
      profile: 'fast'
    } as unknown as Parameters<typeof client.memory.search>[0])) as {
      count?: number;
      results?: Array<{
        memory: {
          id: string;
          content: string;
          type?: string;
          temporal?: { event_date?: string | null };
        };
        similarity?: number;
        score_parts?: Partial<RetainSearchHit['scoreParts']>;
      }>;
      latency_ms?: number;
      retrieval_plan?: Record<string, unknown>;
    };
    const elapsedMs = Date.now() - start;
    const rows = raw.results ?? [];
    return {
      result: {
        count: raw.count ?? 0,
        hits: rows.map((row) => ({
          id: row.memory?.id ?? '',
          content: row.memory?.content ?? '',
          memoryType: row.memory?.type ?? '',
          similarity: row.similarity ?? 0,
          eventDate: row.memory?.temporal?.event_date ?? null,
          scoreParts: {
            lexical: row.score_parts?.lexical ?? 0,
            semantic: row.score_parts?.semantic ?? 0,
            recency: row.score_parts?.recency ?? 0,
            temporal: row.score_parts?.temporal ?? 0,
            confidence: row.score_parts?.confidence ?? 0
          }
        })),
        latencyMs: raw.latency_ms ?? elapsedMs,
        retrievers: raw.retrieval_plan ? Object.keys(raw.retrieval_plan) : []
      },
      failure: null,
      detail: null,
      elapsedMs
    };
  } catch (e) {
    const elapsedMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[retaindb] search failed after ${elapsedMs}ms:`, msg);
    return { result: null, failure: 'sdk_error', detail: msg.slice(0, 200), elapsedMs };
  }
}
