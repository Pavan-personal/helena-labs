import { NextResponse } from 'next/server';
import {
  getServerClient,
  insertRunbookDraft,
  listRecentlyResolvedThreads,
  type WorkspaceRow
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

  const db = getServerClient();
  const { data: workspaces } = await db.from('workspaces').select('*');
  const wsList = (workspaces as WorkspaceRow[]) ?? [];

  const drafted: Array<{ workspaceId: string; draftId: string }> = [];

  for (const workspace of wsList) {
    const threads = await listRecentlyResolvedThreads(workspace.id, 24);
    for (const t of threads.slice(0, 3)) {
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
        drafted.push({ workspaceId: workspace.id, draftId: row.id });
      } catch (e) {
        console.error('draft failed', workspace.id, t.external_id, e);
      }
    }
  }

  return NextResponse.json({ ok: true, drafted });
}
