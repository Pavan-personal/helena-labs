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

async function post(path: string, body: unknown): Promise<unknown | null> {
  const key = getKey();
  if (!key) {
    console.error(`[retaindb] no api key set — path=${path}`);
    return null;
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
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[retaindb] ${path} → ${res.status} in ${elapsed}ms — ${errBody.slice(0, 200)}`);
      return null;
    }
    const json = await res.json();
    console.log(`[retaindb] ${path} → 200 in ${elapsed}ms, count=${(json as { count?: number }).count}`);
    return json;
  } catch (e) {
    const elapsed = Date.now() - start;
    console.error(`[retaindb] ${path} threw after ${elapsed}ms:`, e instanceof Error ? e.message : e);
    return null;
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
  const resp = (await post('/v1/memory', {
    project: workspaceId,
    content: trimmed,
    memory_type: memoryType
  })) as { memory_id?: string; success?: boolean } | null;
  return resp?.memory_id ?? null;
}

/**
 * Hybrid retrieval. Returns null if RetainDB is unreachable or the request
 * errors; caller should then fall back to whatever local search they had.
 */
export async function retainSearch(
  workspaceId: string,
  query: string,
  topK = 8
): Promise<RetainSearchResult | null> {
  const resp = (await post('/v1/memory/search', {
    project: workspaceId,
    query,
    top_k: topK,
    // Include memories whose semantic embedding is still being built async.
    // RetainDB otherwise hides them from search which makes freshly-ingested
    // incidents disappear for a few minutes.
    include_pending: true,
    scopes: ['PROJECT']
  })) as
    | {
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
      }
    | null;
  if (!resp) return null;
  const planner = (resp as unknown as {
    retrieval_plan?: unknown;
    latency_breakdown?: Record<string, number>;
  }).retrieval_plan;
  return {
    count: resp.count,
    hits: resp.results.map((r) => ({
      id: r.memory.id,
      content: r.memory.content,
      memoryType: r.memory.type,
      similarity: r.similarity,
      eventDate: r.memory.temporal?.event_date ?? null,
      scoreParts: {
        lexical: r.score_parts.lexical ?? 0,
        semantic: r.score_parts.semantic ?? 0,
        recency: r.score_parts.recency ?? 0,
        temporal: r.score_parts.temporal ?? 0,
        confidence: r.score_parts.confidence ?? 0
      }
    })),
    latencyMs: resp.latency_ms,
    retrievers: planner ? Object.keys(planner) : []
  };
}
