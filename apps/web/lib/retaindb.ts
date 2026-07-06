/**
 * Thin RetainDB client. We hit the REST API directly instead of using the
 * @retaindb/sdk package so we can keep tight control of the fallback path
 * and skip an extra dependency.
 *
 * All functions swallow errors and return null so callers can transparently
 * fall back to Postgres full-text search if RetainDB is slow or down.
 *
 * Project scope = helena workspace id, which gives us free multi-tenant
 * isolation (RetainDB projects don't collide across workspaces).
 *
 * Endpoints confirmed by live probe:
 *   POST /v1/memory         → write a memory
 *   POST /v1/memory/search  → hybrid retrieval (lexical + semantic + graph)
 *   POST /v1/context        → packed grounded answer
 */

const BASE = 'https://api.retaindb.com';
const TIMEOUT_MS = 8000;

function getKey(): string | null {
  return process.env.RETAINDB_API_KEY ?? null;
}

// Explicit failure reason so we can debug from the SSE stream, not just logs.
export type RetainFailure = 'no_key' | 'http_error' | 'network_error' | 'timeout';
export interface RetainPostResult {
  ok: boolean;
  data: unknown;
  failure: RetainFailure | null;
  detail: string | null;
  statusCode: number | null;
  elapsedMs: number;
}

async function post(path: string, body: unknown): Promise<RetainPostResult> {
  const key = getKey();
  if (!key) {
    return { ok: false, data: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', statusCode: null, elapsedMs: 0 };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const elapsedMs = Date.now() - start;
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[retaindb] ${path} → ${res.status} in ${elapsedMs}ms — ${errBody.slice(0, 200)}`);
      return { ok: false, data: null, failure: 'http_error', detail: errBody.slice(0, 120), statusCode: res.status, elapsedMs };
    }
    const json = await res.json();
    console.log(`[retaindb] ${path} → 200 in ${elapsedMs}ms, count=${(json as { count?: number }).count}`);
    return { ok: true, data: json, failure: null, detail: null, statusCode: 200, elapsedMs };
  } catch (e) {
    const elapsedMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    const failure: RetainFailure = msg.toLowerCase().includes('abort') ? 'timeout' : 'network_error';
    console.error(`[retaindb] ${path} ${failure} after ${elapsedMs}ms:`, msg);
    return { ok: false, data: null, failure, detail: msg.slice(0, 120), statusCode: null, elapsedMs };
  } finally {
    clearTimeout(t);
  }
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

/**
 * Store a memory. Fire-and-forget; do NOT await this in a hot path if you
 * cannot tolerate the extra ~200ms round trip. Returns memory_id on success,
 * null on any failure.
 */
export async function retainRemember(
  workspaceId: string,
  content: string,
  memoryType: RetainMemoryType = 'fact'
): Promise<string | null> {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const r = await post('/v1/memory', {
    project: workspaceId,
    content: trimmed,
    memory_type: memoryType
  });
  if (!r.ok) return null;
  return (r.data as { memory_id?: string })?.memory_id ?? null;
}

/**
 * Hybrid retrieval. Returns null if RetainDB is unreachable or the request
 * errors; caller should then fall back to whatever local search they had.
 */
export interface RetainSearchOutcome {
  result: RetainSearchResult | null;
  failure: RetainFailure | null;
  detail: string | null;
  elapsedMs: number;
}

export async function retainSearch(
  workspaceId: string,
  query: string,
  topK = 8
): Promise<RetainSearchOutcome> {
  const r = await post('/v1/memory/search', {
    project: workspaceId,
    query,
    top_k: topK,
    include_pending: true,
    scopes: ['PROJECT']
  });
  if (!r.ok) {
    return { result: null, failure: r.failure, detail: r.detail, elapsedMs: r.elapsedMs };
  }
  const resp = r.data as {
    count: number;
    results: Array<{
      memory: {
        id: string;
        content: string;
        type: string;
        temporal: { event_date: string | null };
      };
      similarity: number;
      score_parts: {
        lexical: number;
        semantic: number;
        recency: number;
        temporal: number;
        confidence: number;
      };
    }>;
    latency_ms: number;
    retrieval_plan?: unknown;
  };
  return {
    result: {
      count: resp.count,
      hits: resp.results.map((row) => ({
        id: row.memory.id,
        content: row.memory.content,
        memoryType: row.memory.type,
        similarity: row.similarity,
        eventDate: row.memory.temporal?.event_date ?? null,
        scoreParts: {
          lexical: row.score_parts.lexical ?? 0,
          semantic: row.score_parts.semantic ?? 0,
          recency: row.score_parts.recency ?? 0,
          temporal: row.score_parts.temporal ?? 0,
          confidence: row.score_parts.confidence ?? 0
        }
      })),
      latencyMs: resp.latency_ms,
      retrievers: resp.retrieval_plan ? Object.keys(resp.retrieval_plan) : []
    },
    failure: null,
    detail: null,
    elapsedMs: r.elapsedMs
  };
}
