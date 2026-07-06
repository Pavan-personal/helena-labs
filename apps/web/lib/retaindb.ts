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

function getDb(workspaceId: string): RetainDB | null {
  const apiKey = process.env.RETAINDB_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  // Project is baked into the client per the sanctioned pattern. We use
  // the workspaceId so multi-tenant isolation is preserved.
  cached = new RetainDB({ apiKey, project: workspaceId } as ConstructorParameters<typeof RetainDB>[0]);
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
  const db = getDb(workspaceId);
  if (!db) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const user = (db as unknown as {
      user: (uid: string) => { remember: (c: string) => Promise<unknown> };
    }).user(workspaceId);
    await user.remember(trimmed);
    return 'ok';
  } catch (e) {
    console.error('[retaindb] remember failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function retainSearch(
  workspaceId: string,
  query: string,
  _topK = 8
): Promise<RetainSearchOutcome> {
  const db = getDb(workspaceId);
  if (!db) {
    return { result: null, failure: 'no_key', detail: 'RETAINDB_API_KEY not set', elapsedMs: 0 };
  }
  const start = Date.now();
  try {
    const user = (db as unknown as {
      user: (uid: string) => {
        getContext: (q: string) => Promise<{
          context?: string;
          raw?: {
            count?: number;
            results?: Array<{
              memory?: {
                id?: string;
                content?: string;
                type?: string;
                temporal?: { event_date?: string | null };
              };
              similarity?: number;
              score_parts?: Partial<RetainSearchHit['scoreParts']>;
            }>;
          };
        }>;
      };
    }).user(workspaceId);
    const { raw } = await user.getContext(query);
    const elapsedMs = Date.now() - start;
    const rows = raw?.results ?? [];
    return {
      result: {
        count: raw?.count ?? rows.length,
        hits: rows.map((row) => ({
          id: row.memory?.id ?? '',
          content: row.memory?.content ?? '',
          memoryType: row.memory?.type ?? 'fact',
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
