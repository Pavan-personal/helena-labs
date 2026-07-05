import { NextResponse } from 'next/server';
import { getWorkspaceFromSession } from '@/lib/session';
import { getThread, listMessages } from '@/lib/copilot/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const workspace = await getWorkspaceFromSession(url.searchParams.get('hs') ?? undefined);
  if (!workspace) return NextResponse.json({ error: 'no session' }, { status: 401 });
  const { id } = await params;
  const thread = await getThread(workspace.id, id);
  if (!thread) return NextResponse.json({ error: 'thread not found' }, { status: 404 });
  const sinceId = Number(url.searchParams.get('since') ?? '0');
  const messages = await listMessages(id, Number.isFinite(sinceId) ? sinceId : 0);
  return NextResponse.json({ messages });
}
