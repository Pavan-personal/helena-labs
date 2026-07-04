import { NextResponse } from 'next/server';
import {
  getDefaultWorkspace,
  insertRunbookDraft,
  listRecentlyResolvedThreads
} from '@helena/db';
import { draftRunbook } from '@helena/btl';
import { loadEnv } from '@helena/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const env = loadEnv();
  const authz = req.headers.get('authorization') ?? '';
  const provided = authz.replace(/^Bearer\s+/i, '');
  const isVercelCron = req.headers.get('x-vercel-cron') !== null;

  if (!isVercelCron && provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const workspace = await getDefaultWorkspace();
  const threads = await listRecentlyResolvedThreads(workspace.id, 24);

  const drafted: string[] = [];
  for (const t of threads.slice(0, 5)) {
    const first = t.incidents[0];
    if (!first) continue;
    try {
      const draft = await draftRunbook({
        workspaceId: workspace.id,
        threadTitle: first.title,
        incidents: t.incidents.map((i) => ({
          id: i.id,
          title: i.title,
          body: i.body,
          created_at: i.created_at
        }))
      });
      const row = await insertRunbookDraft(workspace.id, draft);
      drafted.push(row.id);
    } catch (e) {
      console.error('draft failed for thread', t.external_id, e);
    }
  }

  return NextResponse.json({ ok: true, drafted });
}
