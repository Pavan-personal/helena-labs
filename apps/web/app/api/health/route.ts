import { NextResponse } from 'next/server';
import { getServerClient } from '@helena/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check. Cheap DB round-trip. Returns 200 with runtime info.
 */
export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const db = getServerClient();
    const { error } = await db.from('workspaces').select('id', { count: 'exact', head: true });
    dbLatencyMs = Date.now() - t0;
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      uptime_ms_since_cold_start: Date.now() - start,
      db: {
        ok: dbOk,
        latency_ms: dbLatencyMs
      },
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'local',
      region: process.env.VERCEL_REGION ?? 'unknown'
    },
    {
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}
