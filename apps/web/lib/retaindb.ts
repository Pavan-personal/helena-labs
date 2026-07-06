import { RetainDB } from '@retaindb/sdk';

/**
 * RetainDB client wired through the official SDK. Uses the SDK's own request
 * layer which sends the x-sdk-version / x-sdk-runtime headers that
 * Cloudflare's WAF allowlists — raw fetch with just Authorization gets
 * challenged from Vercel egress, the SDK does not.
 *
 * Every function swallows errors and returns null so callers can fall
 * back to Postgres full-text search if RetainDB is unreachable.
 */

let cached: RetainDB | null = null;

function getClient(): RetainDB | null {
  const apiKey = process.env.RETAINDB_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  cached = new RetainDB({ apiKey });
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

interface RawMemory {
  id: string;
  content: string;
  type?: string;
  temporal?: { event_date?: string | null };
}

interface RawSearchHit {
  memory: RawMemory;
  similarity?: number;
  score_parts?: Partial<RetainSearchHit['scoreParts']>;
}

interface RawSearchResponse {
  count?: number;
  results?: RawSearchHit[];
  latency_ms?: number;
  retrieval_plan?: Record<string, unknown>;
}

/**
 * Store a memory. Fire-and-forget; do NOT await this in a hot path if you
 * cannot tolerate the extra round trip.
 */
export async function retainRemember(
  workspaceId: string,
  content: string,
  memoryType: RetainMemoryType = 'fact'
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    // Two SDK versions are floating around with slightly different signatures.
    // The REST payload is stable so we just call .request() directly, which
    // still routes through the SDK's authenticated fetch layer.
    const resp = (await (client as unknown as {
      request: (path: string, opts: { method: string; body: string }) => Promise<unknown>;
    }).request('/v1/memory', {
      method: 'POST',
      body: JSON.stringify({ project: workspaceId, content: trimmed, memory_type: memoryType })
    })) as { memory_id?: string };
    return resp?.memory_id ?? null;
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
  const client = getClient();
  if (!client) {
    return { result: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    const resp = (await (client as unknown as {
      request: (path: string, opts: { method: string; body: string }) => Promise<unknown>;
    }).request('/v1/memory/search', {
      method: 'POST',
      body: JSON.stringify({
        project: workspaceId,
        query,
        top_k: topK,
        include_pending: true,
        scopes: ['PROJECT']
      })
    })) as RawSearchResponse;
    const elapsedMs = Date.now() - start;
    const rows = resp.results ?? [];
    return {
      result: {
        count: resp.count ?? 0,
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
        latencyMs: resp.latency_ms ?? elapsedMs,
        retrievers: resp.retrieval_plan ? Object.keys(resp.retrieval_plan) : []
      },
      failure: null,
      detail: null,
      elapsedMs
    };
  } catch (e) {
    const elapsedMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[retaindb] search failed after ${elapsedMs}ms:`, msg);
    return { result: null, failure: 'sdk_error', detail: msg.slice(0, 160), elapsedMs };
  }
}
