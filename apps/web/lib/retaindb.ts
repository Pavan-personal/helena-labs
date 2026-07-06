import { RetainDBClient } from '@retaindb/sdk';

/**
 * RetainDB client. We drive the SDK's low-level RuntimeClient directly for
 * two reasons:
 *   1. Its request layer sends the x-sdk-version / x-sdk-runtime headers
 *      the RetainDB Cloudflare WAF uses as an allowlist signal — plain
 *      fetch from Vercel egress gets a "Just a moment..." challenge.
 *   2. Bypasses the high-level withIdentity() flow which throws
 *      AUTH_IDENTITY_REQUIRED in production unless you wire an identity
 *      resolver. We already scope by workspaceId via the `project` field.
 *
 * Every function swallows errors and returns null so callers can fall
 * back to Postgres full-text search.
 */

let cached: RetainDBClient | null = null;

function getClient(): RetainDBClient | null {
  const apiKey = process.env.RETAINDB_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  cached = new RetainDBClient({ apiKey, environment: 'local' });
  return cached;
}

function getRuntime(): {
  request: (opts: {
    endpoint: string;
    method: string;
    operation?: string;
    body?: unknown;
    idempotent?: boolean;
  }) => Promise<{ data: unknown }>;
} | null {
  const client = getClient();
  if (!client) return null;
  return (client as unknown as { runtimeClient: {
    request: (opts: {
      endpoint: string;
      method: string;
      operation?: string;
      body?: unknown;
      idempotent?: boolean;
    }) => Promise<{ data: unknown }>;
  } }).runtimeClient;
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

export async function retainRemember(
  workspaceId: string,
  content: string,
  memoryType: RetainMemoryType = 'fact'
): Promise<string | null> {
  const rt = getRuntime();
  if (!rt) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const resp = await rt.request({
      endpoint: '/v1/memory',
      method: 'POST',
      operation: 'writeAck',
      body: { project: workspaceId, content: trimmed, memory_type: memoryType }
    });
    return (resp.data as { memory_id?: string })?.memory_id ?? null;
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
  const rt = getRuntime();
  if (!rt) {
    return { result: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    const resp = await rt.request({
      endpoint: '/v1/memory/search',
      method: 'POST',
      operation: 'search',
      idempotent: true,
      body: {
        project: workspaceId,
        query,
        top_k: topK,
        include_pending: true,
        scopes: ['PROJECT']
      }
    });
    const raw = resp.data as RawSearchResponse;
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
    return { result: null, failure: 'sdk_error', detail: msg.slice(0, 160), elapsedMs };
  }
}
