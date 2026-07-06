import { RetainDB } from '@retaindb/sdk';

/**
 * RetainDB client — following the sanctioned pattern from the Next.js
 * integration guide:
 *
 *   const db = new RetainDB({ apiKey, project });
 *   const { context, results } = await db.getContext(query, { userId });
 *   await db.remember(content, { userId });
 *
 * Treats each helena workspace as both `project` and `userId`. Docs use
 * `userId` for end-user scoping; we don't have end-users per workspace,
 * so we reuse the workspaceId which keeps the same isolation guarantee.
 *
 * All errors return null so the caller can fall back to Postgres FTS.
 */

let cached: RetainDB | null = null;

function getDb(): RetainDB | null {
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

interface RawContextResult {
  content: string;
  score?: number;
  type?: string;
  metadata?: Record<string, unknown>;
}

export async function retainRemember(
  workspaceId: string,
  content: string,
  _memoryType: RetainMemoryType = 'fact'
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const res = (await (db as unknown as {
      remember: (
        c: string,
        opts: { project?: string; userId?: string }
      ) => Promise<{ memoryId?: string; success?: boolean }>;
    }).remember(trimmed, { project: workspaceId, userId: workspaceId }));
    return res?.memoryId ?? null;
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
  const db = getDb();
  if (!db) {
    return { result: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    // TS types on RetainDB don't expose getContext but runtime does.
    const raw = (await (db as unknown as {
      getContext: (
        q: string,
        opts: { project?: string; userId?: string; limit?: number }
      ) => Promise<{ results?: RawContextResult[]; count?: number }>;
    }).getContext(query, { project: workspaceId, userId: workspaceId, limit: topK }));
    const elapsedMs = Date.now() - start;
    const rows = raw.results ?? [];
    return {
      result: {
        count: raw.count ?? rows.length,
        hits: rows.map((row, i) => ({
          id: `mem_${i}`,
          content: row.content ?? '',
          memoryType: row.type ?? 'fact',
          similarity: row.score ?? 0,
          eventDate: null,
          scoreParts: {
            lexical: 0,
            semantic: row.score ?? 0,
            recency: 0,
            temporal: 0,
            confidence: 0
          }
        })),
        latencyMs: elapsedMs,
        retrievers: []
      },
      failure: null,
      detail: null,
      elapsedMs
    };
  } catch (e) {
    const elapsedMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[retaindb] getContext failed after ${elapsedMs}ms:`, msg);
    return { result: null, failure: 'sdk_error', detail: msg.slice(0, 200), elapsedMs };
  }
}
